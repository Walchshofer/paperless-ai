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
"""

import logging
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

VALID_LANGUAGES = {"Deutsch"}


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
                logger.debug(
                    f"{schema_type} passed Pydantic validation"
                )

                # Data is structurally valid, check business logic
                _validate_business_logic(
                    validated_data.model_dump(),
                    schema_type,
                    result,
                )

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
                    f"Pydantic validation failed: "
                    f"{e.error_count()} errors"
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

    Args:
        data: Extraction data

    Returns:
        Tuple of (schema_name, schema_class) or (None, None)
    """
    # Check for classifier output
    if "dokumenttyp" in data and "themata" in data:
        return ("general_classifier", GeneralClassifierOutput)

    # Check for extractor output
    if "zusammenfassung" in data and "schluesselwoerter" in data:
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
    doc_type = data.get("dokumenttyp", "")
    if doc_type not in VALID_DOC_TYPES:
        result.warnings.append(
            f"Non-standard document type: {doc_type}"
        )

    # Language sanity check
    language = data.get("sprache", "")
    if language not in VALID_LANGUAGES:
        result.warnings.append(
            f"Non-standard language: {language}"
        )

    # Topics sanity check
    themata = data.get("themata", [])
    if not themata or len(themata) == 0:
        result.warnings.append("No document topics identified")

    # Confidence check
    confidence = data.get("vertrauen", 0)
    if confidence < 0.5:
        result.warnings.append(
            f"Low confidence classifier result: {confidence}"
        )

    # Validate tag fields
    _validate_tag_fields(data, result)


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
    if len(summary) < 10:
        result.warnings.append(
            "Summary is suspiciously short (< 10 chars)"
        )

    # Keywords sanity check
    keywords = data.get("schluesselwoerter", [])
    if not keywords or len(keywords) == 0:
        result.warnings.append("No keywords extracted")

    # Entities sanity check
    entities = data.get("entitaeten", [])
    if not entities or len(entities) == 0:
        result.warnings.append("No entities identified")

    # Dates sanity check
    dates = data.get("daten", [])
    if not dates or len(dates) == 0:
        result.warnings.append("No dates extracted")

    # Validate tag fields
    _validate_tag_fields(data, result)


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
    pipeline = data.get("empfehlung", "").lower()
    if pipeline not in VALID_PIPELINES:
        result.warnings.append(
            f"Unexpected pipeline recommendation: {pipeline}"
        )

    # Reasoning sanity check
    begruendung = data.get("begruendung", "").strip()
    if len(begruendung) < 10:
        result.warnings.append(
            "Routing rationale is too short (< 10 chars)"
        )

    # Confidence sanity check
    confidence = data.get("sicherheit", 0)
    if confidence < 0.5:
        result.warnings.append(
            f"Low routing confidence: {confidence}"
        )

    # Validate tag fields
    _validate_tag_fields(data, result)


def _validate_tag_fields(
    data: Dict[str, Any],
    result: ValidationResult,
) -> None:
    """Validate tagging fields (suggested_tags, etc.).

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
    if tag_domain and str(tag_domain).lower() != "general":
        result.warnings.append(
            f"tagging.domain '{tag_domain}' does not match "
            f"'general'"
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


def test_validate_general_extraction() -> None:
    """Test validator with sample data."""
    # Test classifier output
    classifier_data = {
        "dokumenttyp": "Bericht",
        "sprache": "Deutsch",
        "themata": ["Finanzen", "Compliance"],
        "enthaelt_finanzen": True,
        "enthaelt_personendaten": False,
        "vertrauen": 0.92,
    }

    result = validate_general_extraction(classifier_data)
    logger.info(f"Classifier validation: {result}")
    assert result["valid"], "Classifier output should be valid"
    assert result["schema_type"] == "general_classifier"

    # Test extractor output
    extractor_data = {
        "zusammenfassung": "Dies ist eine detaillierte Zusammenfassung",
        "schluesselwoerter": ["Bericht", "Finanzen", "Audit"],
        "entitaeten": ["ABC GmbH", "2024"],
        "daten": ["2024-01-15"],
        "vertrauen": 0.88,
    }

    result = validate_general_extraction(extractor_data)
    logger.info(f"Extractor validation: {result}")
    assert result["valid"], "Extractor output should be valid"
    assert result["schema_type"] == "general_extractor"

    # Test router output
    router_data = {
        "empfehlung": "Financial",
        "begruendung": "Dokument enthält finanzielle Daten und "
                       "Beträge",
        "sicherheit": 0.95,
    }

    result = validate_general_extraction(router_data)
    logger.info(f"Router validation: {result}")
    assert result["valid"], "Router output should be valid"
    assert result["schema_type"] == "cross_pipeline_router"

    # Test with invalid classifier (wrong doc type)
    invalid_classifier = {
        "dokumenttyp": "InvalidType",
        "sprache": "Deutsch",
        "themata": ["Test"],
        "enthaelt_finanzen": False,
        "enthaelt_personendaten": False,
        "vertrauen": 0.5,
    }

    result = validate_general_extraction(invalid_classifier)
    logger.info(f"Invalid classifier validation: {result}")
    # Should still be valid (Pydantic allows it), but with warning
    assert len(result["warnings"]) > 0


if __name__ == "__main__":
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.DEBUG,
    )
    test_validate_general_extraction()
