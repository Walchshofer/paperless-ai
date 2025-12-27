import guidance

class MedicalTemplatesDE:
    """German-language medical extraction templates."""
    
    @staticmethod
    def get_medical_classifier():
        return guidance('''
{{#system~}}
Du bist ein medizinischer Dokumentklassifizierer. Antworte nur mit JSON.
{{~/system}}
{{#user~}}
Dokumenttext: {{document_text}}
Klassifiziere in: Laborbefund, Radiologiebericht, Klinische Notiz, Krankenkassenbeleg, Sonstige
{{~/user}}
{{#assistant~}}
{
  "dokumenttyp": "{{#select 'dokumenttyp'}}Laborbefund{{or}}Radiologiebericht{{or}}Klinische Notiz{{or}}Krankenkassenbeleg{{or}}Sonstige{{/select}}",
  "vertrauen": {{gen 'vertrauen' pattern='0\\.[0-9]{2}|1\\.0' stop=','}}
}
{{~/assistant}} ''')

    @staticmethod
    def get_medical_extractor():
        return guidance('''
{{#system~}} Du bist ein medizinischer Datenextraktionist für deutschsprachige Dokumente. Antworte nur mit JSON. {{~/system}}
{{#user~}} Medizinischer Text: {{medical_text}}
Extrahiere: Patient, Diagnosen (ICD-10), Medikamente, Laborwerte.
{{~/user}}
{{#assistant~}}
{
  "patient": {
    "name": "{{gen 'name' stop='"'}}",
    "geburtsdatum": "{{gen 'geburtsdatum' pattern='\\d{4}-\\d{2}-\\d{2}' stop='"'}}"
  },
  "diagnosen": [{{#geneach 'diagnosen' join=', '}}{"icd10": "{{gen 'icd10' pattern='[A-Z]\\d{2}(\\.[A-Z0-9]{1,4})?' stop='"'}}"}{{/geneach}}],
  "vertrauen": {{gen 'vertrauen' pattern='0\\.[0-9]{2}|1\\.0' stop=','}}
}
{{~/assistant}} ''')

    @staticmethod
    def get_medical_integrator():
        return guidance('''{{#system~}} Harmonisiere Bild- und Textdaten. {{~/system}}
{{#user~}} Bild: {{imaging_analysis}} Text: {{text_extraction}} {{~/user}}
{{#assistant~}}
{ "primaerdiagnose": "{{gen 'primaerdiagnose' stop='"'}}" }
{{~/assistant}}''')