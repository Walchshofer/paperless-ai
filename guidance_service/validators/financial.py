"""Financial Document Extraction Validator.

Validates outputs from financial_extractor template.
Handles invoice/financial document validation with:
- Party information (rechnungssteller, empfaenger)
- Dates (rechnungsdatum, faelligkeitsdatum)
- Amounts (summe_netto, steuerbetrag, summe_brutto)
- Tag suggestions and tagging metadata
"""

import re
from typing import Any, Dict, List, Optional


def _coerce_float(
    value: Any,
    field_name: str,
    errors: List[str],
) -> Optional[float]:
    """Convert value to float with error handling.

    Args:
        value: Value to convert
        field_name: Name of field (for error messages)
        errors: Errors list (mutated)

    Returns:
        Float value or None if invalid
    """
    if value is None:
        errors.append(f"Missing numeric field: {field_name}")
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        errors.append(
            f"Invalid numeric value for {field_name}: {value}"
        )
        return None


def validate_financial_extraction(
    data: Dict[str, Any],
) -> Dict[str, Any]:
    """Validate output from financial_extractor template.

    Handles:
    - ist_valide (boolean flag)
    - konform (compliance flag)
    - parteien (parties: rechnungssteller, empfaenger)
    - daten (dates: rechnungsdatum, faelligkeitsdatum)
    - betraege (amounts: summe_netto, steuerbetrag,
      summe_brutto, steuersatz)
    - Tag suggestions and tagging metadata

    Args:
        data: Extraction result from Guidance template

    Returns:
        Dict with keys:
            - valid (bool): True if no errors
            - errors (List[str]): Critical validation failures
            - warnings (List[str]): Non-critical issues
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not data or not isinstance(data, dict):
        return {
            "valid": False,
            "errors": ["Empty extraction result"],
            "warnings": warnings,
        }

    # Check for simple boolean-only outputs
    if "ist_valide" in data:
        if not isinstance(data.get("ist_valide"), bool):
            errors.append("ist_valide must be a boolean")
        _validate_tag_fields(data, warnings, errors, "financial")
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    if "konform" in data:
        if not isinstance(data.get("konform"), bool):
            errors.append("konform must be a boolean")
        _validate_tag_fields(data, warnings, errors, "financial")
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    # Validate parteien (parties)
    parties = data.get("parteien", {})
    if not isinstance(parties, dict) or (
        "rechnungssteller" not in parties
    ):
        errors.append("Missing parteien.rechnungssteller")
        issuer: Dict[str, Any] = {}
    else:
        issuer = (
            parties.get("rechnungssteller", {})
            if isinstance(parties, dict)
            else {}
        )
        if not issuer.get("name"):
            errors.append("Missing rechnungssteller.name")
        if not issuer.get("uid"):
            errors.append("Missing rechnungssteller.uid")

    uid = (
        issuer.get("uid")
        if isinstance(issuer, dict)
        else None
    )
    if uid and not re.match(r"^ATU\d{8}$", uid):
        warnings.append(f"Invalid AT-UID format: {uid}")

    # Validate daten (dates)
    dates = data.get("daten", {})
    if not isinstance(dates, dict) or (
        not dates.get("rechnungsdatum")
    ):
        errors.append("Missing rechnungsdatum")

    # Validate betraege (amounts)
    amounts = data.get("betraege", {})
    if not isinstance(amounts, dict):
        errors.append("Missing betraege section")
        _validate_tag_fields(data, warnings, errors, "financial")
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    net = _coerce_float(
        amounts.get("summe_netto"),
        "summe_netto",
        errors,
    )
    tax = _coerce_float(
        amounts.get("steuerbetrag"),
        "steuerbetrag",
        errors,
    )
    gross = _coerce_float(
        amounts.get("summe_brutto"),
        "summe_brutto",
        errors,
    )
    _coerce_float(
        amounts.get("steuersatz"),
        "steuersatz",
        errors,
    )

    # Validate math: net + tax = gross
    if (
        net is not None
        and tax is not None
        and gross is not None
    ):
        if abs((net + tax) - gross) > 0.05:
            errors.append(
                f"Math Error: {net}+{tax}!={gross}"
            )

    _validate_tag_fields(data, warnings, errors, "financial")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def _validate_tag_fields(
    data: Dict[str, Any],
    warnings: List[str],
    errors: List[str],
    domain: str,
) -> None:
    """Validate tagging fields (suggested_tags, missing_tags, etc.).

    Args:
        data: Extraction result
        warnings: Warnings list (mutated)
        errors: Errors list (mutated)
        domain: Expected domain ("financial", "medical", etc.)
    """
    suggested = data.get("suggested_tags")
    if suggested is not None and not isinstance(suggested, list):
        errors.append("suggested_tags must be a list")
    elif isinstance(suggested, list):
        if any(not isinstance(tag, str) for tag in suggested):
            warnings.append(
                "suggested_tags contains non-string entries"
            )

    missing = data.get("missing_tags")
    if missing is not None and not isinstance(missing, list):
        errors.append("missing_tags must be a list")
    elif isinstance(missing, list):
        if any(not isinstance(tag, str) for tag in missing):
            warnings.append(
                "missing_tags contains non-string entries"
            )

    tagging = data.get("tagging")
    if tagging is None:
        return

    if not isinstance(tagging, dict):
        warnings.append("tagging must be an object")
        return

    tag_domain = tagging.get("domain")
    if tag_domain and str(tag_domain).lower() != domain:
        warnings.append(
            f"tagging.domain '{tag_domain}' does not match "
            f"'{domain}'"
        )

    if not tagging.get("source"):
        warnings.append("tagging.source is missing")

    confidence = tagging.get("confidence")
    if confidence is None:
        return

    if not isinstance(confidence, dict):
        warnings.append("tagging.confidence must be an object")
        return

    overall = confidence.get("overall")
    if overall is not None:
        try:
            value = float(overall)
            if value < 0 or value > 1:
                warnings.append(
                    f"tagging.confidence.overall out of range: "
                    f"{overall}"
                )
        except (TypeError, ValueError):
            warnings.append(
                "tagging.confidence.overall is not a number"
            )
