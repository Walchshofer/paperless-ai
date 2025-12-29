from typing import List, Literal

from guidance import guidance, system, user, assistant, json as gen_json
from pydantic import BaseModel, Field

from templates.components.common import build_domain_context, pick_text, stringify


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
