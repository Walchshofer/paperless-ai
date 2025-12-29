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


class MedicalTemplatesDE:
    """German-language medical extraction templates."""

    @staticmethod
    def get_medical_classifier():
        @guidance
        def medical_classifier(
            lm,
            document_text=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(document_text, text_chunk, kwargs.get("medical_text"))
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += "Du bist ein medizinischer Dokumentklassifizierer. Antworte nur mit JSON."
                if domain_context:
                    lm += f"\n{domain_context}"
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
        def medical_extractor(
            lm,
            medical_text=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(medical_text, text_chunk, kwargs.get("document_text"))
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += (
                    "Du bist ein medizinischer Datenextraktionist für deutschsprachige Dokumente. "
                    "Antworte nur mit JSON."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
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
        def medical_integrator(
            lm,
            imaging_analysis=None,
            text_extraction=None,
            prior_context=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            imaging_text = stringify(pick_text(imaging_analysis, kwargs.get("imaging")))
            text_text = stringify(pick_text(text_extraction, kwargs.get("text")))
            prior_text = stringify(pick_text(prior_context, kwargs.get("context")))
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += "Harmonisiere Bild- und Textdaten."
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Bild: {imaging_text} Text: {text_text}"
                if prior_text:
                    lm += f" Kontext: {prior_text}"
            with assistant():
                lm += gen_json(name="output", schema=MedicalIntegratorOutput)
            return lm

        return medical_integrator

    @staticmethod
    def get_medical_integrator_v2():
        @guidance
        def medical_integrator_v2(
            lm,
            imaging_analysis=None,
            text_extraction=None,
            prior_context=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            imaging_text = stringify(pick_text(imaging_analysis, kwargs.get("imaging")))
            text_text = stringify(pick_text(text_extraction, kwargs.get("text")))
            prior_text = stringify(pick_text(prior_context, kwargs.get("context")))
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                MedicalIntegratorOutput,
                existing_tag_list
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
            )
            with system():
                lm += "Harmonisiere Bild- und Textdaten."
                lm += (
                    "\nZusätzlich: gib Tag-Vorschläge im Tagging-Schema zurück. "
                    "suggested_tags nur aus bestehenden Tags, missing_tags für neue Kandidaten. "
                    "tagging.domain='medical', tagging.source='guidance_tagger_v2', "
                    "tagging.confidence.overall zwischen 0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Bild: {imaging_text} Text: {text_text}"
                if prior_text:
                    lm += f" Kontext: {prior_text}"
            with assistant():
                lm += gen_json(name="output", schema=tag_schema)
            return lm

        return medical_integrator_v2
