from typing import Dict, Any

def validate_general_extraction(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate the output from the General Extraction template.
    Since general documents vary widely, validation is lenient but checks for structure.
    """
    errors = []
    warnings = []
    
    try:
        # 1. Validate Summary
        summary = data.get('zusammenfassung')
        if not summary or not isinstance(summary, str) or len(summary.strip()) < 10:
            warnings.append("Summary is missing or too short")
            
        # 2. Validate Keywords
        keywords = data.get('schluesselwoerter')
        if not isinstance(keywords, list):
            errors.append("Keywords must be a list")
        elif len(keywords) == 0:
            warnings.append("No keywords extracted")
            
        # 3. Check for hallucinations or empty generation (common in general tasks)
        if not data:
            errors.append("Empty extraction result")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    except Exception as e:
        return {
            'valid': False,
            'errors': [f"General validation exception: {str(e)}"]
        }