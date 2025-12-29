from flask import Flask, request, jsonify
from flask_cors import CORS
import guidance
from guidance import models
import json
import os
import logging
from pythonjsonlogger import jsonlogger
from cache.guidance_cache import GuidanceCacheManager

# Import All Templates
from templates.medical_de import MedicalTemplatesDE
from templates.financial_de import FinancialTemplatesDE
from templates.legal_de import LegalTemplatesDE
from templates.general_de import GeneralTemplatesDE

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

CONFIDENCE_KEYS = ("vertrauen", "sicherheit", "routing_vertrauen")


def _normalize_confidence_value(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        normalized = float(value)
    elif isinstance(value, str):
        cleaned = value.strip()
        if cleaned.endswith("%"):
            cleaned = cleaned[:-1]
        cleaned = cleaned.replace(",", ".")
        try:
            normalized = float(cleaned)
        except (TypeError, ValueError):
            return value
    else:
        return value

    if normalized < 0:
        normalized = 0.0
    elif normalized > 1.0:
        if normalized <= 100:
            normalized = normalized / 100.0
        else:
            normalized = 1.0

    return round(normalized, 2)


def _normalize_confidence_fields(payload):
    if not isinstance(payload, dict):
        return payload

    for key in CONFIDENCE_KEYS:
        if key in payload:
            payload[key] = _normalize_confidence_value(payload.get(key))

    return payload

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
    # Prioritize OLLAMA_ENDPOINT, fallback to OLLAMA_HOST, then localhost
    OLLAMA_ENDPOINT = os.getenv('OLLAMA_ENDPOINT', os.getenv('OLLAMA_HOST', 'http://localhost:11434/v1'))
    
    # Register All Templates across all phases
    templates = {
        # Phase 1: Medical
        'medical_classifier': MedicalTemplatesDE.get_medical_classifier(),
        'medical_extractor': MedicalTemplatesDE.get_medical_extractor(),
        'medical_integrator': MedicalTemplatesDE.get_medical_integrator(),
        
        # Phase 2: Financial
        'financial_extractor': FinancialTemplatesDE.get_financial_extractor(),
        'financial_reasoner': FinancialTemplatesDE.get_financial_reasoner(),
        'vat_expert_analyzer': FinancialTemplatesDE.get_vat_expert_analyzer(),
        
        # Phase 3: Legal
        'legal_classifier': LegalTemplatesDE.get_legal_classifier(),
        'legal_extractor': LegalTemplatesDE.get_legal_extractor(),
        'legal_validator': LegalTemplatesDE.get_legal_validator(),
        
        # Phase 4: General
        'general_classifier': GeneralTemplatesDE.get_general_classifier(),
        'general_extractor': GeneralTemplatesDE.get_general_extractor(),
        'cross_pipeline_router': GeneralTemplatesDE.get_cross_pipeline_router()
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

                if template_name not in templates:
                    tracker.set_status('error')
                    return jsonify({'error': f'Template {template_name} not found'}), 400

                # 1. Cache Check
                if use_cache:
                    cached = cache_manager.get(template_name, variables, model, temperature)
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
                    api_key='ollama'
                )

                # 3. Execute Template
                template_func = templates[template_name]
                result = lm + template_func(**variables)

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
                            generated = json.loads(output_payload)
                        elif isinstance(output_payload, dict):
                            generated = output_payload
                        else:
                            generated = {"output": output_payload}
                    except json.JSONDecodeError as exc:
                        app.logger.error(
                            "JSON parse failed for %s output (%s)",
                            template_name,
                            exc,
                        )
                        tracker.set_status('error')
                        return jsonify({'error': 'Failed to parse JSON output'}), 500
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
