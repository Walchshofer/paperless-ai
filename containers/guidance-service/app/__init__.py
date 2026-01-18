from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
# DON'T import guidance at module level - import lazily in functions
# This avoids pickle issues with @guidance decorators and thread locks
import json
import os
import logging
import time
from pythonjsonlogger import jsonlogger
from cache.guidance_cache import GuidanceCacheManager

# Note: Template modules are imported inline in get_template_func() to avoid
# pickle issues with @guidance decorated functions being stored globally

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


def parse_thinking_parts(text: str):
    """Extract thinking and response phases"""
    parts = []

    # Check for thinking markers
    if "<think>" in text and "</think>" in text:
        think_start = text.find("<think>") + 7
        think_end = text.find("</think>")
        thinking = text[think_start:think_end].strip()
        response = text[think_end + 8:].strip()

        if thinking:
            parts.append(("thinking", thinking))
        if response:
            parts.append(("response", response))
    else:
        # No thinking markers, just response
        parts.append(("response", text))

    return parts if parts else [("response", text)]


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
    # Read service-specific variable first, fallback to generic LOG_LEVEL, then default to INFO
    # This handles empty strings defensively (strip() or fallback)
    log_level = (os.getenv('GUIDANCE_LOG_LEVEL') or
                 os.getenv('LOG_LEVEL') or
                 'INFO').strip().upper()
    app.logger.setLevel(log_level)

    # Cache Initialization
    cache_manager = GuidanceCacheManager(
        cache_dir=os.getenv('CACHE_DIR', '/app/cache'),
        ttl_hours=int(os.getenv('CACHE_TTL_HOURS', 72))
    )
    use_cache = os.getenv('USE_CACHE', 'true') == 'true'

    # Ollama Base Configuration
    # Base URL for health checks and native Ollama API
    OLLAMA_BASE_URL = os.getenv(
        'OLLAMA_API_URL',
        'http://host.docker.internal:11434'
    ).rstrip('/')

    # OpenAI-compatible endpoint for LiteLLM
    # Guidance's LiteLLM only supports:
    #   - openai, azure_ai, azure, gemini
    #   - anthropic, xai, hosted_vllm, groq, mistral
    # Ollama exposes OpenAI-compatible API at /v1, so we use openai/ prefix
    OLLAMA_API_BASE = OLLAMA_BASE_URL + '/v1'

    # Templates that require vision models - must bypass Guidance
    #
    # WHY BYPASS IS NEEDED:
    # 1. Guidance's experimental LiteLLM wrapper doesn't expose `images` param
    # 2. Even with LiteLLM >= 1.70.0 (which has Ollama vision fix PR #9089),
    #    Guidance templates can't pass images through the multimodal channel
    # 3. The document_image_b64 param in templates is ignored by LiteLLM
    #
    # WORKAROUND (from https://github.com/BerriAI/litellm/issues/6683):
    # Direct Ollama API call with images in separate array
    VISION_TEMPLATES = {'normalization_geometry'}

    def strip_base64_header(image_b64: str) -> str:
        """Strip data URI header from base64 image (Header Trap fix).

        Ollama expects raw base64, not data URIs like:
        "data:image/jpeg;base64,/9j/4AAQ..." -> "/9j/4AAQ..."

        Args:
            image_b64: Base64 string, possibly with data URI header

        Returns:
            Clean base64 string without header
        """
        if not image_b64:
            return image_b64
        # Check for data URI pattern in first 100 chars
        if ',' in image_b64[:100] and image_b64.startswith('data:'):
            return image_b64.split(',', 1)[1]
        return image_b64

    def call_ollama_vision(
        model: str,
        image_b64: str,
        prompt: str,
        schema_json: dict,
        temperature: float = 0.2,
        # Large buffer for thinking models with verbose reasoning
        max_tokens: int = 2000
    ) -> dict:
        """Call Ollama directly for vision models (bypasses Guidance).

        WHY BYPASS IS REQUIRED:
        - Guidance's experimental LiteLLM does NOT support multimodal
        - There's no way to pass images through Guidance's API
        - The image param in templates is ignored by LiteLLM

        TRAP AVOIDANCE:
        1. Header Trap: Strips "data:image/...;base64," prefix
        2. Injection Trap: Image goes in 'images' array, NOT in prompt text

        Args:
            model: Vision model name (e.g., 'qwen3-vl:8b')
            image_b64: Base64-encoded image (may include data URI header)
            prompt: Text prompt for analysis (NO image data here!)
            schema_json: JSON schema for structured output
            temperature: Generation temperature
            max_tokens: Maximum tokens to generate

        Returns:
            Parsed JSON response from the model
        """
        import requests as http_requests

        # FIX TRAP 1: Strip data URI header
        clean_image = strip_base64_header(image_b64)

        # Validate we have actual image data
        if not clean_image or len(clean_image) < 100:
            raise ValueError(
                "Image data is empty or too short after header strip. "
                "Expected base64-encoded image."
            )

        app.logger.debug(
            f"Vision request: image_len={len(clean_image)}, "
            f"model={model}, "
            f"header_stripped={len(clean_image) != len(image_b64)}",
        )

        # Build prompt with simplified schema (NO full JSON dump -
        #  breaks qwen3-vl!)
        # NOTE: qwen3-vl returns EMPTY when:
        # 1. System message is used
        # 2. "format": "json" option is used
        # 3. Large JSON schema is included in prompt
        # Solution: Use simple, direct prompt with example output format

        full_prompt = (
            f"""Analyze this document image for geometric corrections.

{prompt}

Return ONLY valid JSON with these fields:
- "rotate": integer (0, 90, 180, or 270 degrees)
- "needs_crop": boolean (true if margins need cropping)
- "target_dpi": integer (200-400, recommended resolution)
- "confidence": float (0.0-1.0, your confidence level)
- "reasoning": string (brief explanation)

Example output format:
            {{
                "rotate": 0,
                "needs_crop": false,
                "target_dpi": 300,
                "confidence": 0.9,
                "reasoning": "Document is upright"
            }}"""
        )
        # FIX TRAP 2: Image in 'images' array, NOT in prompt text
        # FIX TRAP 3: Do NOT use system message -
        #  qwen3-vl returns empty with it!
        # FIX TRAP 4: Do NOT use "format": "json" -
        #  breaks qwen3-vl (returns empty)
        # FIX TRAP 5: Do NOT include large JSON schema -
        #  breaks qwen3-vl (returns empty)

        payload = {
            "model": model,
            "messages": [
                # NOTE: NO system message - qwen3-vl doesn't support it!
                {
                    "role": "user",
                    "content": full_prompt,  # Text only - no base64!
                    "images": [clean_image]   # Image via proper channel
                }
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
            # REMOVED: "format": "json" - breaks qwen3-vl vision model
        }

        response = http_requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=300
        )
        response.raise_for_status()

        result = response.json()
        content = result.get("message", {}).get("content", "")

        app.logger.debug(
            f"Vision response: content_len={len(content)}, "
            f"preview={content[:200] if content else 'EMPTY'}"
        )

        if not content or not content.strip():
            raise ValueError(
                "Vision model returned empty response. "
                "Check image validity and model vision support."
            )

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            app.logger.error(
                f"Invalid JSON from vision model: {content[:500]}"
            )
            raise ValueError(f"Vision model output not valid JSON: {e}")

    def get_lm(model_name: str):
        """Factory function to create fresh LLM instance per request.

        Uses LiteLLM with openai/ prefix pointing to Ollama's OpenAI-compatible
        endpoint (/v1). This works because:
        1. Guidance's LiteLLM ONLY supports:
           - openai, azure_ai, azure, gemini
           - anthropic, xai, hosted_vllm, groq, mistral
        2. Ollama exposes OpenAI-compatible API at http://host:11434/v1
        3. We use api_base to redirect to Ollama

        Args:
            model_name: The model to use (e.g., 'sauerkraut-llama3.1:8b')

        Returns:
            Fresh LiteLLM instance configured for Ollama via
            OpenAI-compatible API
        """
        # Lazy import to avoid module-level pickle issues
        from guidance.models.experimental import LiteLLM

        return LiteLLM(
            model_description={
                "model_name": model_name,
                "litellm_params": {
                    # Use openai/ prefix - Guidance's LiteLLM doesn't
                    # support the 'ollama' provider name
                    # Ollama's OpenAI-compatible endpoint handles this
                    # correctly
                    "model": f"openai/{model_name}",
                    # Points to Ollama's /v1 endpoint
                    "api_base": OLLAMA_API_BASE,
                    # Ollama doesn't require auth but LiteLLM needs something
                    "api_key": "ollama",
                    "timeout": 300,
                    "max_retries": 1,
                }
            },
            echo=False
        )

    # Valid template names (for validation only -
    #  don't store decorated functions!)
    # Storing @guidance decorated functions in a dict causes pickle errors
    # when Gunicorn tries to serialize them across workers
    VALID_TEMPLATES = {
        # Phase 1: Medical
        'medical_classifier',
        'medical_extractor',
        'medical_integrator',
        'medical_integrator_v2',
        # Phase 2: Financial
        'financial_extractor',
        'financial_reasoner',
        'vat_expert_analyzer',
        'financial_extractor_v2',
        'financial_reasoner_v2',
        # Phase 3: Legal
        'legal_classifier',
        'legal_extractor',
        'legal_validator',
        'legal_extractor_v2',
        # Phase 4: General
        'general_classifier',
        'general_extractor',
        'general_extractor_v2',
        # Phase 5.5: Visual query generation
        'visual_query_generator_de',
        'financial_visual_query_generator_de',
        'medical_visual_query_generator_de',
        'legal_visual_query_generator_de',
        # Phase 6: Normalization geometry
        'normalization_geometry',
    }

    def get_template_func(template_name: str):
        """Import and return template function inline per request.

        This avoids pickling issues by importing the @guidance decorated
        function fresh for each request, rather than storing it globally.

        Args:
            template_name: Name of the template to get

        Returns:
            The @guidance decorated template function

        Raises:
            ValueError: If template_name is not valid
        """
        # Import inline to avoid pickle issues with @guidance decorators
        if template_name == 'medical_classifier':
            from templates.medical_de import MedicalTemplatesDE
            return MedicalTemplatesDE.get_medical_classifier()
        elif template_name == 'medical_extractor':
            from templates.medical_de import MedicalTemplatesDE
            return MedicalTemplatesDE.get_medical_extractor()
        elif template_name == 'medical_integrator':
            from templates.medical_de import MedicalTemplatesDE
            return MedicalTemplatesDE.get_medical_integrator()
        elif template_name == 'medical_integrator_v2':
            from templates.medical_de import MedicalTemplatesDE
            return MedicalTemplatesDE.get_medical_integrator_v2()
        elif template_name == 'financial_extractor':
            from templates.financial_de import FinancialTemplatesDE
            return FinancialTemplatesDE.get_financial_extractor()
        elif template_name == 'financial_reasoner':
            from templates.financial_de import FinancialTemplatesDE
            return FinancialTemplatesDE.get_financial_reasoner()
        elif template_name == 'vat_expert_analyzer':
            from templates.financial_de import FinancialTemplatesDE
            return FinancialTemplatesDE.get_vat_expert_analyzer()
        elif template_name == 'financial_extractor_v2':
            from templates.financial_de import FinancialTemplatesDE
            return FinancialTemplatesDE.get_financial_extractor_v2()
        elif template_name == 'financial_reasoner_v2':
            from templates.financial_de import FinancialTemplatesDE
            return FinancialTemplatesDE.get_financial_reasoner_v2()
        elif template_name == 'legal_classifier':
            from templates.legal_de import LegalTemplatesDE
            return LegalTemplatesDE.get_legal_classifier()
        elif template_name == 'legal_extractor':
            from templates.legal_de import LegalTemplatesDE
            return LegalTemplatesDE.get_legal_extractor()
        elif template_name == 'legal_validator':
            from templates.legal_de import LegalTemplatesDE
            return LegalTemplatesDE.get_legal_validator()
        elif template_name == 'legal_extractor_v2':
            from templates.legal_de import LegalTemplatesDE
            return LegalTemplatesDE.get_legal_extractor_v2()
        elif template_name == 'general_classifier':
            from templates.general_de import GeneralTemplatesDE
            return GeneralTemplatesDE.get_general_classifier()
        elif template_name == 'general_extractor':
            from templates.general_de import GeneralTemplatesDE
            return GeneralTemplatesDE.get_general_extractor()
        elif template_name == 'general_extractor_v2':
            from templates.general_de import GeneralTemplatesDE
            return GeneralTemplatesDE.get_general_extractor_v2()
        elif template_name == 'visual_query_generator_de':
            from templates.general_de import GeneralTemplatesDE
            return GeneralTemplatesDE.get_visual_query_generator()
        elif template_name == 'financial_visual_query_generator_de':
            from templates.financial_de import FinancialTemplatesDE
            return FinancialTemplatesDE.get_visual_query_generator()
        elif template_name == 'medical_visual_query_generator_de':
            from templates.medical_de import MedicalTemplatesDE
            return MedicalTemplatesDE.get_visual_query_generator()
        elif template_name == 'legal_visual_query_generator_de':
            from templates.legal_de import LegalTemplatesDE
            return LegalTemplatesDE.get_visual_query_generator()
        elif template_name == 'normalization_geometry':
            from templates.normalization_geometry import (
                get_analyze_document_geometry
            )
            return get_analyze_document_geometry()
        else:
            raise ValueError(f"Unknown template: {template_name}")

    # Initialize Prometheus metrics endpoint
    init_metrics_endpoint(app)

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({
            'status': 'ok',
            'service': 'guidance-service',
            'phases_loaded': ['medical', 'financial', 'legal', 'general'],
            'cache_enabled': use_cache,
            'ollama_target': OLLAMA_BASE_URL
        })

    @app.route('/health/models', methods=['GET'])
    def check_model_health():
        """Verify Ollama connectivity and list available models."""
        import requests as http_requests
        try:
            response = http_requests.get(
                f"{OLLAMA_BASE_URL}/api/tags",
                timeout=5
            )
            if response.status_code == 200:
                models_data = response.json().get('models', [])
                return jsonify({
                    'status': 'ok',
                    'ollama_endpoint': OLLAMA_BASE_URL,
                    'models_available': [
                        m.get('name') for m in models_data
                    ]
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Ollama API returned error',
                    'status_code': response.status_code
                }), 503
        except http_requests.exceptions.Timeout:
            return jsonify({
                'status': 'error',
                'message': 'Ollama connection timed out'
            }), 503
        except http_requests.exceptions.ConnectionError as e:
            return jsonify({
                'status': 'error',
                'message': f'Cannot connect to Ollama: {str(e)}'
            }), 503
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Unexpected error: {str(e)}'
            }), 503

    @app.route('/templates', methods=['GET'])
    def list_templates():
        return jsonify({
            'templates': sorted(list(VALID_TEMPLATES))
        })

    @app.route('/api/guidance/stream', methods=['POST'])
    def stream_thinking_response():
        """Stream thinking model response from Ollama via Guidance"""
        data = request.json or {}
        prompt = data.get("prompt")
        model_name = data.get("model", "qwen3-vl:8b")
        max_tokens = data.get("max_tokens", 2000)

        if not prompt:
            return jsonify({'error': 'Prompt required'}), 400

        def generate_stream():
            try:
                # Lazy import guidance components to avoid pickle issues
                from guidance import system, user, assistant, gen

                # Create fresh LLM instance per request to avoid
                # pickle issues with thread locks
                lm = get_lm(model_name)

                with system():
                    lm_run = lm + "You are a helpful assistant."

                with user():
                    lm_run += prompt

                with assistant():
                    lm_run += gen(
                        name="response",
                        max_tokens=max_tokens,
                        temperature=0.7
                    )

                response_text = lm_run["response"]

                # Parse thinking and response
                parts = parse_thinking_parts(response_text)

                for part_type, content in parts:
                    yield json.dumps({
                        "type": part_type,
                        "content": content
                    }) + "\n"

            except Exception as e:
                app.logger.error(f"Streaming failed: {str(e)}")
                yield json.dumps({
                    "type": "error",
                    "content": str(e)
                }) + "\n"

        return Response(
            stream_with_context(generate_stream()),
            mimetype='application/x-ndjson'
        )

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

                if template_name not in VALID_TEMPLATES:
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

                # 2. Handle vision templates via direct Ollama API
                # Guidance's LiteLLM does NOT support multimodal
                # - image params are ignored
                # See: https://github.com/BerriAI/litellm/issues/6683
                if template_name in VISION_TEMPLATES:
                    template_start = time.time()

                    app.logger.info({
                        'event': 'vision_template_start',
                        'template': template_name,
                        'model': model,
                        'mode': 'direct_ollama_bypass'
                    })

                    # Import schema and prompts from template module
                    from schemas.NormalizationSchema import (
                        NormalizationGeometry,
                    )
                    from templates.normalization_geometry import USER_PROMPTS

                    schema_json = NormalizationGeometry.model_json_schema()
                    image_b64 = variables.get('document_image_b64', '')
                    language = variables.get('language', 'de')
                    prompt = USER_PROMPTS.get(language, USER_PROMPTS['en'])

                    try:
                        generated = call_ollama_vision(
                            model=model,
                            image_b64=image_b64,
                            prompt=prompt,
                            schema_json=schema_json,
                            temperature=temperature,
                            # Large buffer for thinking models
                            max_tokens=2000
                        )
                        json_valid = True
                        template_latency_seconds = time.time() - template_start

                        app.logger.info({
                            'event': 'vision_template_complete',
                            'template': template_name,
                            'latency_seconds': round(
                                template_latency_seconds, 2
                            )
                        })

                        # Validate with Pydantic
                        try:
                            NormalizationGeometry.model_validate(generated)
                            validation = {
                                'valid': True, 'errors': [], 'warnings': []
                            }

                        except Exception as val_err:
                            validation = {
                                'valid': False,
                                'errors': [str(val_err)],
                                'warnings': []
                            }

                        # Cache and return
                        if use_cache:
                            cache_manager.set(
                                template_name, variables, model, temperature,
                                {
                                    'generated': generated,
                                    'validation': validation,
                                }
                            )
                            track_cache_operation('set', hit=True)

                        tracker.set_status('success')
                        return jsonify({
                            'status': 'success',
                            'generated': generated,
                            'validation': validation,
                            'source': 'generated'
                        })

                    except Exception as vision_err:
                        app.logger.error(
                            f"Vision template failed: {vision_err}"
                        )
                        tracker.set_status('error')
                        return jsonify({'error': str(vision_err)}), 500

                # 3. Standard Guidance path for text-only templates
                # Create fresh LLM instance per request to avoid
                # pickle issues with thread locks
                lm = get_lm(model)

                # Execute Template - import inline to avoid pickle issues
                # with @guidance decorated functions
                template_func = get_template_func(template_name)
                template_start = time.time()

                # VERBOSE LOGGING: Log template execution start
                app.logger.info({
                    'event': 'template_execution_start',
                    'template': template_name,
                    'model': model,
                    'temperature': temperature,
                    'variables_keys': (
                        list(variables.keys()) if variables else []
                    ),
                    'ollama_endpoint': OLLAMA_BASE_URL
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
                    'raw_output_preview': (
                        str(raw_output)[:300] if raw_output else None
                    ),
                    'raw_output_type': (
                        type(raw_output).__name__ if raw_output else None
                    )
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
                    elif 'normalization_geometry' in template_name:
                        # Extract geometry data from normalization template
                        try:
                            if 'geometry_validated' in result:
                                val = result['geometry_validated']
                                # Handle Pydantic model
                                if hasattr(val, 'model_dump'):
                                    generated = val.model_dump()
                                elif hasattr(val, 'dict'):
                                    generated = val.dict()
                                else:
                                    generated = val
                            elif 'geometry' in result:
                                raw_geo = result['geometry']
                                if isinstance(raw_geo, str):
                                    generated = json.loads(raw_geo)
                                else:
                                    generated = raw_geo
                        except Exception as exc:
                            app.logger.warning(
                                "Geometry extraction failed for %s (%s)",
                                template_name,
                                exc,
                            )
                        var_names = []
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
