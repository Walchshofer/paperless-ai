import re
from typing import Any, Dict


def _coerce_float(value: Any, field_name: str, errors: list) -> float | None:
    if value is None:
        errors.append(f"Missing numeric field: {field_name}")
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        errors.append(f"Invalid numeric value for {field_name}: {value}")
        return None


def validate_financial_extraction(data: Dict) -> Dict:
    errors = []
    warnings = []

    if not data or not isinstance(data, dict):
        return {'valid': False, 'errors': ['Empty extraction result'], 'warnings': warnings}

    if 'ist_valide' in data:
        if not isinstance(data.get('ist_valide'), bool):
            errors.append('ist_valide must be a boolean')
        return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings}

    if 'konform' in data:
        if not isinstance(data.get('konform'), bool):
            errors.append('konform must be a boolean')
        return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings}

    parties = data.get('parteien', {})
    if not isinstance(parties, dict) or 'rechnungssteller' not in parties:
        errors.append('Missing parteien.rechnungssteller')
        issuer = {}
    else:
        issuer = parties.get('rechnungssteller', {}) if isinstance(parties, dict) else {}
        if not issuer.get('name'):
            errors.append('Missing rechnungssteller.name')
        if not issuer.get('uid'):
            errors.append('Missing rechnungssteller.uid')
    uid = issuer.get('uid') if isinstance(issuer, dict) else None
    if uid and not re.match(r'^ATU\d{8}$', uid):
        warnings.append(f"Invalid AT-UID format: {uid}")

    dates = data.get('daten', {})
    if not isinstance(dates, dict) or not dates.get('rechnungsdatum'):
        errors.append('Missing rechnungsdatum')

    amounts = data.get('betraege', {})
    if not isinstance(amounts, dict):
        errors.append('Missing betraege section')
        return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings}

    net = _coerce_float(amounts.get('summe_netto'), 'summe_netto', errors)
    tax = _coerce_float(amounts.get('steuerbetrag'), 'steuerbetrag', errors)
    gross = _coerce_float(amounts.get('summe_brutto'), 'summe_brutto', errors)
    _coerce_float(amounts.get('steuersatz'), 'steuersatz', errors)

    if net is not None and tax is not None and gross is not None:
        if abs((net + tax) - gross) > 0.05:
            errors.append(f"Math Error: {net}+{tax}!={gross}")

    return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings}
