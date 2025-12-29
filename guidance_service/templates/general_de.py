from typing import List, Literal
import os

from guidance import guidance, system, user, assistant, json as gen_json
from pydantic import BaseModel, Field, create_model

from templates.components.common import (
    build_domain_context,
    pick_text,
    stringify,
    normalize_tags,
)

TAG_SELECT_MAX = int(os.getenv("GUIDANCE_TAG_SELECT_MAX", "50"))
TAG_SUGGESTION_LIMIT = int(os.getenv("GUIDANCE_TAG_SUGGESTION_LIMIT", "5"))
TAG_MISSING_LIMIT = int(os.getenv("GUIDANCE_TAG_MISSING_LIMIT", "5"))


class GeneralClassifierOutput(BaseModel):
    dokumenttyp: Literal["Korrespondenz", "Bericht", "Zusammenfassung", "Sonstige"]
    sprache: Literal["Deutsch"]
    themata: List[str]
    enthaelt_finanzen: bool
    enthaelt_personendaten: bool
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class GeneralExtractorOutput(BaseModel):
    zusammenfassung: str
    schluesselwoerter: List[str]
    entitaeten: List[str]
    daten: List[str]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class CrossPipelineRouterOutput(BaseModel):
    empfehlung: Literal["Medical", "Financial", "Legal", "General"]
    begruendung: str
    sicherheit: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingTagConfidence(BaseModel):
    tag: str
    confidence: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingConfidence(BaseModel):
    overall: float = Field(ge=0, le=1)
    tags: List[TaggingTagConfidence] = Field(default_factory=list)

    model_config = dict(extra="forbid")


class TaggingMetadata(BaseModel):
    domain: str
    source: str
    confidence: TaggingConfidence

    model_config = dict(extra="forbid")


def _build_tagged_schema(base_model, existing_tags):
    allowed_tags = list(dict.fromkeys(normalize_tags(existing_tags)))
    use_select = allowed_tags and len(allowed_tags) <= TAG_SELECT_MAX
    if use_select:
        tag_literal = Literal[tuple(allowed_tags)]
        suggested_type = List[tag_literal]
    else:
        suggested_type = List[str]

    return create_model(
        f"{base_model.__name__}Tagged",
        suggested_tags=(
            suggested_type,
            Field(default_factory=list, max_items=TAG_SUGGESTION_LIMIT),
        ),
        missing_tags=(
            List[str],
            Field(default_factory=list, max_items=TAG_MISSING_LIMIT),
        ),
        tagging=(TaggingMetadata, ...),
        __base__=base_model,
    )


class GeneralTemplatesDE:
    """German-language general document extraction templates (Fallback pipeline)."""

    @staticmethod
    def get_general_classifier():
        """Classify unstructured German documents (Stage 4.1 pre-processing)."""
        @guidance
        def general_classifier(
            lm,
            document_text=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(document_text, text_chunk)
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += (
                    "Du bist ein Dokumentklassifizierer für deutschsprachige Allgemeindokumente.\n"
                    "Deine Aufgabe: Klassifiziere unstrukturierte oder gemischte Dokumente.\n"
                    "Erkenne: Dokumenttyp, Sprache, Wichtigste Entitäten, Vertrauensscore."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += "Dokument (erste 1000 Zeichen):\n"
                lm += f"{text}\n"
                lm += "Klassifiziere:\n"
                lm += "- Dokumenttyp: Korrespondenz, Bericht, Zusammenfassung, Sonstige\n"
                lm += "- Sprache: Deutsch\n"
                lm += "- Enthält finanzielle Daten? (ja/nein)\n"
                lm += "- Enthält personelle Daten? (ja/nein)"
            with assistant():
                lm += gen_json(name="output", schema=GeneralClassifierOutput)
            return lm

        return general_classifier

    @staticmethod
    def get_general_extractor():
        """Extract metadata from general documents."""
        @guidance
        def general_extractor(
            lm,
            document_text=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(document_text, text_chunk)
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += (
                    "Du bist ein Dokumentanalyst für deutschsprachige Allgemeindokumente. "
                    "Extrahiere Zusammenfassung, Schlüsselwörter und Entitäten."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += "Dokument:\n"
                lm += f"{text}\n"
                lm += "Extrahiere: Zusammenfassung, Schlüsselwörter, Entitäten, Daten."
            with assistant():
                lm += gen_json(name="output", schema=GeneralExtractorOutput)    
            return lm

        return general_extractor

    @staticmethod
    def get_general_extractor_v2():
        """Extract metadata + tag suggestions from general documents (v2)."""
        @guidance
        def general_extractor_v2(
            lm,
            document_text=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(document_text, text_chunk)
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                GeneralExtractorOutput,
                existing_tag_list
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
            )
            with system():
                lm += (
                    "Du bist ein Dokumentanalyst für deutschsprachige Allgemeindokumente. "
                    "Extrahiere Zusammenfassung, Schlüsselwörter und Entitäten. "
                    "Zusätzlich: gib Tag-Vorschläge im Tagging-Schema zurück."
                )
                lm += (
                    "\nTagging-Regeln: suggested_tags nur aus bestehenden Tags, "
                    "missing_tags für neue Kandidaten. "
                    "tagging.domain='general', tagging.source='guidance_tagger_v2', "
                    "tagging.confidence.overall zwischen 0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += "Dokument:\n"
                lm += f"{text}\n"
                lm += "Extrahiere: Zusammenfassung, Schlüsselwörter, Entitäten, Daten."
            with assistant():
                lm += gen_json(name="output", schema=tag_schema)
            return lm

        return general_extractor_v2

    @staticmethod
    def get_cross_pipeline_router():
        """Route document to appropriate pipeline after initial triage."""
        @guidance
        def cross_pipeline_router(
            lm,
            doc_type=None,
            summary=None,
            themes=None,
            has_financial=None,
            has_medical=None,
            has_legal=None,
            has_personal=None,
            classifier_output=None,
            extractor_output=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            classifier_output = classifier_output or kwargs.get("classifier_output") or {}
            extractor_output = extractor_output or kwargs.get("extractor_output") or {}
            if not isinstance(classifier_output, dict):
                classifier_output = {}
            if not isinstance(extractor_output, dict):
                extractor_output = {}
            classifier_doc_info = classifier_output.get("document_info")
            if not isinstance(classifier_doc_info, dict):
                classifier_doc_info = {}
            extractor_doc_info = extractor_output.get("document_info")
            if not isinstance(extractor_doc_info, dict):
                extractor_doc_info = {}
            extractor_summary = extractor_output.get("summary")
            if not isinstance(extractor_summary, dict):
                extractor_summary = {}

            document_type = pick_text(
                doc_type,
                kwargs.get("document_type"),
                kwargs.get("dokumenttyp"),
                classifier_output.get("dokumenttyp"),
                classifier_doc_info.get("detected_type"),
                extractor_doc_info.get("detected_type")
            )
            theme_text = stringify(pick_text(
                themes,
                kwargs.get("themata"),
                kwargs.get("themes"),
                classifier_output.get("themata")
            ))
            financial_text = stringify(pick_text(
                has_financial,
                kwargs.get("enthaelt_finanzen"),
                classifier_output.get("enthaelt_finanzen")
            ))
            medical_text = stringify(pick_text(
                has_medical,
                kwargs.get("enthaelt_medizin"),
                classifier_output.get("enthaelt_medizin")
            ))
            legal_text = stringify(pick_text(
                has_legal,
                kwargs.get("enthaelt_recht"),
                classifier_output.get("enthaelt_recht")
            ))
            personal_text = stringify(pick_text(
                has_personal,
                kwargs.get("enthaelt_personendaten"),
                classifier_output.get("enthaelt_personendaten")
            ))
            summary_text = stringify(pick_text(
                summary,
                kwargs.get("zusammenfassung"),
                kwargs.get("summary"),
                extractor_output.get("zusammenfassung"),
                extractor_summary.get("brief")
            ))
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += (
                    "Du bist ein Dokumentrouter für die Paperless-AI Pipeline. "
                    "Nach Vorklassifizierung: "
                    "Sollte dieses Dokument zu Medical, Financial, Legal, oder General gehen? "
                    "Gib klare Empfehlung mit Begründung."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += "Klassifiziertes Dokument:\n"
                lm += f"Dokumenttyp: {document_type}\n"
                if summary_text:
                    lm += f"Zusammenfassung: {summary_text}\n"
                lm += f"Erkannte Themata: {theme_text}\n"
                lm += f"Enthält finanzielle Daten: {financial_text}\n"
                lm += f"Enthält medizinische Daten: {medical_text}\n"
                lm += f"Enthält rechtliche Begriffe: {legal_text}\n"
                if personal_text:
                    lm += f"Enthält personenbezogene Daten: {personal_text}\n"
                lm += "Welche Pipeline?"
            with assistant():
                lm += gen_json(name="output", schema=CrossPipelineRouterOutput)
            return lm

        return cross_pipeline_router
