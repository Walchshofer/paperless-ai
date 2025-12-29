from typing import Literal

from guidance import guidance, system, user, assistant, json as gen_json
from pydantic import BaseModel

from templates.components.common import build_domain_context, pick_text, stringify


class FinancialParty(BaseModel):
    name: str
    uid: str

    model_config = dict(extra="forbid")


class FinancialParties(BaseModel):
    rechnungssteller: FinancialParty

    model_config = dict(extra="forbid")


class FinancialDates(BaseModel):
    rechnungsdatum: str

    model_config = dict(extra="forbid")


class FinancialAmounts(BaseModel):
    summe_netto: float
    steuersatz: float
    steuerbetrag: float
    summe_brutto: float

    model_config = dict(extra="forbid")


class FinancialExtractorOutput(BaseModel):
    parteien: FinancialParties
    daten: FinancialDates
    betraege: FinancialAmounts

    model_config = dict(extra="forbid")


class FinancialReasonerOutput(BaseModel):
    ist_valide: bool

    model_config = dict(extra="forbid")


class VatExpertOutput(BaseModel):
    konform: bool

    model_config = dict(extra="forbid")


class FinancialTemplatesDE:
    @staticmethod
    def get_financial_extractor():
        @guidance
        def financial_extractor(
            lm,
            financial_text=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            text = pick_text(financial_text, text_chunk)
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += "Finanzextraktionist für AT/DE."
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Dokument: {text}\n"
                lm += "Extrahiere: Rechnungssteller (UID), Datum, Beträge (Netto/Steuer/Brutto)"
            with assistant():
                lm += gen_json(name="output", schema=FinancialExtractorOutput)
            return lm

        return financial_extractor

    @staticmethod
    def get_financial_reasoner():
        @guidance
        def financial_reasoner(
            lm,
            netto=None,
            steuerbetrag=None,
            brutto=None,
            extracted_data=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            netto_value = pick_text(
                netto,
                kwargs.get("summe_netto"),
                kwargs.get("extracted_data_summe_netto"),
                kwargs.get("extracted_data_betraege_summe_netto")
            )
            steuer_value = pick_text(
                steuerbetrag,
                kwargs.get("steuerbetrag"),
                kwargs.get("extracted_data_steuerbetrag"),
                kwargs.get("extracted_data_betraege_steuerbetrag")
            )
            brutto_value = pick_text(
                brutto,
                kwargs.get("summe_brutto"),
                kwargs.get("extracted_data_summe_brutto"),
                kwargs.get("extracted_data_betraege_summe_brutto")
            )
            extracted_text = stringify(extracted_data)
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += "Mathe-Prüfer."
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Netto: {netto_value}, Steuer: {steuer_value}, Brutto: {brutto_value}"
                if extracted_text:
                    lm += f"\nRohdaten: {extracted_text}"
            with assistant():
                lm += gen_json(name="output", schema=FinancialReasonerOutput)
            return lm

        return financial_reasoner

    @staticmethod
    def get_vat_expert_analyzer():
        @guidance
        def vat_expert_analyzer(
            lm,
            total=None,
            tax_rate=None,
            from_party=None,
            vat_context=None,
            text_chunk=None,
            domain=None,
            existing_tags=None,
            model=None,
            **kwargs
        ):
            total_value = pick_text(
                total,
                kwargs.get("summe_brutto"),
                kwargs.get("extracted_data_summe_brutto"),
                kwargs.get("extracted_data_betraege_summe_brutto")
            )
            tax_value = pick_text(
                tax_rate,
                kwargs.get("steuersatz"),
                kwargs.get("extracted_data_steuersatz"),
                kwargs.get("extracted_data_betraege_steuersatz")
            )
            from_value = pick_text(from_party, kwargs.get("rechnungssteller"), kwargs.get("issuer"))
            context_text = stringify(pick_text(vat_context, kwargs.get("context")))
            text = pick_text(text_chunk, kwargs.get("document_text"))
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
            )
            with system():
                lm += "UStG Experte (Österreich)."
                if domain_context:
                    lm += f"\n{domain_context}"
            with user():
                lm += f"Summe: {total_value}, Steuer: {tax_value}%, Verkäufer: {from_value}"
                if context_text:
                    lm += f"\nKontext: {context_text}"
                if text:
                    lm += f"\nDokument: {text}"
            with assistant():
                lm += gen_json(name="output", schema=VatExpertOutput)
            return lm

        return vat_expert_analyzer
