import re
from typing import Dict


def validate_medical_extraction(data: Dict) -> Dict:
    errors = []
    warnings = []

    try:
        if not data or not isinstance(data, dict):
            return {'valid': False, 'errors': ['Empty extraction result'], 'warnings': warnings}

        if 'dokumenttyp' in data:
            doc_type = data.get('dokumenttyp', '')
            valid_types = [
                'Laborbefund',
                'Radiologiebericht',
                'Klinische Notiz',
                'Krankenkassenbeleg',
                'Sonstige',
            ]
            if doc_type and doc_type not in valid_types:
                warnings.append(f"Document type '{doc_type}' not in standard list")
        elif 'primaerdiagnose' in data:
            if not data.get('primaerdiagnose'):
                warnings.append('Primary diagnosis (primaerdiagnose) is missing')
        else:
            patient = data.get('patient', {})
            if not patient or not patient.get('name'):
                errors.append('Patient name missing')

            dob = patient.get('geburtsdatum') if isinstance(patient, dict) else None
            if dob and not re.match(r'^\d{4}-\d{2}-\d{2}$', dob):
                warnings.append(f'Invalid date format (geburtsdatum): {dob}')

            diagnoses = data.get('diagnosen', [])
            if not isinstance(diagnoses, list):
                errors.append('Diagnosen must be a list')
            else:
                for dx in diagnoses:
                    if not isinstance(dx, dict):
                        warnings.append('Diagnosis entry is not an object')
                        continue
                    icd10 = dx.get('icd10')
                    if icd10 and not re.match(r'^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?$', icd10):
                        warnings.append(f'Invalid ICD-10: {icd10}')

            for field in ['medikamente', 'laborwerte']:
                value = data.get(field)
                if value is not None and not isinstance(value, list):
                    errors.append(f'{field} must be a list')

        confidence = data.get('vertrauen')
        if confidence is not None:
            try:
                conf_val = float(confidence)
                if not (0.0 <= conf_val <= 1.0):
                    warnings.append(f'Confidence score out of range: {confidence}')
            except (ValueError, TypeError):
                errors.append(f'Invalid confidence format: {confidence}')

        return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings}
    except Exception as e:
        return {'valid': False, 'errors': [str(e)], 'warnings': warnings}
