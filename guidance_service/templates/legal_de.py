"""Legal Document Extraction Templates.

Guidance templates for extracting legal contract data from German
documents (AT/DE). Handles:
- Classifier: document type, complexity, jurisdiction
- Extractor: parties, dates, jurisdiction, clauses
- Validator: extraction completeness and consistency
- Tag suggestions and tagging metadata

Supports both basic and v2 (with tags) variants.
"""

import os
from typing import Any, Callable, Dict, List, Literal, Optional

from guidance import (  # type: ignore[import-not-found]
    assistant,
    gen_json,
    guidance,
    system,
    user,
)
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


class LegalClassifierOutput(BaseModel):
    """Output schema for legal_classifier."""

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
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class LegalParties(BaseModel):
    """Contract parties."""

    partei_1: str
    partei_2: str

    model_config = dict(extra="forbid")


class LegalDates(BaseModel):
    """Contract dates."""

    abschluss_datum: str
    gueltig_ab: str

    model_config = dict(extra="forbid")


class LegalJurisdiction(BaseModel):
    """Legal jurisdiction and applicable law."""

    anwendbares_recht: Literal[
        "Österreich (ABGB)",
        "Deutschland (BGB)",
        "Schweiz (ZGB)",
        "Europäisches Recht",
        "Schiedsverfahren",
    ]

    model_config = dict(extra="forbid")


class LegalExtractorOutput(BaseModel):
    """Output schema for legal_extractor."""

    vertragsparteien: LegalParties
    daten: LegalDates
    jurisdiktion_und_recht: LegalJurisdiction
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class LegalValidatorOutput(BaseModel):
    """Output schema for legal_validator."""

    valid: bool
    issues: List[str]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingTagConfidence(BaseModel):
    """Confidence score for individual tag."""

    tag: str
    confidence: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingConfidence(BaseModel):
    """Overall and per-tag confidence scores."""

    overall: float = Field(ge=0, le=1)
    tags: List[TaggingTagConfidence] = Field(
        default_factory=list
    )

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


class LegalTemplatesDE:
    """German-language legal contract extraction templates."""

    @staticmethod
    def get_legal_classifier() -> Callable:
        """Classify legal document type and complexity.

        Returns:
            Guidance template function for classification
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
            """Classify legal document."""
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
                    "Du bist ein Rechtsdokument-Klassifizierer "
                    "spezialisiert auf deutschösterreichische\n"
                    "Verträge.\n"
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
            """Extract legal contract data."""
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

            with system():
                lm += (
                    "Du bist ein Rechtsanwalt und "
                    "Vertragsspezialist für Österreich und "
                    "Deutschland.\n"
                    "Deine Aufgabe: Extrahiere wichtige "
                    "Vertragsdetails als valides JSON. "
                    "Verwende den bereitgestellten "
                    "Rechtskontext zur Interpretation "
                    "zweifelhafter Klauseln.\n"
                    f"Rechtskontext: {context_text}"
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    f"Österreichischer/deutscher Vertrag: "
                    f"{text}\n\n"
                )
                lm += "Extrahiere bitte:\n"
                lm += (
                    "Vertragsparteien "
                    "(mit vollständigem Namen)\n"
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
            """Extract legal data and suggest tags."""
            text = pick_text(legal_text, text_chunk)
            context_text = stringify(
                pick_text(legal_context, kwargs.get("context"))
            )
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                LegalExtractorOutput,
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
                    "Du bist ein Rechtsanwalt und "
                    "Vertragsspezialist für Österreich "
                    "und Deutschland.\n"
                    "Extrahiere Vertragsdetails als valides "
                    "JSON. "
                    "Zusätzlich: gib Tag-Vorschläge im "
                    "Tagging-Schema zurück.\n"
                    f"Rechtskontext: {context_text}"
                )
                lm += (
                    "\nTagging-Regeln: suggested_tags nur aus "
                    "bestehenden Tags, "
                    "missing_tags für neue Kandidaten. "
                    "tagging.domain='legal', "
                    "tagging.source='guidance_tagger_v2', "
                    "tagging.confidence.overall zwischen "
                    "0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    f"Österreichischer/deutscher Vertrag: "
                    f"{text}\n\n"
                )
                lm += "Extrahiere bitte:\n"
                lm += (
                    "Vertragsparteien "
                    "(mit vollständigem Namen)\n"
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
                    schema=tag_schema,
                )

            return lm

        return legal_extractor_v2

    @staticmethod
    def get_legal_validator() -> Callable:
        """Validate extraction completeness and consistency.

        Returns:
            Guidance template function for validation
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
            """Validate legal extraction."""
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

            with system():
                lm += (
                    "Du bist ein juristischer "
                    "Qualitätsprüfer. "
                    "Prüfe, ob die Extraktion vollständig "
                    "und konsistent ist. "
                    "Antworte nur mit JSON."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Vertragstext: {text}\n"
                if extraction_text:
                    lm += f"Extraktion: {extraction_text}\n"
                lm += (
                    "Bewerte: gültig (true/false), liste "
                    "Probleme, "
                    "und gib einen Vertrauensscore (0-1)."
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=LegalValidatorOutput,
                )

            return lm

        return legal_validator
