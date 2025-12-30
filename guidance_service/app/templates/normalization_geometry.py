"""Document geometry analysis template using Guidance constrained JSON.

Analyzes document rotation, cropping, and DPI requirements using a
vision-capable LLM model with guaranteed valid JSON output.
"""

from typing import Any

try:
    from guidance import (  # type: ignore[import-not-found]  # noqa: F401
        assistant,
        gen_json,
        guidance,
        system,
        user,
    )
except ImportError as e:
    raise ImportError(
        "guidance library not found. "
        "Install with: pip install guidance"
    ) from e

from app.schemas.NormalizationSchema import NormalizationGeometry


@guidance
def analyze_document_geometry(
    lm: Any,
    document_image_b64: str,
    language: str = "de",
) -> Any:
    """Analyze document geometry using constrained JSON generation.

    Result is GUARANTEED valid per NormalizationGeometry schema at
    token level. Determines rotation, cropping, and DPI requirements.

    Args:
        lm: Language model object (passed by Guidance framework)
        document_image_b64: Base64-encoded image (first page only)
        language: Language code ("de" for German, "en" for English)

    Returns:
        Updated language model object with generated geometry field
        containing NormalizationGeometry-validated JSON

    Example:
        >>> from guidance.models import Transformers
        >>> lm = Transformers("qwen3-vl:8b")
        >>> result = lm + analyze_document_geometry(
        ...     document_image_b64=encoded_img,
        ...     language="de"
        ... )
        >>> geometry = result["geometry"]
        >>> print(geometry.rotate)  # 0, 90, 180, or 270
    """
    system_prompt = {
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

    with system():
        lm += system_prompt.get(language, system_prompt["en"])
        lm += (
            "\nReturn ONLY valid JSON matching the schema. "
            "No markdown, no explanations."
        )

    with user():
        lm += (
            "[IMAGE]\n"
            "Analyze this document:\n"
            f"{document_image_b64[:100]}..."
        )

    with assistant():
        lm += gen_json(
            schema=NormalizationGeometry,
            name="geometry",
            max_tokens=300,
            temperature=0.2,
        )

    return lm
