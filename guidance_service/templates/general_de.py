import guidance

class GeneralTemplatesDE:
    """German-language general document extraction templates (Fallback pipeline)."""
    
    @staticmethod
    def get_general_classifier():
        """Classify unstructured German documents (Stage 4.1 pre-processing)."""
        return guidance('''
{{#system~}}
Du bist ein Dokumentklassifizierer für deutschsprachige Allgemeindokumente.
Deine Aufgabe: Klassifiziere unstrukturierte oder gemischte Dokumente.
Erkenne: Dokumenttyp, Sprache, Wichtigste Entitäten, Vertrauensscore.
{{~/system}}

{{#user~}}
Dokument (erste 1000 Zeichen):
{{document_text}}

Klassifiziere:
- Dokumenttyp: Korrespondenz, Bericht, Zusammenfassung, Sonstige
- Sprache: Deutsch
- Enthält finanzielle Daten? (ja/nein)
- Enthält personelle Daten? (ja/nein)
{{~/user}}

{{#assistant~}}
```json
{
  "dokumenttyp": "{{#select 'dokumenttyp'}}Korrespondenz{{or}}Bericht{{or}}Zusammenfassung{{or}}Sonstige{{/select}}",
  "sprache": "Deutsch",
  "themata": [
    {{#geneach 'themata' num_iterations=3 join=', '}}
    "{{gen 'thema' stop='"' max_tokens=40}}"
    {{/geneach}}
  ],
  "enthaelt_finanzen": {{#select 'finanzen'}}true{{or}}false{{/select}},
  "enthaelt_personendaten": {{#select 'personendaten'}}true{{or}}false{{/select}},
  "vertrauen": {{gen 'vertrauen' pattern='0\\.[0-9]{2}|1\\.0' stop=','}}
}
{{~/assistant}} ''')

    @staticmethod
    def get_cross_pipeline_router():
        """Route document to appropriate pipeline after initial triage."""
        return guidance('''
{{#system~}} Du bist ein Dokumentrouter für die Paperless-AI Pipeline. Nach Vorklassifizierung: Sollte dieses Dokument zu Medical, Financial, Legal, oder General gehen? Gib klare Empfehlung mit Begründung. {{~/system}}

{{#user~}} Klassifiziertes Dokument:
Dokumenttyp: {{document_type}}
Erkannte Themata: {{themes}}
Enthält finanzielle Daten: {{has_financial}}
Enthält medizinische Daten: {{has_medical}}
Enthält rechtliche Begriffe: {{has_legal}}
Welche Pipeline? {{~/user}}

{{#assistant~}}

{
  "empfehlung": "{{#select 'pipeline'}}Medical{{or}}Financial{{or}}Legal{{or}}General{{/select}}",
  "begruendung": "{{gen 'begruendung' stop='"' max_tokens=100}}",
  "sicherheit": {{gen 'sicherheit' pattern='0\\.[0-9]{2}|1\\.0' stop=','}}
}
{{~/assistant}} ''')