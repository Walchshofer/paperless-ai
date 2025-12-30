"""Financial Document Extraction Templates.

Guidance templates for extracting financial/invoice data from
German documents (AT/DE). Handles:
- Extractor: party info, dates, amounts (netto, steuer, brutto)
- Reasoner: mathematical validation of amounts
- VAT Expert: Austrian UStG compliance checking
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


class FinancialParty(BaseModel):
    """Financial party (issuer/recipient) info."""

    name: str
    uid: str

    model_config = dict(extra="forbid")


class FinancialParties(BaseModel):
    """Container for financial parties."""

    rechnungssteller: FinancialParty

    model_config = dict(extra="forbid")


class FinancialDates(BaseModel):
    """Financial document dates."""

    rechnungsdatum: str

    model_config = dict(extra="forbid")


class FinancialAmounts(BaseModel):
    """Financial amounts (netto, tax, brutto)."""

    summe_netto: float
    steuersatz: float
    steuerbetrag: float
    summe_brutto: float

    model_config = dict(extra="forbid")


class FinancialExtractorOutput(BaseModel):
    """Output schema for financial_extractor."""

    parteien: FinancialParties
    daten: FinancialDates
    betraege: FinancialAmounts

    model_config = dict(extra="forbid")


class FinancialReasonerOutput(BaseModel):
    """Output schema for financial_reasoner."""

    ist_valide: bool

    model_config = dict(extra="forbid")


class VatExpertOutput(BaseModel):
    """Output schema for vat_expert_analyzer."""

    konform: bool

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


class FinancialTemplatesDE:
    """German-language financial document templates."""

    @staticmethod
    def get_financial_extractor() -> Callable:
        """Extract financial data from invoice documents.

        Returns:
            Guidance template function for financial extraction
        """

        @guidance
        def financial_extractor(
            lm: Any,
            financial_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract financial document data."""
            text = pick_text(financial_text, text_chunk)
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
                lm += "Finanzextraktionist für AT/DE."
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Dokument: {text}\n"
                lm += (
                    "Extrahiere: Rechnungssteller (UID), "
                    "Datum, Beträge (Netto/Steuer/Brutto)"
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=FinancialExtractorOutput,
                )

            return lm

        return financial_extractor

    @staticmethod
    def get_financial_extractor_v2() -> Callable:
        """Extract financial data + tag suggestions.

        Returns:
            Guidance template function for extraction with tagging
        """

        @guidance
        def financial_extractor_v2(
            lm: Any,
            financial_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract financial data and suggest tags."""
            text = pick_text(financial_text, text_chunk)
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                FinancialExtractorOutput,
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
                lm += "Finanzextraktionist für AT/DE."
                lm += (
                    "\nZusätzlich: gib Tag-Vorschläge im "
                    "Tagging-Schema zurück. "
                    "suggested_tags nur aus bestehenden Tags, "
                    "missing_tags für neue Kandidaten. "
                    "tagging.domain='financial', "
                    "tagging.source='guidance_tagger_v2', "
                    "tagging.confidence.overall zwischen "
                    "0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Dokument: {text}\n"
                lm += (
                    "Extrahiere: Rechnungssteller (UID), "
                    "Datum, Beträge (Netto/Steuer/Brutto)"
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=tag_schema,
                )

            return lm

        return financial_extractor_v2

    @staticmethod
    def get_financial_reasoner() -> Callable:
        """Validate financial amounts (math check).

        Returns:
            Guidance template function for amount validation
        """

        @guidance
        def financial_reasoner(
            lm: Any,
            netto: Optional[str] = None,
            steuerbetrag: Optional[str] = None,
            brutto: Optional[str] = None,
            extracted_data: Optional[Dict[str, Any]] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Validate financial calculations."""
            netto_value = pick_text(
                netto,
                kwargs.get("summe_netto"),
                kwargs.get("extracted_data_summe_netto"),
                kwargs.get(
                    "extracted_data_betraege_summe_netto"
                ),
            )
            steuer_value = pick_text(
                steuerbetrag,
                kwargs.get("steuerbetrag"),
                kwargs.get("extracted_data_steuerbetrag"),
                kwargs.get(
                    "extracted_data_betraege_steuerbetrag"
                ),
            )
            brutto_value = pick_text(
                brutto,
                kwargs.get("summe_brutto"),
                kwargs.get("extracted_data_summe_brutto"),
                kwargs.get(
                    "extracted_data_betraege_summe_brutto"
                ),
            )
            extracted_text = stringify(extracted_data)
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
                lm += "Mathe-Prüfer."
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    f"Netto: {netto_value}, "
                    f"Steuer: {steuer_value}, "
                    f"Brutto: {brutto_value}"
                )
                if extracted_text:
                    lm += f"\nRohdaten: {extracted_text}"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=FinancialReasonerOutput,
                )

            return lm

        return financial_reasoner

    @staticmethod
    def get_financial_reasoner_v2() -> Callable:
        """Validate amounts + tag suggestions.

        Returns:
            Guidance template function for validation with tagging
        """

        @guidance
        def financial_reasoner_v2(
            lm: Any,
            netto: Optional[str] = None,
            steuerbetrag: Optional[str] = None,
            brutto: Optional[str] = None,
            extracted_data: Optional[Dict[str, Any]] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Validate amounts and suggest tags."""
            netto_value = pick_text(
                netto,
                kwargs.get("summe_netto"),
                kwargs.get("extracted_data_summe_netto"),
                kwargs.get(
                    "extracted_data_betraege_summe_netto"
                ),
            )
            steuer_value = pick_text(
                steuerbetrag,
                kwargs.get("steuerbetrag"),
                kwargs.get("extracted_data_steuerbetrag"),
                kwargs.get(
                    "extracted_data_betraege_steuerbetrag"
                ),
            )
            brutto_value = pick_text(
                brutto,
                kwargs.get("summe_brutto"),
                kwargs.get("extracted_data_summe_brutto"),
                kwargs.get(
                    "extracted_data_betraege_summe_brutto"
                ),
            )
            extracted_text = stringify(extracted_data)
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                FinancialReasonerOutput,
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
                lm += "Mathe-Prüfer."
                lm += (
                    "\nZusätzlich: gib Tag-Vorschläge im "
                    "Tagging-Schema zurück. "
                    "suggested_tags nur aus bestehenden Tags, "
                    "missing_tags für neue Kandidaten. "
                    "tagging.domain='financial', "
                    "tagging.source='guidance_tagger_v2', "
                    "tagging.confidence.overall zwischen "
                    "0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    f"Netto: {netto_value}, "
                    f"Steuer: {steuer_value}, "
                    f"Brutto: {brutto_value}"
                )
                if extracted_text:
                    lm += f"\nRohdaten: {extracted_text}"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=tag_schema,
                )

            return lm

        return financial_reasoner_v2

    @staticmethod
    def get_vat_expert_analyzer() -> Callable:
        """Analyze VAT compliance (Austrian UStG).

        Returns:
            Guidance template function for VAT analysis
        """

        @guidance
        def vat_expert_analyzer(
            lm: Any,
            total: Optional[str] = None,
            tax_rate: Optional[str] = None,
            from_party: Optional[str] = None,
            vat_context: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Validate VAT compliance."""
            total_value = pick_text(
                total,
                kwargs.get("summe_brutto"),
                kwargs.get("extracted_data_summe_brutto"),
                kwargs.get(
                    "extracted_data_betraege_summe_brutto"
                ),
            )
            tax_value = pick_text(
                tax_rate,
                kwargs.get("steuersatz"),
                kwargs.get("extracted_data_steuersatz"),
                kwargs.get(
                    "extracted_data_betraege_steuersatz"
                ),
            )
            from_value = pick_text(
                from_party,
                kwargs.get("rechnungssteller"),
                kwargs.get("issuer"),
            )
            context_text = stringify(
                pick_text(vat_context, kwargs.get("context"))
            )
            text = pick_text(
                text_chunk,
                kwargs.get("document_text"),
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
                lm += "UStG Experte (Österreich)."
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += (
                    f"Summe: {total_value}, "
                    f"Steuer: {tax_value}%, "
                    f"Verkäufer: {from_value}"
                )
                if context_text:
                    lm += f"\nKontext: {context_text}"
                if text:
                    lm += f"\nDokument: {text}"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=VatExpertOutput,
                )

            return lm

        return vat_expert_analyzer
