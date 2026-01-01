"""General Document Extraction Validator.

Validates outputs from general_classifier and general_extractor
templates. Aligned with templates/general_de.py schema and Guidance
gen_json() output format.

Handles:
- GeneralClassifierOutput (dokumenttyp, sprache, themata, etc.)
- GeneralExtractorOutput (zusammenfassung, schluesselwoerter, etc.)
- CrossPipelineRouterOutput (empfehlung, begruendung, etc.)
- TaggingOutput (with suggested_tags, missing_tags, tagging metadata)

Best Practices Applied:
- Pydantic validation integration
- Type-safe validation
- Comprehensive logging
- Clear error/warning distinction
- Schema detection logic
- Strict confidence validation
- Flake8 formatting compliance
"""

import logging
import re
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel, ValidationError

# Import schemas from general_de template
from templates.general_de import (
    CrossPipelineRouterOutput,
    GeneralClassifierOutput,
    GeneralExtractorOutput,
)

logger = logging.getLogger(__name__)

# Valid enumeration values
VALID_PIPELINES = {
    "medical",
    "financial",
    "legal",
    "general",
    "fallback",
}

VALID_DOC_TYPES = {
    "Korrespondenz",
    "Bericht",
    "Zusammenfassung",
    "Sonstige",
}

VALID_LANGUAGES = {
    "Deutsch",
    "English",
    "Español",
    "Français",
}

# Confidence keys to validate
CONFIDENCE_KEYS = (
    "vertrauen",
    "sicherheit",
    "routing_vertrauen",
)

# Minimum length thresholds
MIN_SUMMARY_LENGTH = 10
MIN_REASONING_LENGTH = 10


class ValidationResult:
    """Structured validation result.

    Attributes:
        errors: Critical validation failures
        warnings: Non-critical issues
        schema_type: Detected schema type
    """

    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.schema_type: Optional[str] = None

    @property
    def valid(self) -> bool:
        """Return True if no critical errors."""
        return len(self.errors) == 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "schema_type": self.schema_type,
        }


def validate_general_extraction(
    data: Dict[str, Any],
) -> Dict[str, Any]:
    """Validate output from General Extraction templates.

    Handles multiple template outputs:
    - general_classifier: dokumenttyp, sprache, themata, etc.
    - general_extractor: metadata extraction
    - general_extractor_v2: with tag suggestions
    - cross_pipeline_router: routing recommendation

    Args:
        data: Extraction result from Guidance template

    Returns:
        Dict with valid, errors, warnings, schema_type
    """
    result = ValidationResult()

    try:
        if not data or not isinstance(data, dict):
            result.errors.append(
                "Empty or non-dict extraction result"
            )
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
                for error in e.errors():
                    field_path = ".".join(
                        str(x) for x in error["loc"]
                    )
                    msg = error["msg"]
                    result.errors.append(
                        f"Pydantic validation ({field_path}): {msg}"
                    )
                logger.error(
                    f"Pydantic validation failed: {e.error_count()} "
                    f"errors"
                )
        else:
            # Unknown schema - minimal validation
            result.warnings.append(
                "Unable to determine general template type - "
                "skipping Pydantic validation"
            )
            logger.warning("Unknown schema type for validation")

    except Exception as e:
        result.errors.append(
            f"General validation exception: "
            f"{type(e).__name__}: {str(e)}"
        )
        logger.exception("Unexpected error during validation")

    return result.to_dict()


def _detect_schema(
    data: Dict[str, Any],
) -> tuple[Optional[str], Optional[Type[BaseModel]]]:
    """Detect which schema this data conforms to.

    Order of detection (most specific first):
    1. general_classifier: "dokumenttyp" + "themata"
    2. general_extractor: "zusammenfassung" + "schluesselwoerter"
    3. cross_pipeline_router: "empfehlung" + "begruendung"

    Args:
        data: Extraction data

    Returns:
        Tuple of (schema_name, schema_class) or (None, None)
    """
    # Check for classifier output (most specific)
    if "dokumenttyp" in data and "themata" in data:
        return ("general_classifier", GeneralClassifierOutput)

    # Check for extractor output
    if (
        "zusammenfassung" in data
        and "schluesselwoerter" in data
    ):
        return ("general_extractor", GeneralExtractorOutput)

    # Check for router output
    if "empfehlung" in data and "begruendung" in data:
        return (
            "cross_pipeline_router",
            CrossPipelineRouterOutput,
        )

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
    if schema_type == "general_classifier":
        _validate_classifier_logic(data, result)
    elif schema_type == "general_extractor":
        _validate_extractor_logic(data, result)
    elif schema_type == "cross_pipeline_router":
        _validate_router_logic(data, result)


def _validate_classifier_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for classifier output.

    Args:
        data: Validated classifier data
        result: ValidationResult to mutate
    """
    # Document type sanity check
    doc_type = data.get("dokumenttyp", "").strip()
    if doc_type and doc_type not in VALID_DOC_TYPES:
        result.warnings.append(
            f"Non-standard document type: {doc_type}"
        )

    # Language sanity check
    language = data.get("sprache", "").strip()
    if language and language not in VALID_LANGUAGES:
        result.warnings.append(
            f"Non-standard language: {language}"
        )

    # Topics sanity check
    themata = data.get("themata", [])
    if not themata or len(themata) == 0:
        result.warnings.append(
            "No document topics identified"
        )

    # Boolean field sanity checks
    has_finances = data.get("enthaelt_finanzen")
    if has_finances is None:
        result.warnings.append(
            "Financial content flag not set"
        )

    has_pii = data.get("enthaelt_personendaten")
    if has_pii is None:
        result.warnings.append(
            "Personal data content flag not set"
        )

    # CRITICAL: Validate confidence score
    _validate_confidence_field(
        data,
        "vertrauen",
        result,
    )


def _validate_extractor_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for extractor output.

    Args:
        data: Validated extractor data
        result: ValidationResult to mutate
    """
    # Summary sanity check
    summary = data.get("zusammenfassung", "").strip()
    if len(summary) < MIN_SUMMARY_LENGTH:
        result.errors.append(
            f"Summary is too short (< {MIN_SUMMARY_LENGTH} chars): "
            f"'{summary}'"
        )

    # Keywords sanity check
    keywords = data.get("schluesselwoerter", [])
    if not keywords or len(keywords) == 0:
        result.warnings.append(
            "No keywords extracted"
        )
    elif not all(isinstance(k, str) for k in keywords):
        result.errors.append(
            "Keywords must be strings"
        )

    # Entities sanity check
    entities = data.get("entitaeten", [])
    if not entities or len(entities) == 0:
        result.warnings.append(
            "No entities identified"
        )
    elif not all(isinstance(e, str) for e in entities):
        result.errors.append(
            "Entities must be strings"
        )

    # Dates sanity check
    dates = data.get("daten", [])
    if not dates or len(dates) == 0:
        result.warnings.append(
            "No dates extracted"
        )
    else:
        for date_str in dates:
            if date_str and not _is_valid_date(date_str):
                result.errors.append(
                    f"Invalid date format: {date_str} "
                    f"(must be YYYY-MM-DD)"
                )

    # CRITICAL: Validate confidence score
    _validate_confidence_field(
        data,
        "vertrauen",
        result,
    )


def _validate_router_logic(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate business logic for router output.

    Args:
        data: Validated router data
        result: ValidationResult to mutate
    """
    # Pipeline recommendation sanity check
    pipeline = data.get("empfehlung", "").strip().lower()
    if pipeline and pipeline not in VALID_PIPELINES:
        result.errors.append(
            f"Invalid pipeline recommendation: {pipeline}. "
            f"Expected one of {VALID_PIPELINES}"
        )

    # Reasoning sanity check
    begruendung = data.get("begruendung", "").strip()
    if len(begruendung) < MIN_REASONING_LENGTH:
        result.errors.append(
            f"Routing rationale is too short "
            f"(< {MIN_REASONING_LENGTH} chars): '{begruendung}'"
        )

    # CRITICAL: Validate confidence score
    _validate_confidence_field(
        data,
        "sicherheit",
        result,
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
        # Additional year sanity check
        if year < 1900 or year > 2100:
            return False
        return True
    except ValueError:
        return False


def _validate_confidence_field(
    data: Dict[str, Any],
    field_name: str,
    result: ValidationResult,
) -> None:
    """Validate confidence field is in valid range.

    Args:
        data: Data dict
        field_name: Field name to validate
        result: ValidationResult to mutate
    """
    confidence = data.get(field_name)

    if confidence is None:
        return

    try:
        conf_val = float(confidence)
        # STRICT: out-of-range confidence is a critical error
        if not (0.0 <= conf_val <= 1.0):
            result.errors.append(
                f"Confidence score ({field_name}) out of valid range "
                f"[0.0, 1.0]: {confidence}"
            )
    except (ValueError, TypeError):
        result.errors.append(
            f"Invalid confidence format ({field_name}): {confidence} "
            f"(must be float in range 0.0-1.0)"
        )


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
            result.errors.append(
                "suggested_tags contains non-string entries"
            )

    missing = data.get("missing_tags")
    if missing is not None and not isinstance(missing, list):
        result.errors.append("missing_tags must be a list")
    elif isinstance(missing, list):
        if any(not isinstance(tag, str) for tag in missing):
            result.errors.append(
                "missing_tags contains non-string entries"
            )

    tagging = data.get("tagging")
    if tagging is None:
        return

    if not isinstance(tagging, dict):
        result.warnings.append("tagging must be an object")
        return

    tag_domain = tagging.get("domain")
    if tag_domain and str(tag_domain).lower() != "general":
        result.warnings.append(
            f"tagging.domain '{tag_domain}' does not match 'general'"
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
            if not (0.0 <= value <= 1.0):
                result.errors.append(
                    f"tagging.confidence.overall out of range "
                    f"[0.0, 1.0]: {overall}"
                )
        except (TypeError, ValueError):
            result.errors.append(
                "tagging.confidence.overall must be a number in range "
                "0.0-1.0"
            )


# ============================================================================
# Testing
# ============================================================================


def test_validate_general_extraction() -> None:
    """Test validator with sample data."""
    # Test classifier output - valid
    classifier_data = {
        "dokumenttyp": "Bericht",
        "sprache": "Deutsch",
        "themata": ["Finanzen", "Compliance"],
        "enthaelt_finanzen": True,
        "enthaelt_personendaten": False,
        "vertrauen": 0.92,
    }

    result = validate_general_extraction(classifier_data)
    logger.info(f"Classifier validation (valid): {result}")
    assert result["valid"], "Classifier output should be valid"
    assert result["schema_type"] == "general_classifier"

    # Test classifier with out-of-range confidence (STRICT)
    invalid_confidence_classifier = {
        "dokumenttyp": "Bericht",
        "sprache": "Deutsch",
        "themata": ["Test"],
        "enthaelt_finanzen": False,
        "enthaelt_personendaten": False,
        "vertrauen": 100,  # OUT OF RANGE!
    }

    result = validate_general_extraction(
        invalid_confidence_classifier
    )
    logger.info(f"Classifier validation (invalid confidence): {result}")
    assert not result["valid"], "Should reject vertrauen=100"
    assert any(
        "out of valid range" in err for err in result["errors"]
    ), f"Should have range error, got: {result['errors']}"

    # Test extractor output - valid
    extractor_data = {
        "zusammenfassung": (
            "Dies ist eine detaillierte Zusammenfassung des "
            "Dokumentinhalts"
        ),
        "schluesselwoerter": ["Bericht", "Finanzen", "Audit"],
        "entitaeten": ["ABC GmbH", "2024"],
        "daten": ["2024-01-15"],
        "vertrauen": 0.88,
    }

    result = validate_general_extraction(extractor_data)
    logger.info(f"Extractor validation (valid): {result}")
    assert result["valid"], "Extractor output should be valid"
    assert result["schema_type"] == "general_extractor"

    # Test extractor with invalid date format
    invalid_date_extractor = {
        "zusammenfassung": (
            "Dies ist eine detaillierte Zusammenfassung"
        ),
        "schluesselwoerter": ["Test"],
        "entitaeten": ["Company"],
        "daten": ["15/01/2024"],  # Wrong format!
        "vertrauen": 0.8,
    }

    result = validate_general_extraction(invalid_date_extractor)
    logger.info(f"Extractor validation (invalid date): {result}")
    assert not result["valid"], "Should reject invalid date format"
    assert any(
        "date format" in err.lower() for err in result["errors"]
    ), f"Should have date error, got: {result['errors']}"

    # Test extractor with too-short summary
    invalid_summary_extractor = {
        "zusammenfassung": "Kurz",  # Too short!
        "schluesselwoerter": ["Test"],
        "entitaeten": ["Company"],
        "daten": ["2024-01-15"],
        "vertrauen": 0.8,
    }

    result = validate_general_extraction(invalid_summary_extractor)
    logger.info(f"Extractor validation (short summary): {result}")
    assert not result["valid"], "Should reject too-short summary"
    assert any(
        "too short" in err.lower() for err in result["errors"]
    ), f"Should have length error, got: {result['errors']}"

    # Test router output - valid
    router_data = {
        "empfehlung": "financial",
        "begruendung": (
            "Dokument enthält finanzielle Daten und Beträge"
        ),
        "sicherheit": 0.95,
    }

    result = validate_general_extraction(router_data)
    logger.info(f"Router validation (valid): {result}")
    assert result["valid"], "Router output should be valid"
    assert result["schema_type"] == "cross_pipeline_router"

    # Test router with invalid pipeline
    invalid_pipeline_router = {
        "empfehlung": "invalid_pipeline",  # Not in VALID_PIPELINES!
        "begruendung": "Some reasoning about routing",
        "sicherheit": 0.9,
    }

    result = validate_general_extraction(invalid_pipeline_router)
    logger.info(f"Router validation (invalid pipeline): {result}")
    assert not result["valid"], "Should reject invalid pipeline"
    assert any(
        "Invalid pipeline" in err for err in result["errors"]
    ), f"Should have pipeline error, got: {result['errors']}"

    # Test router with too-short reasoning
    invalid_reasoning_router = {
        "empfehlung": "medical",
        "begruendung": "Short",  # Too short!
        "sicherheit": 0.85,
    }

    result = validate_general_extraction(invalid_reasoning_router)
    logger.info(f"Router validation (short reasoning): {result}")
    assert not result["valid"], "Should reject too-short reasoning"
    assert any(
        "too short" in err.lower() for err in result["errors"]
    ), f"Should have length error, got: {result['errors']}"

    # Test router with out-of-range confidence
    invalid_confidence_router = {
        "empfehlung": "legal",
        "begruendung": "Document contains legal contracts",
        "sicherheit": 150,  # OUT OF RANGE!
    }

    result = validate_general_extraction(invalid_confidence_router)
    logger.info(f"Router validation (invalid confidence): {result}")
    assert not result["valid"], "Should reject sicherheit=150"
    assert any(
        "out of valid range" in err for err in result["errors"]
    ), f"Should have range error, got: {result['errors']}"

    # Test classifier with non-standard doc type (warning only)
    nonstandard_classifier = {
        "dokumenttyp": "CustomType",
        "sprache": "Deutsch",
        "themata": ["Test"],
        "enthaelt_finanzen": False,
        "enthaelt_personendaten": False,
        "vertrauen": 0.85,
    }

    result = validate_general_extraction(nonstandard_classifier)
    logger.info(
        f"Classifier validation (non-standard type): {result}"
    )
    # Should be valid (Pydantic allows it), but with warning
    assert len(result["warnings"]) > 0, (
        "Should have warnings for non-standard doc type"
    )

    # Test extractor with missing keywords (warning only)
    missing_keywords_extractor = {
        "zusammenfassung": (
            "This is a comprehensive summary of the document"
        ),
        "schluesselwoerter": [],  # Empty!
        "entitaeten": ["Company"],
        "daten": ["2024-01-15"],
        "vertrauen": 0.8,
    }

    result = validate_general_extraction(missing_keywords_extractor)
    logger.info(
        f"Extractor validation (no keywords): {result}"
    )
    # Should be valid (Pydantic allows it), but with warning
    assert len(result["warnings"]) > 0, (
        "Should have warnings for missing keywords"
    )

    logger.info("✅ All general extraction tests passed!")


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.DEBUG,
    )
    test_validate_general_extraction()
