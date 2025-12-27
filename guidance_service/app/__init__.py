from flask import Flask, request, jsonify
from flask_cors import CORS
import guidance
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
    
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({
            'status': 'ok', 
            'service': 'guidance-service',
            'phases_loaded': ['medical', 'financial', 'legal', 'general'],
            'cache_enabled': use_cache,
            'ollama_target': OLLAMA_ENDPOINT
        })
    
    @app.route('/generate', methods=['POST'])
    def generate():
        try:
            data = request.json
            template_name = data.get('template')
            # Default to German-optimized model if not specified
            model = data.get('model', 'sauerkraut-llama3.1:8b')
            variables = data.get('variables', {})
            # Low temperature for deterministic extraction
            temperature = data.get('temperature', 0.1)
            
            if template_name not in templates:
                return jsonify({'error': f'Template {template_name} not found'}), 400

            # 1. Cache Check
            if use_cache:
                cached = cache_manager.get(template_name, variables, model)
                if cached:
                    app.logger.info(f"Cache hit for {template_name}")
                    return jsonify({
                        'status': 'success', 
                        'generated': cached['generated'], 
                        'validation': cached['validation'], 
                        'source': 'cache'
                    })

            # 2. Initialize Guidance LLM
            # Note: We use the OpenAI adapter which works with Ollama's v1/chat API
            guidance.llm = guidance.llms.OpenAI(
                model=model, 
                endpoint=OLLAMA_ENDPOINT, 
                token='ollama', 
                api_key='ollama'
            )
            
            # 3. Execute Template
            template_func = templates[template_name]
            result = template_func(**variables)
            generated = result.variables()
            
            # 4. Validation Dispatch
            validation = {'valid': True, 'errors': []}
            
            if 'medical' in template_name: 
                validation = validate_medical_extraction(generated)
            elif 'financial' in template_name: 
                validation = validate_financial_extraction(generated)
            elif 'legal' in template_name: 
                validation = validate_legal_extraction(generated)
            elif 'general' in template_name: 
                validation = validate_general_extraction(generated)

            # 5. Cache Store
            if use_cache:
                cache_manager.set(
                    template_name, 
                    variables, 
                    model, 
                    {'generated': generated, 'validation': validation}
                )

            return jsonify({
                'status': 'success',
                'generated': generated,
                'validation': validation,
                'source': 'generated'
            })
            
        except Exception as e:
            app.logger.error(f"Generation failed: {str(e)}")
            return jsonify({'error': str(e)}), 500

    return app