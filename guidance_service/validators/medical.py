import re
from typing import Dict

def validate_medical_extraction(data: Dict) -> Dict:
    errors = []
    try:
        patient = data.get('patient', {})
        if not patient.get('name'): errors.append('Patient name missing')
        
        dob = patient.get('geburtsdatum')
        if dob and not re.match(r'^\d{4}-\d{2}-\d{2}$', dob): errors.append(f'Invalid date: {dob}')
        
        diagnoses = data.get('diagnosen', [])
        for dx in diagnoses:
            icd10 = dx.get('icd10')
            if icd10 and not re.match(r'^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?$', icd10):
                errors.append(f'Invalid ICD-10: {icd10}')
        
        return {'valid': len(errors) == 0, 'errors': errors}
    except Exception as e:
        return {'valid': False, 'errors': [str(e)]}