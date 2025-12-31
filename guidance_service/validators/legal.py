"""Legal Document Extraction Validator (v2).

Validates outputs from legal_classifier, legal_extractor, and
legal_validator templates. Aligned with templates/legal_de.py schema.

Supports two validation modes:
- STRICT (default): Full schema validation required; partial outputs fail
- PERMISSIVE (opt-in): Partial extractors accepted with warnings

Best Practices Applied:
- Leverage Pydantic validation first
- Distinguish between schema validation and business logic validation
- Comprehensive logging
- Type safety with type hints
- Explicit partial detection (not string-based)
"""

import logging
import os
import re
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel, ValidationError

# Import schemas from legal_de template
from templates.legal_de import (
    LegalClassifierOutput,
    LegalExtractorOutput,
    LegalValidatorOutput,
)

logger = logging.getLogger(__name__)

# Validation mode (set via environment or function parameter)
VALIDATION_MODE = os.getenv(
    "LEGAL_VALIDATOR_MODE", "strict"
).lower()

# Valid enumeration values
VALID_DOC_TYPES = {
    "Kaufvertrag",
    "Mietvertrag",
    "Arbeitsvertrag",
    "Servicevertrag",
    "NDA",
    "Lizenzvertrag",
    "Sonstige",
}

VALID_COMPLEXITY = {"Einfach", "Mittel", "Komplex"}

VALID_JURISDICTIONS = {
    "Österreich",
    "Deutschland",
    "EU-weit",
    "International",
}

VALID_APPLICABLE_LAW = {
    "Österreich (ABGB)",
    "Deutschland (BGB)",
    "Schweiz (ZGB)",
    "Europäisches Recht",
    "Schiedsverfahren",
}

# Date validation pattern
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class ValidationResult:
    """Structured validation result.

    Attributes:
        errors: Critical validation failures
        warnings: Non-critical issues
        schema_type: Detected schema type (classifier/extractor/validator)
        partial: True if output is partial but accepted (permissive mode only)
    """

    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.schema_type: Optional[str] = None
        self.partial: bool = False

    @property
    def valid(self) -> bool:
        """Return True if no critical errors."""
        return len(self.errors) == 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary.

        Returns:
            Dict with valid, errors, warnings, schema_type, partial
        """
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "schema_type": self.schema_type,
            "partial": self.partial,
        }


def validate_legal_extraction(
    data: Dict[str, Any],
    mode: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate output from Legal Extraction templates.

    Strategy:
    1. Detect schema type with heuristics (most specific first)
    2. Attempt Pydantic validation with detected schema
    3. If Pydantic fails on extractor in permissive mode, check
       partial heuristic; otherwise return errors
    4. Validate business logic if structurally valid
    5. Validate tag fields if present

    Args:
        data: Extraction result from Guidance template
        mode: Validation mode ('strict' or 'permissive').
              If None, uses VALIDATION_MODE env var (default 'strict')

    Returns:
        Dict with valid, errors, warnings, schema_type, partial
    """
    result = ValidationResult()
    validation_mode = (mode or VALIDATION_MODE).lower()

    if validation_mode not in ("strict", "permissive"):
        logger.warning(
            f"Unknown validation mode '{validation_mode}'; "
            f"defaulting to 'strict'"
        )
        validation_mode = "strict"

    try:
        if not data or not isinstance(data, dict):
            result.errors.append("Empty or non-dict extraction result")
            logger.warning("Empty extraction result")
            return result.to_dict()

        # Step 1: Detect schema type and validate with Pydantic
        schema_type, schema_class = _detect_schema(data)
        result.schema_type = schema_type

        if schema_class:
            logger.debug(f"Detected schema: {schema_type}")
            try:
                # Pydantic validates all fields, types, constraints
                validated_data = schema_class.model_validate(data)
                logger.debug(
                    f"{schema_type} passed Pydantic validation"
                )

                # Data is structurally valid, check business logic
                _validate_business_logic(
                    validated_data.model_dump(),
                    schema_type,
                    result,
                )

                # Validate tag fields
                _validate_tag_fields(data, result)

            except ValidationError as e:
                # Pydantic validation failed
                # Check if this is a partial extractor
                is_partial = (
                    schema_type == "legal_extractor"
                    and _is_partial_extractor(data)
                )

                # Permissive mode: accept partial extractors
                if validation_mode == "permissive" and is_partial:
                    logger.info(
                        "Partial extractor accepted in permissive mode"
                    )
                    result.partial = True
                    result.warnings.append(
                        "Partial extractor: accepting in permissive mode "
                        "despite missing required fields"
                    )
                    # Validate what we have
                    _validate_partial_extractor_logic(data, result)
                    # Still validate tag fields
                    _validate_tag_fields(data, result)
                else:
                    # Full validation failure (strict mode or non-extractor)
                    # Append mode-aware warning for strict partial extractor
                    if is_partial and validation_mode == "strict":
                        result.warnings.append(
                            "Detected partial extractor payload "
                            "(2/3 core fields present); "
                            "strict mode requires full schema validation"
                        )
                        logger.debug(
                            "Partial extractor rejected in strict mode"
                        )

                    # Append Pydantic validation errors
                    for error in e.errors():
                        field_path = ".".join(
                            str(x) for x in error["loc"]
                        )
                        msg = error["msg"]
                        result.errors.append(
                            f"Pydantic validation "
                            f"({field_path}): {msg}"
                        )
                    logger.error(
                        f"Pydantic validation failed: "
                        f"{e.error_count()} errors"
                    )
        else:
            # Unknown schema
            result.warnings.append(
                "Unable to determine legal template type - "
                "skipping Pydantic validation"
            )
            keys = sorted(data.keys())
            logger.warning(
                "Unknown schema type for validation. Keys: %s",
                keys,
            )

    except Exception as e:
        result.errors.append(
            f"Legal validation exception: "
            f"{type(e).__name__}: {str(e)}"
        )
        logger.exception("Unexpected error during validation")

    return result.to_dict()


def _detect_schema(
    data: Dict[str, Any],
) -> tuple[Optional[str], Optional[Type[BaseModel]]]:
    """Detect which schema this data conforms to.

    Uses multiple field checks for robustness. Extractor detection
    requires at least 2 of 3 core fields, reducing false negatives
    for partial outputs.

    Order of detection (most specific first):
    1. legal_validator: "valid" + "issues"
    2. legal_classifier: "dokumenttyp" + "komplexitaet"
    3. legal_extractor: 2+ of {vertragsparteien, daten, jurisdiktion_und_recht}

    Args:
        data: Extraction data

    Returns:
        Tuple of (schema_name, schema_class) or (None, None)
    """
    # Check for validator output (most specific, check first)
    if "valid" in data and "issues" in data:
        return ("legal_validator", LegalValidatorOutput)

    # Check for classifier output
    if "dokumenttyp" in data and "komplexitaet" in data:
        return ("legal_classifier", LegalClassifierOutput)

    # Check for extractor output
    # Requires 2+ of: vertragsparteien, daten, jurisdiktion_und_recht
    extractor_fields = {
        "vertragsparteien",
        "daten",
        "jurisdiktion_und_recht",
    }
    if len(data.keys() & extractor_fields) >= 2:
        return ("legal_extractor", LegalExtractorOutput)

    return (None, None)


def _is_partial_extractor(data: Dict[str, Any]) -> bool:
    """Check if data matches partial extractor heuristic.

    Partial extractor has 2+ of 3 core fields but may be missing
    some nested required fields.

    Args:
        data: Extraction data

    Returns:
        True if partial extractor pattern detected
    """
    extractor_fields = {
        "vertragsparteien",
        "daten",
        "jurisdiktion_und_recht",
    }
    core_field_count = len(data.keys() & extractor_fields)
    return 2 <= core_field_count < 3


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
    if schema_type == "legal_extractor":
        _validate_extractor_logic(data, result)
    elif schema_type == "legal_classifier":
        _validate_classifier_logic(data, result)
    elif schema_type == "legal_validator":
        _validate_validator_logic(data, result)


def _validate_extractor_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for extractor output.

    Args:
        data: Validated extractor data
        result: ValidationResult to mutate
    """
    # Parties sanity checks
    parties = data.get("vertragsparteien", {})
    if not isinstance(parties, dict):
        result.errors.append("vertragsparteien must be an object")
        return

    partei_1 = parties.get("partei_1", "").strip()
    partei_2 = parties.get("partei_2", "").strip()

    if len(partei_1) < 2:
        result.warnings.append(
            "Party 1 name suspiciously short (< 2 chars)"
        )
    if len(partei_2) < 2:
        result.warnings.append(
            "Party 2 name suspiciously short (< 2 chars)"
        )
    if partei_1.lower() == partei_2.lower():
        result.warnings.append("Party 1 and Party 2 are identical")

    # Date sanity checks
    dates = data.get("daten", {})
    if not isinstance(dates, dict):
        result.errors.append("daten must be an object")
        return

    abschluss = dates.get("abschluss_datum", "")
    gueltig_ab = dates.get("gueltig_ab", "")

    if abschluss and not _is_valid_date(abschluss):
        result.errors.append(
            f"Invalid abschluss_datum format: {abschluss}"
        )
    if gueltig_ab and not _is_valid_date(gueltig_ab):
        result.errors.append(
            f"Invalid gueltig_ab format: {gueltig_ab}"
        )

    # Date logic check
    if abschluss and gueltig_ab:
        try:
            abs_date = abschluss.split("-")
            gueltig_date = gueltig_ab.split("-")
            if abs_date > gueltig_date:
                result.warnings.append(
                    "abschluss_datum is after gueltig_ab"
                )
        except (ValueError, IndexError):
            pass  # Already caught above

    # Jurisdiction validation
    jurisdiction = data.get("jurisdiktion_und_recht", {})
    if not isinstance(jurisdiction, dict):
        result.errors.append(
            "jurisdiktion_und_recht must be an object"
        )
        return

    applicable_law = jurisdiction.get("anwendbares_recht", "")
    if applicable_law not in VALID_APPLICABLE_LAW:
        result.warnings.append(
            f"Unexpected applicable law: {applicable_law}"
        )


def _validate_partial_extractor_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate partial extractor output (permissive mode only).

    Only validates fields that are present. Missing nested fields
    are logged as warnings, not errors.

    Args:
        data: Partial extractor data
        result: ValidationResult to mutate
    """
    # Parties validation (if present)
    parties = data.get("vertragsparteien", {})
    if isinstance(parties, dict):
        partei_1 = parties.get("partei_1", "").strip()
        partei_2 = parties.get("partei_2", "").strip()

        if partei_1 and len(partei_1) < 2:
            result.warnings.append(
                "Party 1 name suspiciously short (< 2 chars)"
            )
        if partei_2 and len(partei_2) < 2:
            result.warnings.append(
                "Party 2 name suspiciously short (< 2 chars)"
            )
        if partei_1 and partei_2 and (
            partei_1.lower() == partei_2.lower()
        ):
            result.warnings.append(
                "Party 1 and Party 2 are identical"
            )
    else:
        if "vertragsparteien" in data:
            result.warnings.append(
                "vertragsparteien not present or invalid"
            )

    # Dates validation (if present)
    dates = data.get("daten", {})
    if isinstance(dates, dict):
        abschluss = dates.get("abschluss_datum", "")
        gueltig_ab = dates.get("gueltig_ab", "")

        if abschluss and not _is_valid_date(abschluss):
            result.warnings.append(
                f"Invalid abschluss_datum format: {abschluss}"
            )
        if gueltig_ab and not _is_valid_date(gueltig_ab):
            result.warnings.append(
                f"Invalid gueltig_ab format: {gueltig_ab}"
            )
    else:
        if "daten" in data:
            result.warnings.append(
                "daten not present or invalid"
            )

    # Jurisdiction validation (if present)
    jurisdiction = data.get("jurisdiktion_und_recht", {})
    if isinstance(jurisdiction, dict):
        applicable_law = jurisdiction.get("anwendbares_recht", "")
        if (
            applicable_law
            and applicable_law not in VALID_APPLICABLE_LAW
        ):
            result.warnings.append(
                f"Unexpected applicable law: {applicable_law}"
            )
    else:
        if "jurisdiktion_und_recht" in data:
            result.warnings.append(
                "jurisdiktion_und_recht not present or invalid"
            )

    # Confidence check (if present)
    confidence = data.get("vertrauen")
    if confidence is not None:
        try:
            conf_val = float(confidence)
            if conf_val < 0.5:
                result.warnings.append(
                    f"Low confidence partial extractor: {conf_val}"
                )
        except (TypeError, ValueError):
            result.warnings.append(
                f"Invalid confidence format: {confidence}"
            )


def _validate_classifier_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for classifier output.

    Args:
        data: Validated classifier data
        result: ValidationResult to mutate
    """
    # Document type check
    doc_type = data.get("dokumenttyp", "")
    if doc_type not in VALID_DOC_TYPES:
        result.warnings.append(
            f"Non-standard document type: {doc_type}"
        )

    # Complexity check
    complexity = data.get("komplexitaet", "")
    if complexity not in VALID_COMPLEXITY:
        result.warnings.append(
            f"Non-standard complexity value: {complexity}"
        )

    # Jurisdiction check
    jurisdiction = data.get("vermutete_jurisdiktion", "")
    if jurisdiction not in VALID_JURISDICTIONS:
        result.warnings.append(
            f"Non-standard jurisdiction: {jurisdiction}"
        )

    # Confidence checks
    confidence = data.get("vertrauen", 0)
    if confidence < 0.5:
        result.warnings.append(
            f"Low confidence classifier result: {confidence}"
        )


def _validate_validator_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for validator output.

    Args:
        data: Validated validator data
        result: ValidationResult to mutate
    """
    valid_flag = data.get("valid")
    issues = data.get("issues", [])

    if not isinstance(issues, list):
        result.errors.append("issues must be a list")
        return

    if not valid_flag and not issues:
        result.warnings.append(
            "Validator marked invalid but provided no issues"
        )
    if valid_flag and issues:
        result.warnings.append(
            "Validator marked valid but listed issues"
        )

    # Confidence check
    confidence = data.get("vertrauen", 0)
    if confidence < 0.5:
        result.warnings.append(
            f"Low confidence validator result: {confidence}"
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
    if not re.match(DATE_PATTERN, date_str):
        return False

    # Validate date bounds
    try:
        year, month, day = map(int, date_str.split("-"))
        if not (1 <= month <= 12 and 1 <= day <= 31):
            return False
        # Additional year sanity check
        if year < 1900 or year > 2100:
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
    if tag_domain and str(tag_domain).lower() != "legal":
        result.warnings.append(
            f"tagging.domain '{tag_domain}' does not match 'legal'"
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
                    f"tagging.confidence.overall out of range: "
                    f"{overall}"
                )
        except (TypeError, ValueError):
            result.warnings.append(
                "tagging.confidence.overall is not a number"
            )


# ============================================================================
# Testing
# ============================================================================


def test_validate_legal_extraction() -> None:
    """Test validator with sample data in both modes."""
    # Test extractor output (complete)
    extractor_data = {
        "vertragsparteien": {
            "partei_1": "Company A GmbH",
            "partei_2": "Company B AG",
        },
        "daten": {
            "abschluss_datum": "2024-01-15",
            "gueltig_ab": "2024-02-01",
        },
        "jurisdiktion_und_recht": {
            "anwendbares_recht": "Deutschland (BGB)",
        },
        "vertrauen": 0.95,
    }

    result = validate_legal_extraction(extractor_data, mode="strict")
    logger.info(f"Complete extractor validation (strict): {result}")
    assert result["valid"], "Complete extractor output should be valid"
    assert result["schema_type"] == "legal_extractor"
    assert not result["partial"], "Complete output should not be partial"

    # Test classifier output
    classifier_data = {
        "dokumenttyp": "Kaufvertrag",
        "komplexitaet": "Mittel",
        "vermutete_jurisdiktion": "Deutschland",
        "vertrauen": 0.88,
    }

    result = validate_legal_extraction(classifier_data, mode="strict")
    logger.info(f"Classifier validation: {result}")
    assert result["valid"], "Classifier output should be valid"
    assert result["schema_type"] == "legal_classifier"

    # Test validator output
    validator_data = {
        "valid": True,
        "issues": [],
        "vertrauen": 0.92,
    }

    result = validate_legal_extraction(validator_data, mode="strict")
    logger.info(f"Validator validation: {result}")
    assert result["valid"], "Validator output should be valid"
    assert result["schema_type"] == "legal_validator"

    # Test partial extractor in STRICT mode (should fail)
    partial_extractor = {
        "vertragsparteien": {
            "partei_1": "Company A",
            "partei_2": "Company B",
        },
        "daten": {
            "abschluss_datum": "2024-01-15",
            "gueltig_ab": "2024-02-01",
        },
        # Missing: jurisdiktion_und_recht
        "vertrauen": 0.85,
    }

    result = validate_legal_extraction(partial_extractor, mode="strict")
    logger.info(f"Partial extractor (strict mode): {result}")
    assert not result["valid"], "Partial should fail in strict mode"
    assert result["schema_type"] == "legal_extractor"
    assert result["partial"] is False
    assert any(
        "partial" in w.lower() for w in result["warnings"]
    ), "Should warn about partial payload"

    # Test partial extractor in PERMISSIVE mode (should succeed)
    result = validate_legal_extraction(partial_extractor, mode="permissive")
    logger.info(f"Partial extractor (permissive mode): {result}")
    assert result["valid"], "Partial should pass in permissive mode"
    assert result["schema_type"] == "legal_extractor"
    assert result["partial"] is True, "Should mark as partial"

    # Test with invalid date
    invalid_extractor = {
        "vertragsparteien": {
            "partei_1": "Company A",
            "partei_2": "Company B",
        },
        "daten": {
            "abschluss_datum": "15/01/2024",  # Wrong format
            "gueltig_ab": "2024-02-01",
        },
        "jurisdiktion_und_recht": {
            "anwendbares_recht": "Deutschland (BGB)",
        },
        "vertrauen": 0.5,
    }

    result = validate_legal_extraction(invalid_extractor, mode="strict")
    logger.info(f"Invalid date validation: {result}")
    assert not result["valid"], "Invalid date should fail validation"

    logger.info("All tests passed!")


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.DEBUG,
    )
    test_validate_legal_extraction()
