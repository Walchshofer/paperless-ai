from flask import Flask, request, jsonify
from flask_cors import CORS
try:
    from guidance import models  # type: ignore[import]
except Exception:
    models = None
import json
import os
import logging
import time
from pythonjsonlogger import jsonlogger
from cache.guidance_cache import GuidanceCacheManager

# Import All Templates
from templates.medical_de import MedicalTemplatesDE
from templates.financial_de import FinancialTemplatesDE
from templates.legal_de import LegalTemplatesDE
from templates.general_de import GeneralTemplatesDE
from templates import normalization_geometry as normalization_geometry_module

# Import All Validators
from validators.medical import validate_medical_extraction
from validators.financial import validate_financial_extraction
from validators.legal import validate_legal_extraction
from validators.general import validate_general_extraction

# Import Metrics
from metrics.guidance_metrics import (
    init_metrics_endpoint,
    track_request,
    track_cache_operation,
    track_validation
)
from metrics.tag_metrics import record_tag_generation, extract_tag_lists
from metrics.tag_statistics import build_tag_stats_context

CONFIDENCE_KEYS = ("vertrauen", "sicherheit", "routing_vertrauen")


def _normalize_confidence_value(value):
    """Normalize confidence values to 0.0-1.0 range.

    Handles:
    - Boolean → 1.0 (True) or 0.0 (False)
    - Percentage strings (explicit %) → divide by 100
    - Values already in 0-1 → pass through
    - Values in (1, 100] without % → REJECT (ambiguous)
    - Values > 100 → clamp to 1.0
    - Values < 0 → clamp to 0.0
    - Invalid values → return as-is (validator will catch)
    """
    if value is None:
        return None

    if isinstance(value, bool):
        return float(value)

    # Convert to float
    if isinstance(value, (int, float)):
        normalized = float(value)
    elif isinstance(value, str):
        cleaned = value.strip()
        # Handle explicit percentage notation
        is_percentage = cleaned.endswith("%")
        if is_percentage:
            cleaned = cleaned[:-1]
        cleaned = cleaned.replace(",", ".")
        try:
            normalized = float(cleaned)
            if is_percentage:
                # Explicit percentage: divide by 100
                normalized = normalized / 100.0
        except (TypeError, ValueError):
            return value  # Invalid format, let validator reject it
    else:
        return value  # Unsupported type, let validator reject it

    # Clamp to valid range
    if normalized < 0:
        return 0.0
    elif normalized > 1.0:
        return 1.0

    return round(normalized, 2)


def _normalize_confidence_fields(payload):
    """Normalize all confidence fields in payload.

    Args:
        payload: Dict with potential confidence fields
                 
    Returns:
        Dict with normalized confidence values
    """
    if not isinstance(payload, dict):
        return payload

    for key in CONFIDENCE_KEYS:
        if key in payload:
            payload[key] = _normalize_confidence_value(payload.get(key))

    return payload


def _infer_domain(template_name: str) -> str:
    if not template_name:
        return "unknown"
    lowered = template_name.lower()
    if "medical" in lowered:
        return "medical"
    if "financial" in lowered or "vat" in lowered:
        return "financial"
    if "legal" in lowered:
        return "legal"
    if "general" in lowered or "cross_pipeline" in lowered:
        return "general"
    return "unknown"


def _normalize_tag_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        items = value
    elif isinstance(value, tuple):
        items = list(value)
    elif isinstance(value, str):
        items = [value]
    else:
        items = [str(value)]

    cleaned = []
    for item in items:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            cleaned.append(text)
    return cleaned


def _normalize_existing_tags(existing_tags):
    if not existing_tags:
        return []
    if isinstance(existing_tags, (list, tuple)):
        items = list(existing_tags)
    elif isinstance(existing_tags, str):
        items = [existing_tags]
    else:
        items = [existing_tags]

    normalized = []
    for tag in items:
        if not tag:
            continue
        if isinstance(tag, str):
            text = tag.strip()
        elif isinstance(tag, dict) and tag.get("name"):
            text = str(tag.get("name")).strip()
        else:
            text = str(tag).strip()
        if text:
            normalized.append(text)
    return normalized


def _extract_existing_tags(variables):
    variables = variables or {}
    return _normalize_existing_tags(
        variables.get("existing_tags")
        or variables.get("existingTags")
        or variables.get("existingTagNames")
        or variables.get("existingTagsList")
        or []
    )


def _dedupe_tags(tags):
    seen = set()
    deduped = []
    for tag in tags:
        key = str(tag).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(str(tag).strip())
    return deduped


def _apply_tag_validation(generated, variables, template_name):
    if not isinstance(generated, dict):
        return generated
    existing_tags = _extract_existing_tags(variables)
    suggested_tags = _normalize_tag_list(generated.get("suggested_tags"))
    missing_tags = _normalize_tag_list(generated.get("missing_tags"))

    if existing_tags:
        known = {tag.lower(): tag for tag in existing_tags}
        filtered = []
        extra_missing = []
        for tag in suggested_tags:
            key = str(tag).strip().lower()
            if not key:
                continue
            if key in known:
                filtered.append(known[key])
            else:
                extra_missing.append(str(tag).strip())
        suggested_tags = filtered
        missing_tags.extend(extra_missing)

    suggested_tags = _dedupe_tags(suggested_tags)
    missing_tags = _dedupe_tags(missing_tags)

    if (suggested_tags
            or missing_tags
            or isinstance(generated.get("tagging"), dict)):
        generated["suggested_tags"] = suggested_tags
        generated["missing_tags"] = missing_tags

    tagging = generated.get("tagging")
    if isinstance(tagging, dict):
        if not tagging.get("domain"):
            tagging["domain"] = _infer_domain(template_name)
        if not tagging.get("source"):
            tagging["source"] = ("guidance_tagger_v2"
                                 if "v2" in template_name
                                 else "guidance_tagger")
        generated["tagging"] = tagging

    return generated


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Logging Configuration
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter()
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)
    app.logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

    # Cache Initialization
    cache_manager = GuidanceCacheManager(
        cache_dir=os.getenv('CACHE_DIR', '/app/cache'),
        ttl_hours=int(os.getenv('CACHE_TTL_HOURS', 72))
    )
    use_cache = os.getenv('USE_CACHE', 'true') == 'true'

    # Ollama Host Configuration
    # Prioritize OLLAMA_ENDPOINT, fallback to OLLAMA_API_URL, then localhost
    _ollama_base = os.getenv(
        'OLLAMA_ENDPOINT',
        os.getenv('OLLAMA_API_URL', 'http://localhost:11434')
    )
    # Ensure /v1 suffix for OpenAI compatibility mode
    OLLAMA_ENDPOINT = _ollama_base if _ollama_base.endswith('/v1') else f"{_ollama_base.rstrip('/')}/v1"

    # Register All Templates across all phases
    templates = {
        # Phase 1: Medical
        'medical_classifier': (
            MedicalTemplatesDE.get_medical_classifier()
        ),
        'medical_extractor': (
            MedicalTemplatesDE.get_medical_extractor()
        ),
        'medical_integrator': (
            MedicalTemplatesDE.get_medical_integrator()
        ),
        'medical_integrator_v2': (
            MedicalTemplatesDE.get_medical_integrator_v2()
        ),

        # Phase 2: Financial
        'financial_extractor': (
            FinancialTemplatesDE.get_financial_extractor()
        ),
        'financial_reasoner': (
            FinancialTemplatesDE.get_financial_reasoner()
        ),
        'vat_expert_analyzer': (
            FinancialTemplatesDE.get_vat_expert_analyzer()
        ),
        'financial_extractor_v2': (
            FinancialTemplatesDE.get_financial_extractor_v2()
        ),
        'financial_reasoner_v2': (
            FinancialTemplatesDE.get_financial_reasoner_v2()
        ),

        # Phase 3: Legal
        'legal_classifier': (
            LegalTemplatesDE.get_legal_classifier()
        ),
        'legal_extractor': (
            LegalTemplatesDE.get_legal_extractor()
        ),
        'legal_validator': (
            LegalTemplatesDE.get_legal_validator()
        ),
        'legal_extractor_v2': (
            LegalTemplatesDE.get_legal_extractor_v2()
        ),

        # Phase 4: General
        'general_classifier': (
            GeneralTemplatesDE.get_general_classifier()
        ),
        'general_extractor': (
            GeneralTemplatesDE.get_general_extractor()
        ),
        'general_extractor_v2': (
            GeneralTemplatesDE.get_general_extractor_v2()
        ),
        'cross_pipeline_router': (
            GeneralTemplatesDE.get_cross_pipeline_router()
        ),
        # Phase 6: Normalization geometry
        'normalization_geometry': (
            normalization_geometry_module.analyze_document_geometry
        ),
    }

    # Initialize Prometheus metrics endpoint
    init_metrics_endpoint(app)

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({
            'status': 'ok',
            'service': 'guidance-service',
            'phases_loaded': ['medical', 'financial', 'legal', 'general'],
            'cache_enabled': use_cache,
            'ollama_target': OLLAMA_ENDPOINT
        })

    @app.route('/templates', methods=['GET'])
    def list_templates():
        return jsonify({
            'templates': list(templates.keys())
        })

    @app.route('/generate', methods=['POST'])
    def generate():
        data = request.json or {}
        template_name = data.get('template', 'unknown')
        model = data.get('model', 'sauerkraut-llama3.1:8b')

        with track_request(template_name, model) as tracker:
            try:
                variables = data.get('variables', {})
                temperature = data.get('temperature', 0.1)
                template_latency_seconds = None
                json_valid = None
                has_tag_fields = False

                if not isinstance(variables, dict):
                    variables = {}

                stats_context = build_tag_stats_context(
                    existing_tags=_extract_existing_tags(variables),
                    domain=(
                        variables.get("domain")
                        or _infer_domain(template_name)
                    ),
                )
                if stats_context and "tag_stats_context" not in variables:
                    variables = dict(variables)
                    variables["tag_stats_context"] = stats_context

                if template_name not in templates:
                    tracker.set_status('error')
                    error_resp = {
                        'error': f'Template {template_name} not found'
                    }
                    return jsonify(error_resp), 400

                # 1. Cache Check
                if use_cache:
                    cached = cache_manager.get(
                        template_name,
                        variables,
                        model,
                        temperature,
                    )
                    if cached:
                        app.logger.info(f"Cache hit for {template_name}")
                        track_cache_operation('get', hit=True)
                        tracker.set_status('success')
                        return jsonify({
                            'status': 'success',
                            'generated': cached['generated'],
                            'validation': cached['validation'],
                            'source': 'cache'
                        })
                    else:
                        track_cache_operation('get', hit=False)

                # 2. Initialize Guidance LLM
                lm = models.OpenAI(
                    model=model,
                    base_url=OLLAMA_ENDPOINT,
                    api_key='ollama',
                )

                # 3. Execute Template
                template_func = templates[template_name]
                template_start = time.time()

                # VERBOSE LOGGING: Log template execution start
                app.logger.info({
                    'event': 'template_execution_start',
                    'template': template_name,
                    'model': model,
                    'temperature': temperature,
                    'variables_keys': list(variables.keys()) if variables else [],
                    'ollama_endpoint': OLLAMA_ENDPOINT
                })

                result = lm + template_func(**variables)
                template_latency_seconds = time.time() - template_start

                # VERBOSE LOGGING: Log raw result
                raw_output = None
                try:
                    if "output" in result:
                        raw_output = result["output"]
                except Exception:
                    raw_output = str(result)[:500]

                app.logger.info({
                    'event': 'template_execution_complete',
                    'template': template_name,
                    'model': model,
                    'latency_seconds': round(template_latency_seconds, 2),
                    'raw_output_preview': str(raw_output)[:300] if raw_output else None,
                    'raw_output_type': type(raw_output).__name__ if raw_output else None
                })

                # 4. Extract Variables
                generated = {}
                output_payload = None
                try:
                    if "output" in result:
                        output_payload = result["output"]
                except (KeyError, AttributeError, TypeError) as exc:
                    app.logger.warning(
                        "Output extraction failed for %s (%s)",
                        template_name,
                        exc,
                    )

                if output_payload is not None:
                    try:
                        if isinstance(output_payload, str):
                            if (
                                '"suggested_tags"' in output_payload
                                or '"missing_tags"' in output_payload
                            ):
                                has_tag_fields = True
                            generated = json.loads(output_payload)
                            json_valid = True
                        elif isinstance(output_payload, dict):
                            generated = output_payload
                            if (
                                'suggested_tags' in output_payload
                                or 'missing_tags' in output_payload
                            ):
                                has_tag_fields = True
                            json_valid = True
                        else:
                            generated = {"output": output_payload}
                            json_valid = False
                    except json.JSONDecodeError as exc:
                        app.logger.error(
                            "JSON parse failed for %s output (%s)",
                            template_name,
                            exc,
                        )
                        json_valid = False
                        if has_tag_fields:
                            tag_info = extract_tag_lists({})
                            record_tag_generation(
                                template=template_name,
                                domain=_infer_domain(template_name),
                                json_valid=json_valid,
                                latency_seconds=template_latency_seconds,
                                suggested_tags=tag_info["suggested_tags"],
                                missing_tags=tag_info["missing_tags"],
                                logger=app.logger,
                            )
                        tracker.set_status('error')
                        error_resp = {'error': 'Failed to parse JSON output'}
                        return jsonify(error_resp), 500
                else:
                    if 'medical' in template_name:
                        var_names = [
                            'dokumenttyp',
                            'vertrauen',
                            'name',
                            'geburtsdatum',
                            'diagnosen_items',
                            'medikament_name',
                            'medikament_dosierung',
                            'laborwert_name',
                            'laborwert_wert',
                            'laborwert_einheit',
                            'primaerdiagnose',
                        ]
                    elif 'financial' in template_name:
                        var_names = [
                            'von_name',
                            'von_uid',
                            'rechnungsdatum',
                            'summe_netto',
                            'steuersatz',
                            'steuerbetrag',
                            'summe_brutto',
                            'valide',
                            'konform',
                        ]
                    elif 'legal' in template_name:
                        var_names = [
                            'dokumenttyp',
                            'komplexitaet',
                            'jurisdiktion',
                            'vertrauen',
                            'partei1_name',
                            'partei2_name',
                            'abschluss_datum',
                            'gueltig_ab',
                            'anwendbares_recht',
                        ]
                    elif 'general' in template_name:
                        var_names = [
                            'dokumenttyp',
                            'sprache',
                            'themata',
                            'enthaelt_finanzen',
                            'enthaelt_personendaten',
                            'vertrauen',
                            'zusammenfassung',
                            'schluesselwoerter',
                            'pipeline',
                            'begruendung',
                            'sicherheit',
                        ]
                    else:
                        var_names = []

                    for var_name in var_names:
                        try:
                            if var_name in result:
                                generated[var_name] = result[var_name]
                        except (KeyError, AttributeError, TypeError) as exc:
                            app.logger.warning(
                                "Variable extraction failed for %s:%s (%s)",
                                template_name,
                                var_name,
                                exc,
                            )

                generated = _normalize_confidence_fields(generated)
                generated = _apply_tag_validation(
                    generated,
                    variables,
                    template_name,
                )
                tag_info = extract_tag_lists(generated)
                has_tag_fields = has_tag_fields or (
                    isinstance(generated, dict)
                    and (
                        'suggested_tags' in generated
                        or 'missing_tags' in generated
                    )
                )
                if has_tag_fields:
                    json_valid_value = (
                        json_valid if json_valid is not None else True
                    )
                    record_tag_generation(
                        template=template_name,
                        domain=_infer_domain(template_name),
                        json_valid=json_valid_value,
                        latency_seconds=template_latency_seconds,
                        suggested_tags=tag_info["suggested_tags"],
                        missing_tags=tag_info["missing_tags"],
                        logger=app.logger,
                    )

                # 5. Validation Dispatch
                validation = {'valid': True, 'errors': [], 'warnings': []}

                if 'medical' in template_name:
                    validation = validate_medical_extraction(generated)
                elif 'financial' in template_name:
                    validation = validate_financial_extraction(generated)
                elif 'legal' in template_name:
                    validation = validate_legal_extraction(generated)
                elif 'general' in template_name:
                    validation = validate_general_extraction(generated)

                # Track validation result
                track_validation(
                    template_name,
                    validation.get('valid', True),
                    validation.get('errors', [])
                )

                # 5. Cache Store
                if use_cache:
                    cache_manager.set(
                        template_name,
                        variables,
                        model,
                        temperature,
                        {'generated': generated, 'validation': validation}
                    )
                    track_cache_operation('set', hit=True)

                tracker.set_status('success')
                return jsonify({
                    'status': 'success',
                    'generated': generated,
                    'validation': validation,
                    'source': 'generated'
                })

            except Exception as e:
                app.logger.error(f"Generation failed: {str(e)}")
                tracker.set_status('error')
                return jsonify({'error': str(e)}), 500

    return app
