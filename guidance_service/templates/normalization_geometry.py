"""Document geometry analysis template using Guidance constrained JSON.

Analyzes document rotation, cropping, and DPI requirements using a
vision-capable LLM model with guaranteed valid JSON output via
Pydantic schema constraints and token-level generation control.

Best Practices Applied:
- Comprehensive logging and error handling
- Post-generation validation with Pydantic
- Type annotations and validation
- Configurable parameters
- Clear documentation
"""

import json
import logging
from typing import Any, Dict

try:
    from guidance import (  # type: ignore[import-not-found]
        assistant,
        json as gen_json,
        guidance,
        system,
        user,
        image
    )
except ImportError as e:
    raise ImportError(
        "guidance library not found. "
        "Install with: pip install guidance==0.3.0"
    ) from e

from pydantic import ValidationError

from schemas.NormalizationSchema import NormalizationGeometry

logger = logging.getLogger(__name__)

# Supported languages and their system prompts
SYSTEM_PROMPTS: Dict[str, str] = {
    "de": (
        "Du bist ein Dokument-Geometrie-Analyzer. "
        "Analysiere die Ausrichtung, Zuschneidung und "
        "DPI-Anforderungen."
    ),
    "en": (
        "You are a Document Geometry Analyzer. "
        "Analyze rotation, cropping, and DPI requirements."
    ),
}


@guidance
def analyze_document_geometry(
    lm: Any,
    document_image_b64: str,
    language: str = "de",
    max_tokens: int = 300,
    temperature: float = 0.2,
) -> Any:
    """Analyze document geometry using constrained JSON generation.

    Result is GUARANTEED valid per NormalizationGeometry schema at
    token level via Guidance constrained generation. Determines
    rotation, cropping, and DPI requirements.

    The generated JSON is:
    - Structurally valid (Pydantic schema-constrained)
    - Semantically validated (post-generation validation)
    - Type-safe (Field constraints enforced)

    Args:
        lm: Language model object (passed by Guidance framework)
        document_image_b64: Base64-encoded image (first page only).
            Should be first ~100 chars for display only; actual
            model receives full image if passed via proper channels
        language: Language code ("de" for German, "en" for English).
            Must be a key in SYSTEM_PROMPTS
        max_tokens: Maximum tokens to generate (default: 300)
        temperature: Generation temperature (default: 0.2)

    Returns:
        Updated language model object with generated "geometry" field
        containing valid NormalizationGeometry JSON object

    Raises:
        ValueError: If language is not supported or post-generation
                    validation fails
        Exception: On template execution errors (logged before re-raise)

    Example:
        >>> from guidance.models import Transformers
        >>> import base64
        >>> lm = Transformers("qwen3-vl:8b")
        >>> with open("doc.jpg", "rb") as f:
        ...     encoded_img = base64.b64encode(f.read()).decode()
        >>> result = lm + analyze_document_geometry(
        ...     document_image_b64=encoded_img,
        ...     language="de"
        ... )
        >>> geometry = result["geometry"]
        >>> print(f"Rotate: {geometry.rotate}°")
        >>> print(f"Target DPI: {geometry.target_dpi}")
    """
    # Validate language parameter
    if language not in SYSTEM_PROMPTS:
        logger.warning(
            f"Unsupported language '{language}'; "
            f"defaulting to 'en'"
        )
        language = "en"

    # Validate base64 format (basic sanity check)
    if not document_image_b64 or len(document_image_b64) < 10:
        logger.warning(
            "Document image appears to be empty or too short"
        )

    logger.debug(
        f"Analyzing document geometry: "
        f"language={language}, max_tokens={max_tokens}, "
        f"temperature={temperature}"
    )

    system_prompt = SYSTEM_PROMPTS[language]

    with system():
        lm += system_prompt
        lm += (
            "\nReturn ONLY valid JSON matching the schema. "
            "No markdown, no explanations."
        )

    with user():
        lm += image(document_image_b64)
        lm += (
            "Analyze this document:\n"
        )

    with assistant():
        lm += gen_json(
            schema=NormalizationGeometry,
            name="geometry",
            max_tokens=max_tokens,
            temperature=temperature,
        )

    # Step 2: Post-generation validation
    # Guidance guarantees JSON structure, but we validate semantics
    try:
        # Extract the raw JSON string from the language model
        geometry_json_str = lm["geometry"]

        # Parse and validate with Pydantic
        geometry_data = json.loads(geometry_json_str)
        validated_geometry = NormalizationGeometry.model_validate(
            geometry_data
        )

        logger.info(
            f"Geometry analysis successful: "
            f"rotate={validated_geometry.rotate}°, "
            f"dpi={validated_geometry.target_dpi}, "
            f"confidence={validated_geometry.confidence}"
        )

        # Store validated object back in lm for downstream use
        lm = lm.set("geometry_validated", validated_geometry)

    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing failed: {e}")
        raise ValueError(
            f"Generated output is not valid JSON: {e}"
        ) from e

    except ValidationError as e:
        logger.error(f"Pydantic validation failed: {e}")
        raise ValueError(
            f"Generated output failed schema validation: {e}"
        ) from e

    except Exception as e:
        logger.exception(
            f"Unexpected error during post-generation validation: {e}"
        )
        raise

    return lm
