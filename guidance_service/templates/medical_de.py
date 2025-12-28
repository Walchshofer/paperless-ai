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


class MedicalClassifierOutput(BaseModel):
    dokumenttyp: Literal[
        "Laborbefund",
        "Radiologiebericht",
        "Klinische Notiz",
        "Krankenkassenbeleg",
        "Sonstige",
    ]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class MedicalPatient(BaseModel):
    name: str
    geburtsdatum: str

    model_config = dict(extra="forbid")


class MedicalDiagnosis(BaseModel):
    icd10: str

    model_config = dict(extra="forbid")


class MedicalMedication(BaseModel):
    name: str
    dosierung: str

    model_config = dict(extra="forbid")


class MedicalLabValue(BaseModel):
    name: str
    wert: str
    einheit: str

    model_config = dict(extra="forbid")


class MedicalExtractorOutput(BaseModel):
    patient: MedicalPatient
    diagnosen: List[MedicalDiagnosis]
    medikamente: List[MedicalMedication]
    laborwerte: List[MedicalLabValue]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class MedicalIntegratorOutput(BaseModel):
    primaerdiagnose: str

    model_config = dict(extra="forbid")


class MedicalTemplatesDE:
    """German-language medical extraction templates."""

    @staticmethod
    def get_medical_classifier():
        @guidance
        def medical_classifier(lm, document_text=None, text_chunk=None, **kwargs):
            text = _pick_text(document_text, text_chunk, kwargs.get("medical_text"))
            with system():
                lm += "Du bist ein medizinischer Dokumentklassifizierer. Antworte nur mit JSON."
            with user():
                lm += f"Dokumenttext: {text}\n"
                lm += "Klassifiziere in: Laborbefund, Radiologiebericht, Klinische Notiz, Krankenkassenbeleg, Sonstige"
            with assistant():
                lm += gen_json(name="output", schema=MedicalClassifierOutput)
            return lm

        return medical_classifier

    @staticmethod
    def get_medical_extractor():
        @guidance
        def medical_extractor(lm, medical_text=None, text_chunk=None, **kwargs):
            text = _pick_text(medical_text, text_chunk, kwargs.get("document_text"))
            with system():
                lm += (
                    "Du bist ein medizinischer Datenextraktionist für deutschsprachige Dokumente. "
                    "Antworte nur mit JSON."
                )
            with user():
                lm += f"Medizinischer Text: {text}\n"
                lm += "Extrahiere: Patient, Diagnosen (ICD-10), Medikamente, Laborwerte."
            with assistant():
                lm += gen_json(name="output", schema=MedicalExtractorOutput)
            return lm

        return medical_extractor

    @staticmethod
    def get_medical_integrator():
        @guidance
        def medical_integrator(lm, imaging_analysis=None, text_extraction=None, prior_context=None, **kwargs):
            imaging_text = _stringify(_pick_text(imaging_analysis, kwargs.get("imaging")))
            text_text = _stringify(_pick_text(text_extraction, kwargs.get("text")))
            prior_text = _stringify(_pick_text(prior_context, kwargs.get("context")))
            with system():
                lm += "Harmonisiere Bild- und Textdaten."
            with user():
                lm += f"Bild: {imaging_text} Text: {text_text}"
                if prior_text:
                    lm += f" Kontext: {prior_text}"
            with assistant():
                lm += gen_json(name="output", schema=MedicalIntegratorOutput)
            return lm

        return medical_integrator
