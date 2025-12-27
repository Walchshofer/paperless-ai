def validate_legal_extraction(data):
    errors = []
    if not data.get('partei_1') or not data.get('partei_2'):
        errors.append("Vertragsparteien unvollständig")
    return {'valid': len(errors) == 0, 'errors': errors}