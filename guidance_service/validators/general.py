"""
General Document Extraction Validator

Validates outputs from general_classifier and general_extractor templates.
Aligned with templates/general_de.py schema.
"""
import re
from typing import Dict, Any, List


def validate_general_extraction(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate the output from General Extraction templates.

    Handles multiple template outputs:
    - general_classifier: dokumenttyp, sprache, themata, enthaelt_finanzen, enthaelt_personendaten, vertrauen
    - general_extractor: extracted metadata (legacy format)
    """
    errors = []
    warnings = []

    try:
        # Check for empty result first
        if not data:
            errors.append("Empty extraction result")
            return {
                'valid': False,
                'errors': errors,
                'warnings': warnings
            }

        # Detect template type based on output keys
        if 'dokumenttyp' in data and 'themata' in data:
            # general_classifier output (new format)
            errors.extend(_validate_classifier_output(data, warnings))
        elif 'zusammenfassung' in data or 'schluesselwoerter' in data:
            # Legacy extractor format
            errors.extend(_validate_legacy_extractor(data, warnings))
        elif any(key in data for key in ['empfohlene_pipeline', 'empfehlung', 'pipeline']):
            # Cross-pipeline router output
            errors.extend(_validate_routing_recommendation(data, warnings))     
        else:
            # Unknown or minimal output - be lenient
            warnings.append("Unable to determine general template type - minimal validation applied")

        # Common validation: confidence score
        confidence = data.get('vertrauen')
        if confidence is not None:
            try:
                conf_val = float(confidence)
                if not (0.0 <= conf_val <= 1.0):
                    warnings.append(f"Confidence score out of range: {confidence}")
            except (ValueError, TypeError):
                errors.append(f"Invalid confidence format: {confidence}")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    except Exception as e:
        return {
            'valid': False,
            'errors': [f"General validation exception: {str(e)}"],
            'warnings': warnings
        }


def _validate_classifier_output(data: Dict[str, Any], warnings: List[str]) -> List[str]:
    """Validate general_classifier template output."""
    errors = []

    # Validate dokumenttyp
    doc_type = data.get('dokumenttyp', '')
    valid_types = [
        'Korrespondenz',
        'Bericht',
        'Zusammenfassung',
        'Sonstige',
    ]
    if not doc_type:
        warnings.append("Document type (dokumenttyp) is missing")
    elif doc_type not in valid_types:
        # Allow but warn - LLM may produce variations
        warnings.append(f"Document type '{doc_type}' not in standard list")

    # Validate sprache (language)
    language = data.get('sprache', '')
    valid_languages = ['Deutsch']
    if not language:
        warnings.append("Language (sprache) is missing")
    elif language not in valid_languages:
        # Allow variations
        warnings.append(f"Language '{language}' not in standard list")

    # Validate themata (topics array)
    themata = data.get('themata', [])
    if not isinstance(themata, list):
        errors.append("Themata (topics) must be a list")
    elif len(themata) == 0:
        warnings.append("Themata (topics) list is empty")

    # Validate boolean flags
    for bool_field in ['enthaelt_finanzen', 'enthaelt_personendaten']:
        value = data.get(bool_field)
        if value is not None and not isinstance(value, bool):
            if isinstance(value, str) and value.lower() in ['true', 'false']:
                warnings.append(f"Field {bool_field} should be boolean, got string")
            else:
                errors.append(f"Field {bool_field} must be boolean")

    return errors


def _validate_legacy_extractor(data: Dict[str, Any], warnings: List[str]) -> List[str]:
    """Validate general_extractor output."""
    errors = []

    # Validate zusammenfassung (summary)
    summary = data.get('zusammenfassung', '')
    if not summary or not isinstance(summary, str):
        warnings.append("Summary (zusammenfassung) is missing")
    elif len(summary.strip()) < 10:
        warnings.append("Summary (zusammenfassung) is too short")

    # Validate schluesselwoerter (keywords)
    keywords = data.get('schluesselwoerter', [])
    if not isinstance(keywords, list):
        errors.append("Keywords (schluesselwoerter) must be a list")
    elif len(keywords) == 0:
        warnings.append("No keywords extracted")

    # Validate entitaeten (entities)
    entities = data.get('entitaeten')
    if entities is None:
        warnings.append("Entitaeten (entities) missing")
    elif not isinstance(entities, list):
        errors.append("Entitaeten (entities) must be a list")

    # Validate daten (dates)
    dates = data.get('daten')
    if dates is None:
        warnings.append("Daten (dates) missing")
    elif not isinstance(dates, list):
        errors.append("Daten (dates) must be a list")

    return errors


def _validate_routing_recommendation(data: Dict[str, Any], warnings: List[str]) -> List[str]:
    """Validate cross_pipeline_router output."""
    errors = []

    # Validate recommended_pipeline
    pipeline = data.get('empfohlene_pipeline')
    if not pipeline:
        pipeline = data.get('empfehlung')
    if not pipeline:
        pipeline = data.get('pipeline', '')
    valid_pipelines = ['medical', 'financial', 'legal', 'general', 'fallback']
    if not pipeline:
        errors.append("Recommended pipeline is missing")
    elif pipeline.lower() not in valid_pipelines:
        errors.append(f"Invalid pipeline recommendation: {pipeline}")

    # Validate confidence
    confidence = data.get('routing_vertrauen')
    if confidence is None:
        confidence = data.get('sicherheit')
    if confidence is not None:
        try:
            conf_val = float(confidence)
            if not (0.0 <= conf_val <= 1.0):
                warnings.append(f"Routing confidence out of range: {confidence}")
        except (ValueError, TypeError):
            errors.append(f"Invalid routing confidence format: {confidence}")

    return errors
