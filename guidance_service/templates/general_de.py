"""German-language templates for document classification, extraction, and
routing.

Uses Guidance framework for structured LLM outputs with Pydantic
validation. Includes fallback stubs for editor/static-analysis
compatibility.
"""

import os
from typing import Any, Callable, Dict, List, Literal, Optional

try:
    from guidance import (  # type: ignore[import-not-found]
        assistant,
        gen_json,
        guidance,
        system,
        user,
    )
except ImportError:
    # Editor/static-analysis friendly fallbacks for guidance
    # decorators/context managers
    def guidance(f: Callable) -> Callable:
        """Fallback guidance decorator."""
        return f

    def _ctx() -> Any:
        """Context manager stub."""

        class _C:
            def __enter__(self) -> None:
                return None

            def __exit__(
                self,
                exc_type: Any,
                exc: Any,
                tb: Any,
            ) -> bool:
                return False

        return _C()

    def system() -> Any:
        """Fallback system context manager."""
        return _ctx()

    def user() -> Any:
        """Fallback user context manager."""
        return _ctx()

    def assistant() -> Any:
        """Fallback assistant context manager."""
        return _ctx()

    def gen_json(
        *args: Any,
        **kwargs: Any,
    ) -> str:
        """Fallback gen_json function."""
        return ""


from pydantic import BaseModel, Field, create_model

from templates.components.common import (
    build_domain_context,
    normalize_tags,
    pick_text,
    stringify,
)

TAG_SELECT_MAX = int(os.getenv("GUIDANCE_TAG_SELECT_MAX", "50"))
TAG_SUGGESTION_LIMIT = int(
    os.getenv("GUIDANCE_TAG_SUGGESTION_LIMIT", "5")
)
TAG_MISSING_LIMIT = int(os.getenv("GUIDANCE_TAG_MISSING_LIMIT", "5"))


class GeneralClassifierOutput(BaseModel):
    """Output schema for general document classification."""

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
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class GeneralExtractorOutput(BaseModel):
    """Output schema for general document extraction."""

    zusammenfassung: str
    schluesselwoerter: List[str]
    entitaeten: List[str]
    daten: List[str]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class CrossPipelineRouterOutput(BaseModel):
    """Output schema for cross-pipeline routing recommendation."""

    empfehlung: Literal["Medical", "Financial", "Legal", "General"]
    begruendung: str
    sicherheit: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingTagConfidence(BaseModel):
    """Confidence score for individual tag."""

    tag: str
    confidence: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingConfidence(BaseModel):
    """Overall and per-tag confidence scores."""

    overall: float = Field(ge=0, le=1)
    tags: List[TaggingTagConfidence] = Field(default_factory=list)

    model_config = dict(extra="forbid")


class TaggingMetadata(BaseModel):
    """Metadata for tagging output."""

    domain: str
    source: str
    confidence: TaggingConfidence

    model_config = dict(extra="forbid")


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
    """
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
    else:
        suggested_type = List[str]

    return create_model(
        f"{base_model.__name__}Tagged",
        suggested_tags=(
            suggested_type,
            Field(
                default_factory=list,
                max_items=TAG_SUGGESTION_LIMIT,
            ),
        ),
        missing_tags=(
            List[str],
            Field(default_factory=list, max_items=TAG_MISSING_LIMIT),
        ),
        tagging=(TaggingMetadata, ...),
        __base__=base_model,
    )


class GeneralTemplatesDE:
    """German-language general document extraction templates
    (fallback)."""

    @staticmethod
    def get_general_classifier() -> Callable:
        """Classify unstructured German documents (Stage 4.1).

        Returns:
            Guidance template function for document classification
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
            """Classify document and extract metadata."""
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

            with system():
                lm += (
                    "Du bist ein Dokumentklassifizierer für "
                    "deutschsprachige\nAllgemeindokumente."
                )
                lm += (
                    "Deine Aufgabe: Klassifiziere "
                    "unstrukturierte oder\ngemischte Dokumente."
                )
                lm += (
                    "Erkenne: Dokumenttyp, Sprache, "
                    "wichtigste Entitäten und\n"
                    "einen Vertrauensscore."
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
                    "- Enthält finanzielle Daten? "
                    "(ja/nein)\n"
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
            """Extract metadata from document."""
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

            with system():
                lm += (
                    "Du bist ein Dokumentanalyst für\n"
                    "deutschsprachige Allgemeindokumente."
                )
                lm += (
                    "Extrahiere Zusammenfassung, "
                    "Schlüsselwörter\nund Entitäten."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += "Dokument:\n"
                lm += f"{text}\n"
                lm += (
                    "Extrahiere: Zusammenfassung, "
                    "Schlüsselwörter,\n"
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
            Guidance template function for extraction with
            tagging
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
            """Extract metadata and suggest tags."""
            text = pick_text(document_text, text_chunk)
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                GeneralExtractorOutput,
                existing_tag_list,
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            with system():
                lm += (
                    "Du bist ein Dokumentanalyst für\n"
                    "deutschsprachige Allgemeindokumente."
                )
                lm += (
                    "Extrahiere Zusammenfassung, "
                    "Schlüsselwörter und\nEntitäten."
                )
                lm += (
                    "Zusätzlich: gib Tag-Vorschläge im "
                    "Tagging-Schema\nzurück."
                )
                lm += (
                    "Tagging-Regeln: suggested_tags nur aus "
                    "bestehenden\nTags; missing_tags für neue "
                    "Kandidaten.\n"
                    "tagging.domain='general',\n"
                    "tagging.source='guidance_tagger_v2'.\n"
                    "tagging.confidence.overall zwischen "
                    "0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += "Dokument:\n"
                lm += f"{text}\n"
                lm += (
                    "Extrahiere: Zusammenfassung, "
                    "Schlüsselwörter,\n"
                    "Entitäten und Daten."
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
            """Route document to appropriate pipeline."""
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

            classifier_doc_info: Dict[str, Any] = (
                classifier_output.get("document_info") or {}
            )
            if not isinstance(classifier_doc_info, dict):
                classifier_doc_info = {}

            extractor_doc_info: Dict[str, Any] = (
                extractor_output.get("document_info") or {}
            )
            if not isinstance(extractor_doc_info, dict):
                extractor_doc_info = {}

            extractor_summary: Dict[str, Any] = (
                extractor_output.get("summary") or {}
            )
            if not isinstance(extractor_summary, dict):
                extractor_summary = {}

            # Extract fields with fallbacks
            document_type = pick_text(
                doc_type,
                kwargs.get("document_type"),
                kwargs.get("dokumenttyp"),
                classifier_output.get("dokumenttyp"),
                classifier_doc_info.get("detected_type"),
                extractor_doc_info.get("detected_type"),
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
                    kwargs.get(
                        "enthaelt_personendaten"
                    ),
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
                    extractor_summary.get("brief"),
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

            with system():
                lm += (
                    "Du bist ein Dokumentrouter für die\n"
                    "Paperless-AI Pipeline."
                )
                lm += (
                    "Nach Vorklassifizierung: sollte dieses "
                    "Dokument zu\n"
                    "Medical, Financial, Legal oder "
                    "General gehen?"
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
                    lm += f"Zusammenfassung: {summary_text}\n"
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
