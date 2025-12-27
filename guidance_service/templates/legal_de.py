import guidance

class LegalTemplatesDE:
    """German-language legal contract extraction templates."""
    
    @staticmethod
    def get_legal_classifier():
        """Classify legal document type and complexity (Stage 3.1)."""
        return guidance('''
{{#system~}}
Du bist ein Rechtsdokument-Klassifizierer spezialisiert auf deutschösterreichische Verträge.
Klassifiziere das Dokument nach Typ, Komplexität und Jurisdiktion.
{{~/system}}

{{#user~}}
Rechtsdokument (erste 500 Zeichen):
{{document_text}}

Klassifiziere nach:
- Dokumenttyp: Kaufvertrag, Mietvertrag, Arbeitsvertrag, Servicevertrag, NDA, Lizenzvertrag
- Komplexität: Einfach, Mittel, Komplex
- Vermutete Jurisdiktion: Österreich, Deutschland, EU-weit, International
{{~/user}}

{{#assistant~}}
```json
{
  "dokumenttyp": "{{#select 'dokumenttyp'}}Kaufvertrag{{or}}Mietvertrag{{or}}Arbeitsvertrag{{or}}Servicevertrag{{or}}NDA{{or}}Lizenzvertrag{{or}}Sonstige{{/select}}",
  "komplexitaet": "{{#select 'komplexitaet'}}Einfach{{or}}Mittel{{or}}Komplex{{/select}}",
  "vermutete_jurisdiktion": "{{#select 'jurisdiktion'}}Österreich{{or}}Deutschland{{or}}EU-weit{{or}}International{{/select}}",
  "vertrauen": {{gen 'vertrauen' pattern='0\\.[0-9]{2}|1\\.0' stop=','}}
}
{{~/assistant}} ''')

    @staticmethod
    def get_legal_extractor():
        """Extract contract data with reasoning (Stage 3.2 - dragon-finance)."""
        return guidance('''
{{#system~}} Du bist ein Rechtsanwalt und Vertragsspzialist für Österreich und Deutschland.
Deine Aufgabe: Extrahiere wichtige Vertragsdetails als valides JSON. Verwende den bereitgestellten Rechtskontext zur Interpretation zweifelhafter Klauseln.
Rechtskontext: {{legal_context}} {{~/system}}

{{#user~}} Österreichischer/deutscher Vertrag: {{legal_text}}

Extrahiere bitte:
Vertragsparteien (mit vollständigem Namen)
Vertragsdatum und Gültigkeitsdauer
Wichtigste 5 Klauseln
Haftungsausschlüsse
Beendigungsbedingungen
Geltende Jurisdiktion und anwendbares Recht {{~/user}}

{{#assistant~}} {{#block hidden=True~}} Juridische Analyse und Reasoning:
Prüfe auf Übereinstimmung mit ABGB (Österreich) oder BGB (Deutschland)
Identifiziere Standardklauseln vs. ungewöhnliche Bedingungen
Interne Analyse: {{gen 'internal_legal_reasoning' temperature=0.7 max_tokens=800}} {{/block}}
{
  "vertragsparteien": {
    "partei_1": "{{gen 'partei1_name' stop='"' max_tokens=100}}",
    "partei_2": "{{gen 'partei2_name' stop='"' max_tokens=100}}"
  },
  "daten": {
    "abschluss_datum": "{{gen 'abschluss_datum' pattern='\\d{4}-\\d{2}-\\d{2}' stop='"'}}",
    "gueltig_ab": "{{gen 'gueltig_ab' pattern='\\d{4}-\\d{2}-\\d{2}' stop='"'}}"
  },
  "jurisdiktion_und_recht": {
    "anwendbares_recht": "{{#select 'anwendbares_recht'}}Österreich (ABGB){{or}}Deutschland (BGB){{or}}Schweiz (ZGB){{or}}Europäisches Recht{{or}}Schiedsverfahren{{/select}}"
  },
  "vertrauen": {{gen 'vertrauen' pattern='0\\.[0-9]{2}|1\\.0' stop=','}}
}
{{~/assistant}} ''')