import re
def validate_financial_extraction(data):
    errors = []
    uid = data.get('parteien', {}).get('rechnungssteller', {}).get('uid')
    if uid and not re.match(r'^ATU\d{8}$', uid): errors.append(f"Invalid AT-UID: {uid}")
    
    amts = data.get('betraege', {})
    net = float(amts.get('summe_netto', 0))
    tax = float(amts.get('steuerbetrag', 0))
    gross = float(amts.get('summe_brutto', 0))
    if abs((net + tax) - gross) > 0.05: errors.append(f"Math Error: {net}+{tax}!={gross}")
    
    return {'valid': len(errors) == 0, 'errors': errors}