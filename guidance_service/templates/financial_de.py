import guidance

class FinancialTemplatesDE:
    @staticmethod
    def get_financial_extractor():
        return guidance('''{{#system~}}Finanzextraktionist für AT/DE.{{~/system}}
{{#user~}}Dokument: {{financial_text}}
Extrahiere: Rechnungssteller (UID), Datum, Beträge (Netto/Steuer/Brutto){{~/user}}
{{#assistant~}}{
  "parteien": {
    "rechnungssteller": { "name": "{{gen 'von_name' stop='"'}}", "uid": "{{gen 'von_uid' pattern='ATU\\d{8}' stop='"'}}" }
  },
  "daten": { "rechnungsdatum": "{{gen 'rechnungsdatum' pattern='\\d{4}-\\d{2}-\\d{2}' stop='"'}}" },
  "betraege": {
    "summe_netto": {{gen 'summe_netto' pattern='\\d+(\\.\\d{2})?' stop=','}},
    "steuersatz": {{gen 'steuersatz' pattern='(0|10|13|20)(\\.\\d{1,2})?' stop=','}},
    "steuerbetrag": {{gen 'steuerbetrag' pattern='\\d+(\\.\\d{2})?' stop=','}},
    "summe_brutto": {{gen 'summe_brutto' pattern='\\d+(\\.\\d{2})?' stop=','}}
  }
}{{~/assistant}}''')

    @staticmethod
    def get_financial_reasoner():
        return guidance('''{{#system~}}Mathe-Prüfer.{{~/system}}
{{#user~}}Netto: {{netto}}, Steuer: {{steuerbetrag}}, Brutto: {{brutto}}{{~/user}}
{{#assistant~}}{ "ist_valide": {{#select 'valide'}}true{{or}}false{{/select}} }{{~/assistant}}''')

    @staticmethod
    def get_vat_expert_analyzer():
        return guidance('''{{#system~}}UStG Experte (Österreich).{{~/system}}
{{#user~}}Summe: {{total}}, Steuer: {{tax_rate}}%, Verkäufer: {{from_party}}{{~/user}}
{{#assistant~}}{ "konform": {{#select 'konform'}}true{{or}}false{{/select}} }{{~/assistant}}''')