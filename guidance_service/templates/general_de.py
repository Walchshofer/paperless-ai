"""German-language templates for document classification, extraction, and
routing.

Uses Guidance framework for structured LLM outputs with Pydantic
validation. Includes fallback stubs for editor/static-analysis
compatibility.

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


class GeneralClassifierOutput(BaseModel):
    """Output schema for general document classification.

    Attributes:
        dokumenttyp: Type of document
        sprache: Document language
        themata: List of document themes/topics
        enthaelt_finanzen: Whether document contains financial data
        enthaelt_personendaten: Whether document contains personal data
        vertrauen: Confidence score (0-1)
    """

    dokumenttyp: Literal[
        "Korrespondenz",
        "Bericht",
        "Zusammenfassung",
        "Sonstige",
    ]
    sprache: Literal["Deutsch"]
    themata: List[str]
    enthaelt_finanzen: bool
    enthaelt_personendaten: bool
    vertrauen: float = Field(ge=0, le=1, description="Confidence score")

    model_config = dict(extra="forbid")


class GeneralExtractorOutput(BaseModel):
    """Output schema for general document extraction.

    Attributes:
        zusammenfassung: Document summary
        schluesselwoerter: Document keywords
        entitaeten: Named entities identified
        daten: Dates/temporal information
        vertrauen: Confidence score (0-1)
    """

    zusammenfassung: str
    schluesselwoerter: List[str]
    entitaeten: List[str]
    daten: List[str]
    vertrauen: float = Field(ge=0, le=1, description="Confidence score")

    model_config = dict(extra="forbid")


class CrossPipelineRouterOutput(BaseModel):
    """Output schema for cross-pipeline routing recommendation.

    Attributes:
        empfehlung: Recommended pipeline destination
        begruendung: Rationale for recommendation
        sicherheit: Confidence in recommendation (0-1)
    """

    empfehlung: Literal["Medical", "Financial", "Legal", "General"]
    begruendung: str
    sicherheit: float = Field(
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


class GeneralTemplatesDE:
    """German-language general document extraction templates.

    This class provides reusable Guidance templates for extracting and
    analyzing general documents in German contexts.

    Each template is decorated with @guidance and returns a callable that
    can be used with Guidance language models.
    """

    @staticmethod
    def get_general_classifier() -> Callable:
        """Classify unstructured German documents (Stage 4.1).

        Returns:
            Guidance template function for document classification

        Example:
            >>> classifier = (
            ...     GeneralTemplatesDE.get_general_classifier()
            ... )
            >>> lm = model + classifier(
            ...     document_text="Ein Schreiben..."
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def general_classifier(
            lm: Any,
            document_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Classify document and extract metadata.

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
                f"Classifying document from domain: {domain}"
            )

            with system():
                lm += (
                    "Du bist ein Dokumentklassifizierer für "
                    "deutschsprachige Allgemeindokumente."
                )
                lm += (
                    "Deine Aufgabe: Klassifiziere unstrukturierte "
                    "oder gemischte Dokumente."
                )
                lm += (
                    "Erkenne: Dokumenttyp, Sprache, "
                    "wichtigste Entitäten und Vertrauensscore."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += "Dokument (erste 1000 Zeichen):\n"
                lm += f"{text}\n"
                lm += "Klassifiziere:\n"
                lm += (
                    "- Dokumenttyp: Korrespondenz, Bericht, "
                    "Zusammenfassung, Sonstige\n"
                )
                lm += "- Sprache: Deutsch\n"
                lm += (
                    "- Enthält finanzielle Daten? (ja/nein)\n"
                )
                lm += (
                    "- Enthält personelle Daten? (ja/nein)"
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=GeneralClassifierOutput,
                )

            return lm

        return general_classifier

    @staticmethod
    def get_general_extractor() -> Callable:
        """Extract metadata from general documents.

        Returns:
            Guidance template function for metadata extraction

        Example:
            >>> extractor = (
            ...     GeneralTemplatesDE.get_general_extractor()
            ... )
            >>> lm = model + extractor(
            ...     document_text="Ein Bericht..."
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def general_extractor(
            lm: Any,
            document_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract metadata from document.

            Args:
                lm: Language model instance
                document_text: Full document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Existing tags for context
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction result
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
                f"Extracting metadata from domain: {domain}"
            )

            with system():
                lm += (
                    "Du bist ein Dokumentanalyst für "
                    "deutschsprachige Allgemeindokumente."
                )
                lm += (
                    "Extrahiere Zusammenfassung, Schlüsselwörter "
                    "und Entitäten."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += "Dokument:\n"
                lm += f"{text}\n"
                lm += (
                    "Extrahiere: Zusammenfassung, Schlüsselwörter, "
                    "Entitäten und Daten."
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=GeneralExtractorOutput,
                )

            return lm

        return general_extractor

    @staticmethod
    def get_general_extractor_v2() -> Callable:
        """Extract metadata + tag suggestions (v2).

        Returns:
            Guidance template function for extraction with tagging

        Example:
            >>> extractor_v2 = (
            ...     GeneralTemplatesDE.get_general_extractor_v2()
            ... )
            >>> lm = model + extractor_v2(
            ...     document_text="Ein Bericht...",
            ...     existing_tags=["report", "urgent"]
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def general_extractor_v2(
            lm: Any,
            document_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract metadata and suggest tags.

            Args:
                lm: Language model instance
                document_text: Full document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Tags for constraining suggestions
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction and tags
            """
            text = pick_text(document_text, text_chunk)
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )

            try:
                tag_schema = _build_tagged_schema(
                    GeneralExtractorOutput,
                    existing_tag_list,
                )
            except Exception as e:
                logger.error(f"Failed to build tag schema: {e}")
                tag_schema = GeneralExtractorOutput

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
                f"Extracting metadata with tagging from domain: "
                f"{domain}, tags: {len(existing_tag_list)}"
            )

            with system():
                lm += (
                    "Du bist ein Dokumentanalyst für "
                    "deutschsprachige Allgemeindokumente."
                )
                lm += (
                    "Extrahiere Zusammenfassung, Schlüsselwörter "
                    "und Entitäten.\n"
                    "Gib auch Tag-Vorschläge im "
                    "Tagging-Schema zurück."
                )
                lm += (
                    "\nTagging-Regeln:\n"
                    "- suggested_tags: nur aus bestehenden Tags\n"
                    "- missing_tags: neue Tag-Kandidaten\n"
                    "- tagging.domain: 'general'\n"
                    "- tagging.source: 'guidance_tagger_v2'\n"
                    "- tagging.confidence.overall: "
                    "zwischen 0 und 1"
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += "Dokument:\n"
                lm += f"{text}\n"
                lm += (
                    "Extrahiere: Zusammenfassung, Schlüsselwörter, "
                    "Entitäten, Daten und Tags."
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=tag_schema,
                )

            return lm

        return general_extractor_v2

    @staticmethod
    def get_cross_pipeline_router() -> Callable:
        """Route document to appropriate pipeline.

        Returns:
            Guidance template function for pipeline routing

        Example:
            >>> router = (
            ...     GeneralTemplatesDE.get_cross_pipeline_router()
            ... )
            >>> lm = model + router(
            ...     doc_type="Rechnung",
            ...     has_financial=True,
            ...     classifier_output={...}
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def cross_pipeline_router(
            lm: Any,
            doc_type: Optional[str] = None,
            summary: Optional[str] = None,
            themes: Optional[List[str]] = None,
            has_financial: Optional[bool] = None,
            has_medical: Optional[bool] = None,
            has_legal: Optional[bool] = None,
            has_personal: Optional[bool] = None,
            classifier_output: Optional[
                Dict[str, Any]
            ] = None,
            extractor_output: Optional[Dict[str, Any]] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Route document to appropriate pipeline.

            Args:
                lm: Language model instance
                doc_type: Document type
                summary: Document summary
                themes: Document themes
                has_financial: Financial content indicator
                has_medical: Medical content indicator
                has_legal: Legal content indicator
                has_personal: Personal data indicator
                classifier_output: Previous classifier output
                extractor_output: Previous extractor output
                domain: Domain context
                existing_tags: Existing tags
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with routing recommendation
            """
            # Normalize outputs
            classifier_output = (
                classifier_output
                or kwargs.get("classifier_output")
                or {}
            )
            extractor_output = (
                extractor_output
                or kwargs.get("extractor_output")
                or {}
            )

            if not isinstance(classifier_output, dict):
                classifier_output = {}
            if not isinstance(extractor_output, dict):
                extractor_output = {}

            # Extract fields with fallbacks
            document_type = pick_text(
                doc_type,
                kwargs.get("document_type"),
                kwargs.get("dokumenttyp"),
                classifier_output.get("dokumenttyp"),
            )
            theme_text = stringify(
                pick_text(
                    themes,
                    kwargs.get("themata"),
                    kwargs.get("themes"),
                    classifier_output.get("themata"),
                )
            )
            financial_text = stringify(
                pick_text(
                    has_financial,
                    kwargs.get("enthaelt_finanzen"),
                    classifier_output.get("enthaelt_finanzen"),
                )
            )
            medical_text = stringify(
                pick_text(
                    has_medical,
                    kwargs.get("enthaelt_medizin"),
                    classifier_output.get("enthaelt_medizin"),
                )
            )
            legal_text = stringify(
                pick_text(
                    has_legal,
                    kwargs.get("enthaelt_recht"),
                    classifier_output.get("enthaelt_recht"),
                )
            )
            personal_text = stringify(
                pick_text(
                    has_personal,
                    kwargs.get("enthaelt_personendaten"),
                    classifier_output.get(
                        "enthaelt_personendaten"
                    ),
                )
            )
            summary_text = stringify(
                pick_text(
                    summary,
                    kwargs.get("zusammenfassung"),
                    kwargs.get("summary"),
                    extractor_output.get("zusammenfassung"),
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

            logger.debug("Routing document to appropriate pipeline")

            with system():
                lm += (
                    "Du bist ein Dokumentrouter für die "
                    "Paperless-AI Pipeline."
                )
                lm += (
                    "Nach Vorklassifizierung: sollte dieses "
                    "Dokument zu Medical, Financial, Legal "
                    "oder General gehen?"
                )
                lm += (
                    "Gib eine klare Empfehlung mit "
                    "Begründung."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += "Klassifiziertes Dokument:\n"
                lm += f"Dokumenttyp: {document_type}\n"
                if summary_text:
                    lm += (
                        f"Zusammenfassung: {summary_text}\n"
                    )
                lm += f"Erkannte Themata: {theme_text}\n"
                lm += (
                    f"Enthält finanzielle Daten: "
                    f"{financial_text}\n"
                )
                lm += (
                    f"Enthält medizinische Daten: "
                    f"{medical_text}\n"
                )
                lm += (
                    f"Enthält rechtliche Begriffe: "
                    f"{legal_text}\n"
                )
                if personal_text:
                    lm += (
                        f"Enthält personenbezogene Daten: "
                        f"{personal_text}\n"
                    )
                lm += "Welche Pipeline?"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=CrossPipelineRouterOutput,
                )

            return lm

        return cross_pipeline_router
