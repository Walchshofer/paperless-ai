"""Financial Document Extraction Validator.

Validates outputs from financial_extractor and related templates.
Handles invoice/financial document validation with:
- Party information (rechnungssteller)
- Dates (rechnungsdatum)
- Amounts (summe_netto, steuerbetrag, summe_brutto, steuersatz)
- Tag suggestions and tagging metadata
- Mathematical validation (netto + steuer = brutto)

Best Practices Applied:
- Pydantic validation integration
- Type-safe float comparisons
- Comprehensive logging
- Clear error/warning distinction
"""

import logging
import re
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel, ValidationError

# Import schemas from financial_de template
from templates.financial_de import (
    FinancialExtractorOutput,
    FinancialReasonerOutput,
    VatExpertOutput,
)

logger = logging.getLogger(__name__)

# Valid enumeration values
VALID_TAX_RATES = [0.0, 10.0, 19.0, 20.0]  # Common Austrian/German rates
VALID_AT_UID_PATTERN = r"^ATU\d{8}$"

# Float comparison tolerance (0.05 cents)
FLOAT_TOLERANCE = 0.05


class ValidationResult:
    """Structured validation result."""

    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.schema_type: Optional[str] = None

    @property
    def valid(self) -> bool:
        """Return True if no critical errors."""
        return len(self.errors) == 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "schema_type": self.schema_type,
        }


def validate_financial_extraction(
    data: Dict[str, Any],
) -> Dict[str, Any]:
    """Validate output from financial templates.

    Handles:
    - ist_valide (boolean - reasoner output)
    - konform (boolean - VAT compliance)
    - parteien (parties: rechnungssteller)
    - daten (dates: rechnungsdatum)
    - betraege (amounts: summe_netto, steuerbetrag,
      summe_brutto, steuersatz)
    - Tag suggestions and tagging metadata

    Args:
        data: Extraction result from Guidance template

    Returns:
        Dict with valid, errors, warnings, schema_type
    """
    result = ValidationResult()

    try:
        if not data or not isinstance(data, dict):
            result.errors.append("Empty or non-dict extraction result")
            logger.warning("Empty extraction result")
            return result.to_dict()

        # Step 1: Detect schema type
        schema_type, schema_class = _detect_schema(data)
        result.schema_type = schema_type

        if schema_class:
            logger.debug(f"Detected schema: {schema_type}")
            try:
                # Pydantic validates structure, types, constraints
                validated_data = schema_class.model_validate(data)
                logger.debug(f"{schema_type} passed Pydantic validation")

                # Data is structurally valid, check business logic
                _validate_business_logic(
                    validated_data.model_dump(),
                    schema_type,
                    result,
                )

            except ValidationError as e:
                # Pydantic validation failed
                for error in e.errors():
                    field_path = ".".join(str(x) for x in error["loc"])
                    msg = error["msg"]
                    result.errors.append(
                        f"Pydantic validation ({field_path}): {msg}"
                    )
                logger.error(
                    f"Pydantic validation failed: {e.error_count()} errors"
                )
        else:
            # Unknown schema - minimal validation
            result.warnings.append(
                "Unable to determine financial template type - "
                "skipping Pydantic validation"
            )
            logger.warning("Unknown schema type for validation")

    except Exception as e:
        result.errors.append(
            f"Financial validation exception: "
            f"{type(e).__name__}: {str(e)}"
        )
        logger.exception("Unexpected error during validation")

    return result.to_dict()


def _detect_schema(
    data: Dict[str, Any],
) -> tuple[Optional[str], Optional[Type[BaseModel]]]:
    """Detect which schema this data conforms to.

    Args:
        data: Extraction data

    Returns:
        Tuple of (schema_name, schema_class) or (None, None)
    """
    # Check for extractor output
    if "parteien" in data and "betraege" in data:
        return ("financial_extractor", FinancialExtractorOutput)

    # Check for reasoner output
    if "ist_valide" in data and len(data) == 1:
        return ("financial_reasoner", FinancialReasonerOutput)

    # Check for VAT output
    if "konform" in data and len(data) == 1:
        return ("vat_expert", VatExpertOutput)

    return (None, None)


def _validate_business_logic(
    data: Dict[str, Any],
    schema_type: str,
    result: ValidationResult,
) -> None:
    """Validate business logic beyond Pydantic schema.

    Args:
        data: Validated data
        schema_type: Schema type identifier
        result: ValidationResult to mutate
    """
    if schema_type == "financial_extractor":
        _validate_extractor_logic(data, result)
    elif schema_type == "financial_reasoner":
        _validate_reasoner_logic(data, result)
    elif schema_type == "vat_expert":
        _validate_vat_logic(data, result)


def _validate_extractor_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for extractor output.

    Args:
        data: Validated extractor data
        result: ValidationResult to mutate
    """
    # Party sanity checks
    parties = data.get("parteien", {})
    issuer = parties.get("rechnungssteller", {})
    issuer_name = issuer.get("name", "").strip()
    issuer_uid = issuer.get("uid", "").strip()

    if len(issuer_name) < 2:
        result.warnings.append(
            "Issuer name suspiciously short (< 2 chars)"
        )

    # Validate UID format (Austrian)
    if issuer_uid and not re.match(VALID_AT_UID_PATTERN, issuer_uid):
        result.warnings.append(
            f"Invalid Austrian UID format: {issuer_uid}. "
            f"Expected format: ATUxxxxxxxx"
        )

    # Date sanity checks
    dates = data.get("daten", {})
    rechnungsdatum = dates.get("rechnungsdatum", "").strip()

    if rechnungsdatum and not _is_valid_date(rechnungsdatum):
        result.errors.append(
            f"Invalid rechnungsdatum format: {rechnungsdatum}"
        )

    # Amount sanity checks
    amounts = data.get("betraege", {})
    netto = amounts.get("summe_netto", 0)
    steuersatz = amounts.get("steuersatz", 0)
    steuerbetrag = amounts.get("steuerbetrag", 0)
    brutto = amounts.get("summe_brutto", 0)

    # Check for negative amounts
    if netto < 0:
        result.warnings.append(f"Negative netto amount: {netto}")
    if brutto < 0:
        result.warnings.append(f"Negative brutto amount: {brutto}")

    # Validate tax rate
    if steuersatz not in VALID_TAX_RATES:
        result.warnings.append(
            f"Unusual tax rate: {steuersatz}%. "
            f"Expected one of {VALID_TAX_RATES}"
        )

    # Math validation: netto + steuerbetrag ≈ brutto
    expected_brutto = netto + steuerbetrag
    if abs(expected_brutto - brutto) > FLOAT_TOLERANCE:
        result.errors.append(
            f"Math mismatch: {netto} + {steuerbetrag} "
            f"= {expected_brutto}, but brutto = {brutto}"
        )

    # Validate tag fields
    _validate_tag_fields(data, result)


def _validate_reasoner_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for reasoner output.

    Args:
        data: Validated reasoner data
        result: ValidationResult to mutate
    """
    ist_valide = data.get("ist_valide")
    _validate_tag_fields(data, result)

    if not ist_valide:
        result.warnings.append(
            "Reasoner marked amounts as invalid"
        )


def _validate_vat_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for VAT output.

    Args:
        data: Validated VAT data
        result: ValidationResult to mutate
    """
    konform = data.get("konform")
    _validate_tag_fields(data, result)

    if not konform:
        result.warnings.append(
            "VAT analyzer marked compliance as not conformant"
        )


def _is_valid_date(date_str: str) -> bool:
    """Validate date string in YYYY-MM-DD format.

    Args:
        date_str: Date string to validate

    Returns:
        True if valid YYYY-MM-DD format, False otherwise

    Examples:
        >>> _is_valid_date("2024-01-15")
        True
        >>> _is_valid_date("15/01/2024")
        False
        >>> _is_valid_date("")
        False
    """
    if not date_str or date_str == "null":
        return False  # Require actual date

    # Match YYYY-MM-DD pattern
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return False

    # Validate date bounds
    try:
        year, month, day = map(int, date_str.split("-"))
        if not (1 <= month <= 12 and 1 <= day <= 31):
            return False
        return True
    except ValueError:
        return False


def _validate_tag_fields(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate tagging fields (suggested_tags, missing_tags, etc.).

    Args:
        data: Extraction result
        result: ValidationResult to mutate
    """
    suggested = data.get("suggested_tags")
    if suggested is not None and not isinstance(suggested, list):
        result.errors.append("suggested_tags must be a list")
    elif isinstance(suggested, list):
        if any(not isinstance(tag, str) for tag in suggested):
            result.warnings.append(
                "suggested_tags contains non-string entries"
            )

    missing = data.get("missing_tags")
    if missing is not None and not isinstance(missing, list):
        result.errors.append("missing_tags must be a list")
    elif isinstance(missing, list):
        if any(not isinstance(tag, str) for tag in missing):
            result.warnings.append(
                "missing_tags contains non-string entries"
            )

    tagging = data.get("tagging")
    if tagging is None:
        return

    if not isinstance(tagging, dict):
        result.warnings.append("tagging must be an object")
        return

    tag_domain = tagging.get("domain")
    if tag_domain and str(tag_domain).lower() != "financial":
        result.warnings.append(
            f"tagging.domain '{tag_domain}' does not match 'financial'"
        )

    if not tagging.get("source"):
        result.warnings.append("tagging.source is missing")

    confidence = tagging.get("confidence")
    if confidence is None:
        return

    if not isinstance(confidence, dict):
        result.warnings.append("tagging.confidence must be an object")
        return

    overall = confidence.get("overall")
    if overall is not None:
        try:
            value = float(overall)
            if value < 0 or value > 1:
                result.warnings.append(
                    f"tagging.confidence.overall out of range: {overall}"
                )
        except (TypeError, ValueError):
            result.warnings.append(
                "tagging.confidence.overall is not a number"
            )


# ============================================================================
# Testing
# ============================================================================


def test_validate_financial_extraction() -> None:
    """Test validator with sample data."""
    # Test extractor output
    extractor_data = {
        "parteien": {
            "rechnungssteller": {
                "name": "Company A GmbH",
                "uid": "ATU12345678",
            }
        },
        "daten": {
            "rechnungsdatum": "2024-01-15",
        },
        "betraege": {
            "summe_netto": 100.00,
            "steuersatz": 19.0,
            "steuerbetrag": 19.00,
            "summe_brutto": 119.00,
        },
    }

    result = validate_financial_extraction(extractor_data)
    logger.info(f"Extractor validation: {result}")
    assert result["valid"], "Extractor output should be valid"

    # Test reasoner output
    reasoner_data = {
        "ist_valide": True,
    }

    result = validate_financial_extraction(reasoner_data)
    logger.info(f"Reasoner validation: {result}")
    assert result["valid"], "Reasoner output should be valid"

    # Test with math error
    invalid_data = {
        "parteien": {
            "rechnungssteller": {
                "name": "Company A",
                "uid": "ATU12345678",
            }
        },
        "daten": {
            "rechnungsdatum": "2024-01-15",
        },
        "betraege": {
            "summe_netto": 100.00,
            "steuersatz": 19.0,
            "steuerbetrag": 19.00,
            "summe_brutto": 150.00,  # Wrong!
        },
    }

    result = validate_financial_extraction(invalid_data)
    logger.info(f"Invalid data validation: {result}")
    assert not result["valid"], "Math error should fail validation"


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.DEBUG,
    )
    test_validate_financial_extraction()
