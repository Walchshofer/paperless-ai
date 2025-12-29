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


class LegalClassifierOutput(BaseModel):
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
    vermutete_jurisdiktion: Literal["Österreich", "Deutschland", "EU-weit", "International"]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class LegalParties(BaseModel):
    partei_1: str
    partei_2: str

    model_config = dict(extra="forbid")


class LegalDates(BaseModel):
    abschluss_datum: str
    gueltig_ab: str

    model_config = dict(extra="forbid")


class LegalJurisdiction(BaseModel):
    anwendbares_recht: Literal[
        "Österreich (ABGB)",
        "Deutschland (BGB)",
        "Schweiz (ZGB)",
        "Europäisches Recht",
        "Schiedsverfahren",
    ]

    model_config = dict(extra="forbid")


class LegalExtractorOutput(BaseModel):
    vertragsparteien: LegalParties
    daten: LegalDates
    jurisdiktion_und_recht: LegalJurisdiction
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class LegalValidatorOutput(BaseModel):
    valid: bool
    issues: List[str]
    vertrauen: float = Field(ge=0, le=1)

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


class LegalTemplatesDE:
    """German-language legal contract extraction templates."""

    @staticmethod
    def get_legal_classifier():
        """Classify legal document type and complexity (Stage 3.1)."""
        @guidance
        def legal_classifier(
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
                    "Du bist ein Rechtsdokument-Klassifizierer spezialisiert auf deutschösterreichische "
                    "Verträge.\n"
                    "Klassifiziere das Dokument nach Typ, Komplexität und Jurisdiktion."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += "Rechtsdokument (erste 500 Zeichen):\n"
                lm += f"{text}\n"
                lm += "Klassifiziere nach:\n"
                lm += "- Dokumenttyp: Kaufvertrag, Mietvertrag, Arbeitsvertrag, Servicevertrag, NDA, Lizenzvertrag\n"
                lm += "- Komplexität: Einfach, Mittel, Komplex\n"
                lm += "- Vermutete Jurisdiktion: Österreich, Deutschland, EU-weit, International"
            with assistant():
                lm += gen_json(name="output", schema=LegalClassifierOutput)
            return lm

        return legal_classifier

    @staticmethod
    def get_legal_extractor():
        """Extract contract data with reasoning (Stage 3.2 - llm-pro-finance-8b)."""
        @guidance
        def legal_extractor(
            lm,
            legal_text=None,
            legal_context=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(legal_text, text_chunk)
            context_text = stringify(pick_text(legal_context, kwargs.get("context")))
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += (
                    "Du bist ein Rechtsanwalt und Vertragsspzialist für Österreich und Deutschland.\n"
                    "Deine Aufgabe: Extrahiere wichtige Vertragsdetails als valides JSON. "
                    "Verwende den bereitgestellten Rechtskontext zur Interpretation zweifelhafter Klauseln.\n"
                    f"Rechtskontext: {context_text}"
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Österreichischer/deutscher Vertrag: {text}\n\n"
                lm += "Extrahiere bitte:\n"
                lm += "Vertragsparteien (mit vollständigem Namen)\n"
                lm += "Vertragsdatum und Gültigkeitsdauer\n"
                lm += "Wichtigste 5 Klauseln\n"
                lm += "Haftungsausschlüsse\n"
                lm += "Beendigungsbedingungen\n"
                lm += "Geltende Jurisdiktion und anwendbares Recht"
            with assistant():
                lm += gen_json(name="output", schema=LegalExtractorOutput)
            return lm

        return legal_extractor

    @staticmethod
    def get_legal_extractor_v2():
        """Extract contract data + tag suggestions (v2)."""
        @guidance
        def legal_extractor_v2(
            lm,
            legal_text=None,
            legal_context=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(legal_text, text_chunk)
            context_text = stringify(pick_text(legal_context, kwargs.get("context")))
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                LegalExtractorOutput,
                existing_tag_list
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
            )
            with system():
                lm += (
                    "Du bist ein Rechtsanwalt und Vertragsspezialist für Österreich "
                    "und Deutschland.\n"
                    "Extrahiere Vertragsdetails als valides JSON. "
                    "Zusätzlich: gib Tag-Vorschläge im Tagging-Schema zurück.\n"
                    f"Rechtskontext: {context_text}"
                )
                lm += (
                    "\nTagging-Regeln: suggested_tags nur aus bestehenden Tags, "
                    "missing_tags für neue Kandidaten. "
                    "tagging.domain='legal', tagging.source='guidance_tagger_v2', "
                    "tagging.confidence.overall zwischen 0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Österreichischer/deutscher Vertrag: {text}\n\n"
                lm += "Extrahiere bitte:\n"
                lm += "Vertragsparteien (mit vollständigem Namen)\n"
                lm += "Vertragsdatum und Gültigkeitsdauer\n"
                lm += "Wichtigste 5 Klauseln\n"
                lm += "Haftungsausschlüsse\n"
                lm += "Beendigungsbedingungen\n"
                lm += "Geltende Jurisdiktion und anwendbares Recht"
            with assistant():
                lm += gen_json(name="output", schema=tag_schema)
            return lm

        return legal_extractor_v2

    @staticmethod
    def get_legal_validator():
        """Validate legal extraction output completeness and consistency."""    
        @guidance
        def legal_validator(
            lm,
            legal_text=None,
            text_chunk=None,
            extracted_data=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
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
            )
            with system():
                lm += (
                    "Du bist ein juristischer Qualitätsprüfer. "
                    "Prüfe, ob die Extraktion vollständig und konsistent ist. "
                    "Antworte nur mit JSON."
                )
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Vertragstext: {text}\n"
                if extraction_text:
                    lm += f"Extraktion: {extraction_text}\n"
                lm += (
                    "Bewerte: gültig (true/false), liste Probleme, "
                    "und gib einen Vertrauensscore (0-1)."
                )
            with assistant():
                lm += gen_json(name="output", schema=LegalValidatorOutput)
            return lm

        return legal_validator
