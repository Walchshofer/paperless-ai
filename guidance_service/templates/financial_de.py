"""Financial Document Extraction Templates.

Guidance templates for extracting financial/invoice data from
German documents (AT/DE). Handles:
- Extractor: party info, dates, amounts (netto, steuer, brutto)
- Reasoner: mathematical validation of amounts
- VAT Expert: Austrian UStG compliance checking
- Tag suggestions and tagging metadata

Supports both basic and v2 (with tags) variants.

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


class FinancialParty(BaseModel):
    """Financial party (issuer/recipient) info.

    Attributes:
        name: Party name
        uid: Unique identifier (e.g., Austrian UID)
    """

    name: str
    uid: str

    model_config = dict(extra="forbid")


class FinancialParties(BaseModel):
    """Container for financial parties.

    Attributes:
        rechnungssteller: Invoice issuer
    """

    rechnungssteller: FinancialParty

    model_config = dict(extra="forbid")


class FinancialDates(BaseModel):
    """Financial document dates.

    Attributes:
        rechnungsdatum: Invoice date
    """

    rechnungsdatum: str

    model_config = dict(extra="forbid")


class FinancialAmounts(BaseModel):
    """Financial amounts (netto, tax, brutto).

    Attributes:
        summe_netto: Net amount
        steuersatz: Tax rate
        steuerbetrag: Tax amount
        summe_brutto: Gross amount
    """

    summe_netto: float
    steuersatz: float
    steuerbetrag: float
    summe_brutto: float

    model_config = dict(extra="forbid")


class FinancialExtractorOutput(BaseModel):
    """Output schema for financial_extractor.

    Attributes:
        parteien: Party information
        daten: Date information
        betraege: Amount information
    """

    parteien: FinancialParties
    daten: FinancialDates
    betraege: FinancialAmounts

    model_config = dict(extra="forbid")


class FinancialReasonerOutput(BaseModel):
    """Output schema for financial_reasoner.

    Attributes:
        ist_valide: Whether amounts are mathematically valid
    """

    ist_valide: bool

    model_config = dict(extra="forbid")


class VatExpertOutput(BaseModel):
    """Output schema for vat_expert_analyzer.

    Attributes:
        konform: Whether VAT is compliant with Austrian law
    """

    konform: bool

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


class FinancialTemplatesDE:
    """German-language financial document templates.

    This class provides reusable Guidance templates for extracting and
    analyzing financial documents in German and Austrian contexts.

    Each template is decorated with @guidance and returns a callable that
    can be used with Guidance language models.
    """

    @staticmethod
    def get_financial_extractor() -> Callable:
        """Extract financial data from invoice documents.

        Returns:
            Guidance template function for financial extraction

        Example:
            >>> extractor = (
            ...     FinancialTemplatesDE.get_financial_extractor()
            ... )
            >>> lm = model + extractor(financial_text="Rechnung...")
            >>> result = lm["output"]
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
            """Extract financial document data.

            Args:
                lm: Language model instance
                financial_text: Full document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Existing tags for context
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction result
            """
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

            logger.debug(
                f"Extracting financial data from domain: {domain}"
            )

            with system():
                lm += (
                    "Finanzextraktionist für AT/DE. "
                    "Extrahiere Rechnungsdaten strukturiert."
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
                    schema=FinancialExtractorOutput,
                )

            return lm

        return financial_extractor

    @staticmethod
    def get_financial_extractor_v2() -> Callable:
        """Extract financial data + tag suggestions.

        Returns:
            Guidance template function for extraction with tagging

        Example:
            >>> extractor_v2 = (
            ...     FinancialTemplatesDE.get_financial_extractor_v2()
            ... )
            >>> lm = model + extractor_v2(
            ...     financial_text="Rechnung...",
            ...     existing_tags=["invoice", "paid"]
            ... )
            >>> result = lm["output"]
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
            """Extract financial data and suggest tags.

            Args:
                lm: Language model instance
                financial_text: Document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Tags for constraining suggestions
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction and tags
            """
            text = pick_text(financial_text, text_chunk)
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )

            try:
                tag_schema = _build_tagged_schema(
                    FinancialExtractorOutput,
                    existing_tag_list,
                )
            except Exception as e:
                logger.error(f"Failed to build tag schema: {e}")
                tag_schema = FinancialExtractorOutput

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
                f"Extracting financial data with tagging "
                f"from domain: {domain}, tags: {len(existing_tag_list)}"
            )

            with system():
                lm += (
                    "Finanzextraktionist für AT/DE. "
                    "Extrahiere Rechnungsdaten strukturiert.\n"
                    "Gib auch Tag-Vorschläge im "
                    "Tagging-Schema zurück."
                )
                lm += (
                    "\nTagging-Regeln:\n"
                    "- suggested_tags: nur aus bestehenden Tags\n"
                    "- missing_tags: neue Tag-Kandidaten\n"
                    "- tagging.domain: 'financial'\n"
                    "- tagging.source: 'guidance_tagger_v2'\n"
                    "- tagging.confidence.overall: "
                    "zwischen 0 und 1"
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Dokument: {text}\n"
                lm += (
                    "Extrahiere: Rechnungssteller (UID), "
                    "Datum, Beträge (Netto/Steuer/Brutto), Tags"
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

        Example:
            >>> reasoner = (
            ...     FinancialTemplatesDE.get_financial_reasoner()
            ... )
            >>> lm = model + reasoner(
            ...     netto="100.00",
            ...     steuerbetrag="19.00",
            ...     brutto="119.00"
            ... )
            >>> result = lm["output"]
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
            """Validate financial calculations.

            Args:
                lm: Language model instance
                netto: Net amount
                steuerbetrag: Tax amount
                brutto: Gross amount
                extracted_data: Previously extracted data
                domain: Domain context
                existing_tags: Existing tags
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with validation result
            """
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

            logger.debug("Validating financial calculations")

            with system():
                lm += (
                    "Mathematischer Validator für Finanzdaten. "
                    "Prüfe: Netto + Steuer = Brutto"
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
                    schema=FinancialReasonerOutput,
                )

            return lm

        return financial_reasoner

    @staticmethod
    def get_financial_reasoner_v2() -> Callable:
        """Validate amounts + tag suggestions.

        Returns:
            Guidance template function for validation with tagging

        Example:
            >>> reasoner_v2 = (
            ...     FinancialTemplatesDE.get_financial_reasoner_v2()
            ... )
            >>> lm = model + reasoner_v2(
            ...     netto="100.00",
            ...     steuerbetrag="19.00",
            ...     brutto="119.00",
            ...     existing_tags=["valid", "checked"]
            ... )
            >>> result = lm["output"]
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
            """Validate amounts and suggest tags.

            Args:
                lm: Language model instance
                netto: Net amount
                steuerbetrag: Tax amount
                brutto: Gross amount
                extracted_data: Previously extracted data
                domain: Domain context
                existing_tags: Tags for constraining
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with validation and tags
            """
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

            try:
                tag_schema = _build_tagged_schema(
                    FinancialReasonerOutput,
                    existing_tag_list,
                )
            except Exception as e:
                logger.error(f"Failed to build tag schema: {e}")
                tag_schema = FinancialReasonerOutput

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
                f"Validating amounts with tagging, "
                f"tags: {len(existing_tag_list)}"
            )

            with system():
                lm += (
                    "Mathematischer Validator für Finanzdaten. "
                    "Prüfe: Netto + Steuer = Brutto\n"
                    "Gib auch Tag-Vorschläge zurück."
                )
                lm += (
                    "\nTagging-Regeln:\n"
                    "- suggested_tags: nur aus bestehenden Tags\n"
                    "- missing_tags: neue Tag-Kandidaten\n"
                    "- tagging.domain: 'financial'\n"
                    "- tagging.source: 'guidance_tagger_v2'\n"
                    "- tagging.confidence.overall: "
                    "zwischen 0 und 1"
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

        Example:
            >>> vat = (
            ...     FinancialTemplatesDE.get_vat_expert_analyzer()
            ... )
            >>> lm = model + vat(
            ...     total="119.00",
            ...     tax_rate="19",
            ...     from_party="Company A"
            ... )
            >>> result = lm["output"]
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
            """Validate VAT compliance.

            Args:
                lm: Language model instance
                total: Total/gross amount
                tax_rate: Tax rate percentage
                from_party: Invoice issuer
                vat_context: VAT-specific context
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Existing tags
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with compliance result
            """
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

            logger.debug("Analyzing VAT compliance")

            with system():
                lm += (
                    "UStG Experte (Österreich). "
                    "Prüfe Umsatzsteuer-Compliance."
                )
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
