from typing import List, Literal

from guidance import guidance, system, user, assistant, json as gen_json
from pydantic import BaseModel, Field


def _pick_text(*values):
    for value in values:
        if value not in (None, "", "N/A"):
            return value
    return ""


def _stringify(value):
    if value in (None, "N/A"):
        return ""
    if isinstance(value, str):
        return value
    return str(value)


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


class GeneralTemplatesDE:
    """German-language general document extraction templates (Fallback pipeline)."""

    @staticmethod
    def get_general_classifier():
        """Classify unstructured German documents (Stage 4.1 pre-processing)."""
        @guidance
        def general_classifier(lm, document_text=None, text_chunk=None, **kwargs):
            text = _pick_text(document_text, text_chunk)
            with system():
                lm += (
                    "Du bist ein Dokumentklassifizierer für deutschsprachige Allgemeindokumente.\n"
                    "Deine Aufgabe: Klassifiziere unstrukturierte oder gemischte Dokumente.\n"
                    "Erkenne: Dokumenttyp, Sprache, Wichtigste Entitäten, Vertrauensscore."
                )
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
        def general_extractor(lm, document_text=None, text_chunk=None, **kwargs):
            text = _pick_text(document_text, text_chunk)
            with system():
                lm += (
                    "Du bist ein Dokumentanalyst für deutschsprachige Allgemeindokumente. "
                    "Extrahiere Zusammenfassung, Schlüsselwörter und Entitäten."
                )
            with user():
                lm += "Dokument:\n"
                lm += f"{text}\n"
                lm += "Extrahiere: Zusammenfassung, Schlüsselwörter, Entitäten, Daten."
            with assistant():
                lm += gen_json(name="output", schema=GeneralExtractorOutput)
            return lm

        return general_extractor

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
            **kwargs
        ):
            document_type = _pick_text(doc_type, kwargs.get("document_type"), kwargs.get("dokumenttyp"))
            theme_text = _stringify(_pick_text(themes, kwargs.get("themata"), kwargs.get("themes")))
            financial_text = _stringify(_pick_text(has_financial, kwargs.get("enthaelt_finanzen")))
            medical_text = _stringify(_pick_text(has_medical, kwargs.get("enthaelt_medizin")))
            legal_text = _stringify(_pick_text(has_legal, kwargs.get("enthaelt_recht")))
            summary_text = _stringify(_pick_text(summary, kwargs.get("zusammenfassung"), kwargs.get("summary")))
            with system():
                lm += (
                    "Du bist ein Dokumentrouter für die Paperless-AI Pipeline. "
                    "Nach Vorklassifizierung: "
                    "Sollte dieses Dokument zu Medical, Financial, Legal, oder General gehen? "
                    "Gib klare Empfehlung mit Begründung."
                )
            with user():
                lm += "Klassifiziertes Dokument:\n"
                lm += f"Dokumenttyp: {document_type}\n"
                if summary_text:
                    lm += f"Zusammenfassung: {summary_text}\n"
                lm += f"Erkannte Themata: {theme_text}\n"
                lm += f"Enthält finanzielle Daten: {financial_text}\n"
                lm += f"Enthält medizinische Daten: {medical_text}\n"
                lm += f"Enthält rechtliche Begriffe: {legal_text}\n"
                lm += "Welche Pipeline?"
            with assistant():
                lm += gen_json(name="output", schema=CrossPipelineRouterOutput)
            return lm

        return cross_pipeline_router
