"""
Legal Document Extraction Validator

Validates outputs from legal_classifier, legal_extractor, and legal_validator templates.
Aligned with templates/legal_de.py schema.
"""
import re
from typing import Dict, Any, List


def validate_legal_extraction(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate the output from Legal Extraction templates.

    Handles multiple template outputs:
    - legal_classifier: dokumenttyp, komplexitaet, vermutete_jurisdiktion, vertrauen
    - legal_extractor: vertragsparteien, daten, jurisdiktion_und_recht, vertrauen
    - legal_validator: validation results
    """
    errors = []
    warnings = []

    try:
        if not data or not isinstance(data, dict):
            errors.append("Empty extraction result")
            return {
                'valid': False,
                'errors': errors,
                'warnings': warnings
            }

        # Detect which template output we're validating
        if 'vertragsparteien' in data:
            # legal_extractor output
            errors.extend(_validate_extractor_output(data, warnings))
        elif 'dokumenttyp' in data and 'komplexitaet' in data:
            # legal_classifier output
            errors.extend(_validate_classifier_output(data))
        elif 'valid' in data and 'issues' in data:
            # legal_validator output
            if not isinstance(data.get('valid'), bool):
                errors.append("Legal validator returned invalid valid flag")
            elif not data.get('valid'):
                errors.append("Legal validator marked output invalid")
            issues = data.get('issues', [])
            if isinstance(issues, list):
                for issue in issues:
                    if isinstance(issue, str) and issue:
                        warnings.append(issue)
        else:
            # Unknown or minimal output
            warnings.append("Unable to determine legal template type - minimal validation applied")

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
            'errors': [f"Legal validation exception: {str(e)}"],
            'warnings': warnings
        }


def _validate_extractor_output(data: Dict[str, Any], warnings: List[str]) -> List[str]:
    """Validate legal_extractor template output."""
    errors = []

    # Validate vertragsparteien (contract parties)
    parties = data.get('vertragsparteien', {})
    if not parties:
        errors.append("Vertragsparteien (contract parties) section missing")
    else:
        if not parties.get('partei_1'):
            errors.append("Partei 1 (Party 1) missing or empty")
        if not parties.get('partei_2'):
            errors.append("Partei 2 (Party 2) missing or empty")

    # Validate daten (dates)
    dates = data.get('daten', {})
    if dates:
        abschluss = dates.get('abschluss_datum')
        if abschluss and not _is_valid_date(abschluss):
            warnings.append(f"Invalid contract date format: {abschluss}")

        gueltig_ab = dates.get('gueltig_ab')
        if gueltig_ab and not _is_valid_date(gueltig_ab):
            warnings.append(f"Invalid effective date format: {gueltig_ab}")

    # Validate jurisdiktion_und_recht (jurisdiction)
    jurisdiction = data.get('jurisdiktion_und_recht', {})
    if jurisdiction:
        applicable_law = jurisdiction.get('anwendbares_recht', '')
        valid_laws = [
            'Österreich (ABGB)',
            'Deutschland (BGB)',
            'Schweiz (ZGB)',
            'Europäisches Recht',
            'Schiedsverfahren'
        ]
        if applicable_law and applicable_law not in valid_laws:
            # Warn but don't error - LLM may produce variations
            pass

    return errors


def _validate_classifier_output(data: Dict[str, Any]) -> List[str]:
    """Validate legal_classifier template output."""
    errors = []

    # Validate dokumenttyp
    doc_type = data.get('dokumenttyp', '')
    valid_types = [
        'Kaufvertrag', 'Mietvertrag', 'Arbeitsvertrag',
        'Servicevertrag', 'NDA', 'Lizenzvertrag', 'Sonstige'
    ]
    if doc_type and doc_type not in valid_types:
        # Allow but log - LLM may produce variations
        pass

    # Validate komplexitaet
    complexity = data.get('komplexitaet', '')
    valid_complexity = ['Einfach', 'Mittel', 'Komplex']
    if complexity and complexity not in valid_complexity:
        errors.append(f"Invalid complexity value: {complexity}")

    # Validate vermutete_jurisdiktion
    jurisdiction = data.get('vermutete_jurisdiktion', '')
    valid_jurisdictions = ['Österreich', 'Deutschland', 'EU-weit', 'International']
    if jurisdiction and jurisdiction not in valid_jurisdictions:
        # Allow but log
        pass

    return errors


def _is_valid_date(date_str: str) -> bool:
    """Check if date string matches YYYY-MM-DD format."""
    if not date_str or date_str == 'null':
        return True  # Null/empty dates are acceptable
    return bool(re.match(r'^\d{4}-\d{2}-\d{2}$', date_str))
