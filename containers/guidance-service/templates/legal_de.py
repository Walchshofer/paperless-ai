"""Legal Document Extraction Templates.

Guidance templates for extracting legal contract data from German
documents (AT/DE). Handles:
- Classifier: document type, complexity, jurisdiction
- Extractor: parties, dates, jurisdiction, clauses
- Validator: extraction completeness and consistency
- Tag suggestions and tagging metadata

Supports both basic and v2 (with tags) variants.

Best Practices Applied:
- Comprehensive logging and error handling
- Type annotations throughout
- Pydantic schema validation
- Clear docstrings for all functions
"""

import logging
import os
from typing import Any, Callable, Dict, List, Literal, Optional

try:
    from guidance import (  # type: ignore[import-not-found]
        assistant,
        json as gen_json,
        guidance,
        system,
        user,
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

from pydantic import BaseModel, Field, create_model

from templates.components.common import (
    build_domain_context,
    normalize_tags,
    pick_text,
    stringify,
)

# Configure logging
logger = logging.getLogger(__name__)

# Configuration from environment
TAG_SELECT_MAX = int(os.getenv("GUIDANCE_TAG_SELECT_MAX", "50"))
TAG_SUGGESTION_LIMIT = int(
    os.getenv("GUIDANCE_TAG_SUGGESTION_LIMIT", "5")
)
TAG_MISSING_LIMIT = int(os.getenv("GUIDANCE_TAG_MISSING_LIMIT", "5"))


# ============================================================================
# Output Schemas - Pydantic Models
# ============================================================================


class LegalClassifierOutput(BaseModel):
    """Output schema for legal_classifier.

    Attributes:
        dokumenttyp: Type of legal document
        komplexitaet: Complexity level
        vermutete_jurisdiktion: Expected jurisdiction
        vertrauen: Confidence score (0-1)
    """

    dokumenttyp: Literal[
        "Kaufvertrag",
        "Mietvertrag",
        "Arbeitsvertrag",
        "Servicevertrag",
        "NDA",
        "Lizenzvertrag",
        "Sonstige",
    ]
    komplexitaet: Literal["Einfach", "Mittel", "Komplex"]
    vermutete_jurisdiktion: Literal[
        "Österreich",
        "Deutschland",
        "EU-weit",
        "International",
    ]
    vertrauen: float = Field(
        ge=0, le=1, description="Confidence score"
    )

    model_config = dict(extra="forbid")


class LegalParties(BaseModel):
    """Contract parties.

    Attributes:
        partei_1: First contracting party
        partei_2: Second contracting party
    """

    partei_1: str
    partei_2: str

    model_config = dict(extra="forbid")


class LegalDates(BaseModel):
    """Contract dates.

    Attributes:
        abschluss_datum: Date contract was signed
        gueltig_ab: Date contract becomes effective
    """

    abschluss_datum: str
    gueltig_ab: str

    model_config = dict(extra="forbid")


class LegalJurisdiction(BaseModel):
    """Legal jurisdiction and applicable law.

    Attributes:
        anwendbares_recht: Applicable law/jurisdiction
    """

    anwendbares_recht: Literal[
        "Österreich (ABGB)",
        "Deutschland (BGB)",
        "Schweiz (ZGB)",
        "Europäisches Recht",
        "Schiedsverfahren",
    ]

    model_config = dict(extra="forbid")


class LegalExtractorOutput(BaseModel):
    """Output schema for legal_extractor.

    Attributes:
        vertragsparteien: Contract parties
        daten: Contract dates
        jurisdiktion_und_recht: Legal jurisdiction
        vertrauen: Confidence score (0-1)
    """

    vertragsparteien: LegalParties
    daten: LegalDates
    jurisdiktion_und_recht: LegalJurisdiction
    vertrauen: float = Field(
        ge=0, le=1, description="Confidence score"
    )

    model_config = dict(extra="forbid")


class VisualQuery(BaseModel):
    """Output schema for a single visual query."""

    question: str
    field_target: str
    expected_element_type: Literal[
        "field_extraction",
        "validation",
        "exploration",
    ]
    priority: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    rarity_factor: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class VisualQueryGenerationOutput(BaseModel):
    """Output schema for visual query generation."""

    queries: List[VisualQuery] = Field(min_length=3)

    model_config = dict(extra="forbid")


class LegalValidatorOutput(BaseModel):
    """Output schema for legal_validator.

    Attributes:
        valid: Whether extraction is valid
        issues: List of validation issues
        vertrauen: Confidence score (0-1)
    """

    valid: bool
    issues: List[str]
    vertrauen: float = Field(
        ge=0, le=1, description="Confidence score"
    )

    model_config = dict(extra="forbid")


class TaggingTagConfidence(BaseModel):
    """Confidence score for individual tag.

    Attributes:
        tag: Tag identifier
        confidence: Confidence score (0-1)
    """

    tag: str
    confidence: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingConfidence(BaseModel):
    """Overall and per-tag confidence scores.

    Attributes:
        overall: Overall confidence score
        tags: Per-tag confidence scores
    """

    overall: float = Field(ge=0, le=1)
    tags: List[TaggingTagConfidence] = Field(
        default_factory=list
    )

    model_config = dict(extra="forbid")


class TaggingMetadata(BaseModel):
    """Metadata for tagging output.

    Attributes:
        domain: Domain identifier
        source: Source of tagging
        confidence: Confidence scores
    """

    domain: str
    source: str
    confidence: TaggingConfidence

    model_config = dict(extra="forbid")


# ============================================================================
# Helper Functions
# ============================================================================


def _build_tagged_schema(
    base_model: type[BaseModel],
    existing_tags: Optional[List[str]],
) -> type[BaseModel]:
    """Build dynamic Pydantic schema with tag constraints.

    Args:
        base_model: Base output model to extend
        existing_tags: List of allowed tags for selection

    Returns:
        Extended Pydantic model with tag fields

    Raises:
        ValueError: If tag normalization fails
    """
    try:
        allowed_tags = list(
            dict.fromkeys(normalize_tags(existing_tags or []))
        )
        use_select = (
            allowed_tags and len(allowed_tags) <= TAG_SELECT_MAX
        )

        if use_select:
            # Create Literal type from allowed tags
            tag_literal = Literal[tuple(allowed_tags)]  # type: ignore
            suggested_type = List[tag_literal]  # type: ignore
            logger.debug(
                f"Using Literal constraint for {len(allowed_tags)} tags"
            )
        else:
            suggested_type = List[str]
            logger.debug(
                f"Using unconstrained List[str] "
                f"for {len(allowed_tags)} tags"
            )

        tagged_model = create_model(
            f"{base_model.__name__}Tagged",
            suggested_tags=(
                suggested_type,
                Field(
                    default_factory=list,
                    max_items=TAG_SUGGESTION_LIMIT,
                    description="Suggested tags from existing tags",
                ),
            ),
            missing_tags=(
                List[str],
                Field(
                    default_factory=list,
                    max_items=TAG_MISSING_LIMIT,
                    description="New tag candidates",
                ),
            ),
            tagging=(
                TaggingMetadata,
                Field(description="Tagging metadata and confidence"),
            ),
            __base__=base_model,
        )

        return tagged_model

    except Exception as e:
        logger.error(f"Failed to build tagged schema: {e}")
        raise


# ============================================================================
# Guidance Templates
# ============================================================================


class LegalTemplatesDE:
    """German-language legal contract extraction templates.

    This class provides reusable Guidance templates for extracting and
    analyzing legal documents in German and Austrian contexts.

    Each template is decorated with @guidance and returns a callable that
    can be used with Guidance language models.
    """

    @staticmethod
    def get_legal_classifier() -> Callable:
        """Classify legal document type and complexity.

        Returns:
            Guidance template function for classification

        Example:
            >>> classifier = (
            ...     LegalTemplatesDE.get_legal_classifier()
            ... )
            >>> lm = model + classifier(
            ...     document_text="Kaufvertrag für..."
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def legal_classifier(
            lm: Any,
            document_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Classify legal document.

            Args:
                lm: Language model instance
                document_text: Full document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Existing tags for context
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with classification result
            """
            text = pick_text(document_text, text_chunk)
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            logger.debug(
                f"Classifying legal document from domain: {domain}"
            )

            with system():
                lm += (
                    "Du bist ein Rechtsdokument-Klassifizierer "
                    "spezialisiert auf deutschösterreichische "
                    "Verträge."
                )
                lm += (
                    "Klassifiziere das Dokument nach Typ, "
                    "Komplexität und Jurisdiktion."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    "Rechtsdokument (erste 500 Zeichen):\n"
                )
                lm += f"{text}\n"
                lm += "Klassifiziere nach:\n"
                lm += (
                    "- Dokumenttyp: Kaufvertrag, Mietvertrag, "
                    "Arbeitsvertrag, Servicevertrag, NDA, "
                    "Lizenzvertrag\n"
                )
                lm += (
                    "- Komplexität: Einfach, Mittel, Komplex\n"
                )
                lm += (
                    "- Vermutete Jurisdiktion: Österreich, "
                    "Deutschland, EU-weit, International"
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=LegalClassifierOutput,
                )

            return lm

        return legal_classifier

    @staticmethod
    def get_legal_extractor() -> Callable:
        """Extract contract data with reasoning.

        Returns:
            Guidance template function for extraction

        Example:
            >>> extractor = (
            ...     LegalTemplatesDE.get_legal_extractor()
            ... )
            >>> lm = model + extractor(
            ...     legal_text="Kaufvertrag zwischen..."
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def legal_extractor(
            lm: Any,
            legal_text: Optional[str] = None,
            legal_context: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract legal contract data.

            Args:
                lm: Language model instance
                legal_text: Contract text
                legal_context: Legal context information
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Existing tags
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction result
            """
            text = pick_text(legal_text, text_chunk)
            context_text = stringify(
                pick_text(legal_context, kwargs.get("context"))
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            logger.debug(
                f"Extracting legal data from domain: {domain}"
            )

            with system():
                lm += (
                    "Du bist ein Rechtsanwalt und "
                    "Vertragsspezialist für Österreich "
                    "und Deutschland."
                )
                lm += (
                    "Deine Aufgabe: Extrahiere wichtige "
                    "Vertragsdetails als valides JSON. "
                    "Verwende den bereitgestellten "
                    "Rechtskontext zur Interpretation "
                    "zweifelhafter Klauseln."
                )
                if context_text:
                    lm += f"\nRechtskontext: {context_text}"
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    f"Österreichischer/deutscher Vertrag: "
                    f"{text}\n\n"
                )
                lm += "Extrahiere bitte:\n"
                lm += (
                    "Vertragsparteien (mit vollständigem Namen)\n"
                )
                lm += (
                    "Vertragsdatum und Gültigkeitsdauer\n"
                )
                lm += "Wichtigste 5 Klauseln\n"
                lm += "Haftungsausschlüsse\n"
                lm += "Beendigungsbedingungen\n"
                lm += (
                    "Geltende Jurisdiktion und anwendbares "
                    "Recht"
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=LegalExtractorOutput,
                )

            return lm

        return legal_extractor

    @staticmethod
    def get_legal_extractor_v2() -> Callable:
        """Extract contract data + tag suggestions (v2).

        Returns:
            Guidance template function for extraction with tagging

        Example:
            >>> extractor_v2 = (
            ...     LegalTemplatesDE.get_legal_extractor_v2()
            ... )
            >>> lm = model + extractor_v2(
            ...     legal_text="Kaufvertrag...",
            ...     existing_tags=["kaufvertrag", "wichtig"]
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def legal_extractor_v2(
            lm: Any,
            legal_text: Optional[str] = None,
            legal_context: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract legal data and suggest tags.

            Args:
                lm: Language model instance
                legal_text: Contract text
                legal_context: Legal context information
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Tags for constraining suggestions
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction and tags
            """
            text = pick_text(legal_text, text_chunk)
            context_text = stringify(
                pick_text(legal_context, kwargs.get("context"))
            )
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )

            try:
                tag_schema = _build_tagged_schema(
                    LegalExtractorOutput,
                    existing_tag_list,
                )
            except Exception as e:
                logger.error(f"Failed to build tag schema: {e}")
                tag_schema = LegalExtractorOutput

            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            logger.debug(
                f"Extracting legal data with tagging from domain: "
                f"{domain}, tags: {len(existing_tag_list)}"
            )

            with system():
                lm += (
                    "Du bist ein Rechtsanwalt und "
                    "Vertragsspezialist für Österreich "
                    "und Deutschland."
                )
                lm += (
                    "Extrahiere Vertragsdetails als valides JSON. "
                    "Zusätzlich: gib Tag-Vorschläge im "
                    "Tagging-Schema zurück."
                )
                lm += (
                    "\nTagging-Regeln:\n"
                    "- suggested_tags: nur aus bestehenden Tags\n"
                    "- missing_tags: neue Tag-Kandidaten\n"
                    "- tagging.domain: 'legal'\n"
                    "- tagging.source: 'guidance_tagger_v2'\n"
                    "- tagging.confidence.overall: zwischen "
                    "0 und 1"
                )
                if context_text:
                    lm += f"\nRechtskontext: {context_text}"
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    f"Österreichischer/deutscher Vertrag: "
                    f"{text}\n\n"
                )
                lm += "Extrahiere bitte:\n"
                lm += (
                    "Vertragsparteien (mit vollständigem Namen)\n"
                )
                lm += (
                    "Vertragsdatum und Gültigkeitsdauer\n"
                )
                lm += "Wichtigste 5 Klauseln\n"
                lm += "Haftungsausschlüsse\n"
                lm += "Beendigungsbedingungen\n"
                lm += (
                    "Geltende Jurisdiktion und anwendbares Recht"
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=tag_schema,
                )

            return lm

        return legal_extractor_v2

    @staticmethod
    def get_legal_validator() -> Callable:
        """Validate extraction completeness and consistency.

        Returns:
            Guidance template function for validation

        Example:
            >>> validator = (
            ...     LegalTemplatesDE.get_legal_validator()
            ... )
            >>> lm = model + validator(
            ...     legal_text="Kaufvertrag...",
            ...     extracted_data={...}
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def legal_validator(
            lm: Any,
            legal_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            extracted_data: Optional[Dict[str, Any]] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Validate legal extraction.

            Args:
                lm: Language model instance
                legal_text: Contract text
                text_chunk: Alternative text parameter
                extracted_data: Previously extracted data
                domain: Domain context
                existing_tags: Existing tags
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with validation result
            """
            text = pick_text(legal_text, text_chunk)
            extraction_text = stringify(
                pick_text(
                    extracted_data,
                    kwargs.get("legal_extraction"),
                    kwargs.get("extraction"),
                )
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            logger.debug("Validating legal extraction")

            with system():
                lm += (
                    "Du bist ein juristischer "
                    "Qualitätsprüfer."
                )
                lm += (
                    "Prüfe, ob die Extraktion vollständig "
                    "und konsistent ist."
                )
                lm += "Antworte nur mit JSON."
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Vertragstext: {text}\n"
                if extraction_text:
                    lm += f"Extraktion: {extraction_text}\n"
                lm += (
                    "Bewerte: gültig (true/false), liste "
                    "Probleme, und gib einen Vertrauensscore "
                    "(0-1)."
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=LegalValidatorOutput,
                )

            return lm

        return legal_validator

    @staticmethod
    def get_visual_query_generator() -> Callable:
        """Generate visual query candidates for missing/low-confidence fields.

        Returns:
            Guidance template function for visual query generation
        """

        @guidance
        def visual_query_generator(
            lm: Any,
            extraction_result: Optional[Dict[str, Any]] = None,
            ocr_text: Optional[str] = None,
            field_schema: Optional[Dict[str, Any]] = None,
            visual_elements: Optional[Any] = None,
            document_type: Optional[str] = None,
            document_id: Optional[str] = None,
            filename: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            extraction_payload = (
                extraction_result
                or kwargs.get("extraction_result")
                or {}
            )
            ocr_payload = pick_text(
                ocr_text,
                kwargs.get("ocr_text"),
            )
            schema_payload = (
                field_schema
                or kwargs.get("field_schema")
                or {}
            )
            elements_payload = (
                visual_elements
                if visual_elements is not None
                else kwargs.get("visual_elements")
            )
            doc_type = pick_text(
                document_type,
                kwargs.get("document_type"),
            )
            doc_id = pick_text(
                document_id,
                kwargs.get("document_id"),
            )
            file_name = pick_text(
                filename,
                kwargs.get("filename"),
            )

            with system():
                lm += (
                    "Du erzeugst gezielte visuelle Suchanfragen "
                    "fuer juristische Felder und Vertragsdaten."
                )
                lm += (
                    "Regeln: mindestens 3 Anfragen, "
                    "field_target muss im Schema oder Extraktion "
                    "vorhanden sein."
                )
                lm += (
                    "expected_element_type muss "
                    "field_extraction, validation oder exploration sein."
                )

            with user():
                lm += "Dokumenttyp:\n"
                lm += f"{stringify(doc_type)}\n"
                lm += "Dokument-ID:\n"
                lm += f"{stringify(doc_id)}\n"
                lm += "Dateiname:\n"
                lm += f"{stringify(file_name)}\n"
                lm += "EXTRAKTION (JSON):\n"
                lm += f"{stringify(extraction_payload)}\n"
                lm += "OCR TEXT:\n"
                lm += f"{stringify(ocr_payload)}\n"
                lm += "FELD-SCHEMA (JSON):\n"
                lm += f"{stringify(schema_payload)}\n"
                lm += "VISUELLE ELEMENTE (JSON):\n"
                lm += f"{stringify(elements_payload)}\n"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=VisualQueryGenerationOutput,
                )

            return lm

        return visual_query_generator
