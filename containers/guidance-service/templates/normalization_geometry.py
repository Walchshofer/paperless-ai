"""Document geometry analysis template for vision models.

NOTE: This template CANNOT run through Guidance's LiteLLM backend because
Guidance's experimental LiteLLM does NOT support multimodal/vision inputs.
The document_image_b64 parameter would be ignored.

Instead, vision templates are handled by __init__.py's call_ollama_vision()
which calls Ollama's /api/chat directly with proper image handling.

This module provides:
- SYSTEM_PROMPTS: System prompts by language
- USER_PROMPTS: User instructions by language (used by call_ollama_vision)
- NormalizationGeometry schema (via import)

The @guidance decorated function is kept for documentation and potential
future use if Guidance adds multimodal support.
"""

import json
import logging
from typing import Any, Callable, Dict

try:
    from guidance import (  # type: ignore[import-not-found]
        assistant,
        json as gen_json,
        guidance,
        system,
        user,
        image
    )
except ImportError:
    # Guidance not available in the local environment (tests run here).
    # It will be present in the Docker image at runtime; avoid raising at import.
    assistant = None  # type: ignore[assignment]
    gen_json = None  # type: ignore[assignment]
    guidance = None  # type: ignore[assignment]
    system = None  # type: ignore[assignment]
    user = None  # type: ignore[assignment]
    GUIDANCE_AVAILABLE = False

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

# User prompts - instructions for geometry analysis
# NOTE: The actual image is passed via LiteLLM's multimodal support,
# NOT embedded as base64 text in the prompt (that confuses models)
USER_PROMPTS: Dict[str, str] = {
    "de": (
        "Analysiere dieses Dokumentbild fuer Geometrie-Korrekturen:\n"
        "1) ROTATION: Pruefe die Textausrichtung. Ist der Text von links nach rechts, "
        "oben nach unten lesbar? Falls der Text seitwaerts oder auf dem Kopf steht, "
        "bestimme die noetige Drehung (0, 90, 180 oder 270 Grad im Uhrzeigersinn). "
        "Pruefe auch die Position des Briefkopfs/Logos - es muss oben sein.\n"
        "2) ZUSCHNITT: Gibt es schwarze Raender, Scanner-Artefakte oder ueberschuessigen "
        "Weissraum um das Dokument?\n"
        "3) DPI: Empfohlene Aufloesung (200-400).\n"
        "4) VERTRAUEN: Dein Vertrauensniveau (0.0-1.0).\n"
        "5) BEGRUENDUNG: Erklaere WARUM du diese Drehung gewaehlt hast."
    ),
    "en": (
        "Analyze this document image for geometry corrections:\\n"
        "1) ROTATION: Check text orientation. Is the text horizontal (left-to-right) or vertical?\\n"
        "   - If text runs vertically (bottom-to-top), it needs 90 degree rotation.\\n"
        "   - If text runs vertically (top-to-bottom), it needs 270 degree rotation.\\n"
        "   - If text is upside down, it needs 180 degree rotation.\\n"
        "   - Look at logos, headers, and tables for orientation clues.\\n"
        "   - Return the CLOCKWISE rotation needed to make text upright (0, 90, 180, 270).\\n"
        "2) CROP: Identify the document boundaries vs background.\\n"
        "   - If the document occupies < 80% of the image area, suggest a crop.\\n"
        "   - Ignore small dark borders; focus on the main document page.\\n"
        "3) DPI: Recommended resolution (200-400).\\n"
        "4) CONFIDENCE: Your confidence level (0.0-1.0).\\n"
        "5) REASONING: Explain WHY you chose this rotation."
    ),
}


def get_analyze_document_geometry() -> Callable:
    """Factory function that returns the geometry analysis template.

    This pattern avoids pickle issues with @guidance decorator
    by creating the decorated function fresh each time.

    Returns:
        Guidance template function for document geometry analysis
    """

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
            Updated language model object with generated "geometry"
            field containing valid NormalizationGeometry JSON object

        Raises:
            ValueError: If language is not supported or post-generation
                        validation fails
            Exception: On template execution errors (logged before raise)

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

        # NOTE: Do NOT include base64 image data in the text prompt!
        # The image must be passed through LiteLLM's multimodal channel.
        # Including base64 text here confuses the model & produces garbage.
        # The document_image_b64 parameter is passed to the model via
        # the images parameter in the LLM call, not in the prompt text.
        with user():
            lm += image(document_image_b64)
            lm += USER_PROMPTS[language]

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

    return analyze_document_geometry


# For backward compatibility - create via factory
analyze_document_geometry = get_analyze_document_geometry()
