# Austrian German DMS Patterns

Comprehensive regex patterns and select options for Austrian document management systems.

## General Patterns (Allgemein)

### Identifiers
```python
PATTERNS_GENERAL = {
    # Dates
    "datum": r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}",
    "datum_kurz": r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{2}",
    "zeitraum": r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}\s?[-–]\s?(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}",
    
    # Location
    "plz": r"[1-9]\d{3}",
    "plz_ort": r"[1-9]\d{3}\s+[A-ZÄÖÜ][a-zäöüß]+(\s+[A-ZÄÖÜ][a-zäöüß]+)*",
    
    # Communication
    "telefon_at": r"\+43\s?\d{1,4}\s?\d{3,12}",
    "mobil_at": r"\+43\s?(660|664|676|680|681|688|699)\s?\d{6,8}",
    "telefon_inland": r"0\d{1,4}[\s/]?\d{3,12}",
    "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "website": r"(https?://)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/\S*)?",
    
    # Banking
    "iban_at": r"AT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}",
    "iban_de": r"DE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}",
    "iban_eu": r"[A-Z]{2}\d{2}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{4}\s?[A-Z0-9]{0,4}",
    "bic": r"[A-Z]{4}AT[A-Z0-9]{2}([A-Z0-9]{3})?",
    
    # Business IDs
    "uid_at": r"ATU\d{8}",
    "uid_de": r"DE\d{9}",
    "uid_eu": r"[A-Z]{2}[A-Z0-9]{2,12}",
    "firmenbuch": r"FN\s?\d{5,6}\s?[a-z]",
    "zvr": r"ZVR[-:\s]?\d{9}",
    "dvr": r"DVR[-:\s]?\d{7}",
    "gisa": r"GISA[-:\s]?\d{8}",
    "gln": r"\d{13}",  # Global Location Number
}
```

### Person Names
```python
PATTERNS_PERSON = {
    "titel_vor": r"(Mag\.|Dr\.|DI|Ing\.|Prof\.|Univ\.-Prof\.)",
    "titel_nach": r"(MBA|MSc|MA|BA|BSc|PhD|LL\.M\.)",
    "anrede": r"(Herr|Frau|Sehr geehrte[r]?)",
    "name_formal": r"(Herr|Frau)\s+(Mag\.|Dr\.|DI|Ing\.)?\s?[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+",
}
```

## Legal Patterns (Rechtlich)

### Austrian Legal References
```python
PATTERNS_LEGAL = {
    # Paragraphs & Laws
    "paragraf": r"§\s?\d{1,4}[a-z]?",
    "paragraf_abs": r"§\s?\d{1,4}[a-z]?\s?(Abs\.?\s?\d{1,3})?(Z\s?\d{1,3})?",
    "artikel": r"Art\.?\s?\d{1,4}",
    
    # Austrian Federal Law Gazette
    "bgbl": r"BGBl\.?\s?(I|II|III)?\s?(Nr\.?\s?)?\d{1,4}\/\d{4}",
    "lgbl": r"LGBl\.?\s?(Nr\.?\s?)?\d{1,4}\/\d{4}",
    
    # Court file numbers
    "az_zivil": r"\d{1,2}\s?(C|Cg|Cga|Cgs)\s?\d{1,5}\/\d{2,4}[a-z]?",
    "az_straf": r"\d{1,2}\s?(Hv|U|Ur|St)\s?\d{1,5}\/\d{2,4}[a-z]?",
    "az_exekution": r"\d{1,2}\s?(E|Ex)\s?\d{1,5}\/\d{2,4}[a-z]?",
    "az_insolvenz": r"\d{1,2}\s?(S|Sa)\s?\d{1,5}\/\d{2,4}[a-z]?",
    "az_verwaltung": r"[A-Z]{1,5}-\d{1,8}\/\d{1,4}",
    "az_ogh": r"\d{1,2}\s?Ob\s?\d{1,5}\/\d{2}[a-z]?",
    
    # Administrative references
    "geschaeftszahl": r"[A-Z]{2,5}[-/]\d{4,12}[-/]?\d{0,4}",
    "grundbuch": r"EZ\s?\d{1,5}\s?(KG|BG)\s?\d{5}",
    "kataster": r"(KG|GST)\s?\d{1,5}\/\d{1,4}",
    
    # EU references
    "celex": r"\d{5}[A-Z]\d{4}",
    "ecli": r"ECLI:[A-Z]{2}:[A-Z]{2,10}:\d{4}:\d+",
}
```

### Legal Select Options
```python
GERICHTE_AT = [
    # Ordentliche Gerichte
    "BG",      # Bezirksgericht
    "LG",      # Landesgericht
    "OLG",     # Oberlandesgericht
    "OGH",     # Oberster Gerichtshof
    # Verwaltungsgerichte
    "BVwG",    # Bundesverwaltungsgericht
    "LVwG",    # Landesverwaltungsgericht
    "VwGH",    # Verwaltungsgerichtshof
    "VfGH",    # Verfassungsgerichtshof
    # Sondergerichte
    "BFG",     # Bundesfinanzgericht
    "ASG",     # Arbeits- und Sozialgericht
    "HG",      # Handelsgericht
]

RECHTSGEBIETE = [
    "Zivilrecht", "Strafrecht", "Verwaltungsrecht", 
    "Arbeitsrecht", "Sozialrecht", "Familienrecht",
    "Erbrecht", "Mietrecht", "Gesellschaftsrecht",
    "Insolvenzrecht", "Exekutionsrecht", "Grundbuchsrecht",
    "Vergaberecht", "Steuerrecht", "Verfassungsrecht"
]

VERFAHRENSARTEN = [
    "Streitverfahren", "Außerstreitverfahren", "Exekutionsverfahren",
    "Insolvenzverfahren", "Verwaltungsverfahren", "Strafverfahren",
    "Mahnverfahren", "Beschwerdeverfahren", "Berufungsverfahren"
]

LEGAL_DOC_TYPES = [
    "Klage", "Klagebeantwortung", "Berufung", "Revision",
    "Bescheid", "Urteil", "Beschluss", "Vergleich",
    "Vollmacht", "Vertrag", "Kündigung", "Mahnung",
    "Exekutionsantrag", "Insolvenzantrag", "Grundbuchauszug",
    "Firmenbuchauszug", "Strafregisterauszug", "Meldebestätigung"
]
```

## Financial Patterns (Finanzen)

### Austrian Financial Formats
```python
PATTERNS_FINANCIAL = {
    # Amounts (German format: 1.234,56)
    "betrag_eur": r"€?\s?\d{1,3}(\.\d{3})*(,\d{2})?(\s?€)?",
    "betrag_negativ": r"-\s?€?\s?\d{1,3}(\.\d{3})*(,\d{2})?",
    "betrag_bereich": r"€?\s?\d{1,3}(\.\d{3})*(,\d{2})?\s?[-–]\s?€?\s?\d{1,3}(\.\d{3})*(,\d{2})?",
    
    # Tax IDs
    "steuernummer": r"\d{2}[-/]?\d{3}[-/]?\d{4}",
    "finanzamt_nr": r"FA\s?\d{2}",
    "abgabenkonto": r"\d{2}\s?\d{3}\s?\d{4}",
    
    # Document references
    "rechnungsnr": r"(RE|RG|INV|FA)[-/]?\d{4,10}",
    "gutschrift_nr": r"(GS|CR)[-/]?\d{4,10}",
    "belegnr": r"(BN|BEL|BLG)[-/]?\d{6,12}",
    "auftragsnr": r"(AB|AUF|PO)[-/]?\d{4,10}",
    "lieferschein_nr": r"(LS|LFS)[-/]?\d{4,10}",
    
    # Accounting
    "kostenstelle": r"KST[-/]?\d{4,8}",
    "kostentraeger": r"KTR[-/]?\d{4,8}",
    "sachkonto": r"\d{4,6}",
    "buchungskreis": r"BK\d{2,4}",
    
    # Percentages
    "prozent": r"\d{1,3}(,\d{1,2})?\s?%",
    "mwst_satz": r"(0|10|13|20)(,0{1,2})?\s?%",
    
    # Banking
    "kontonummer": r"\d{4,11}",
    "blz": r"\d{5}",
    "zahlungsreferenz": r"[A-Z0-9]{8,35}",
}
```

### Financial Select Options
```python
FINANCIAL_DOC_TYPES = [
    "Eingangsrechnung", "Ausgangsrechnung", "Gutschrift",
    "Proformarechnung", "Anzahlungsrechnung", "Schlussrechnung",
    "Kontoauszug", "Zahlungsbeleg", "Überweisungsbeleg",
    "Mahnbescheid", "Inkassoschreiben",
    "Steuerbescheid", "Vorauszahlungsbescheid",
    "Lohnzettel", "Jahreslohnzettel",
    "Bilanz", "GuV", "Jahresabschluss"
]

BUCHUNGSKATEGORIEN = [
    "Betriebsausgabe", "Betriebseinnahme",
    "Privatentnahme", "Privateinlage",
    "Anlagevermögen", "Umlaufvermögen",
    "Verbindlichkeit", "Forderung",
    "Rückstellung", "Rücklage"
]

ZAHLUNGSARTEN = [
    "Überweisung", "Lastschrift", "Barzahlung",
    "Kreditkarte", "PayPal", "Scheck"
]

MWST_SAETZE = ["0%", "10%", "13%", "20%"]

STEUERARTEN = [
    "Umsatzsteuer", "Einkommensteuer", "Körperschaftsteuer",
    "Lohnsteuer", "Kapitalertragsteuer", "Grunderwerbsteuer",
    "Grundsteuer", "Normverbrauchsabgabe"
]
```

## Medical Patterns (Medizin)

### Austrian Healthcare Identifiers
```python
PATTERNS_MEDICAL = {
    # Social security
    "svnr": r"\d{4}(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}",
    "svnr_formatiert": r"\d{4}\s?(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}",
    "ecard": r"80756\d{15}",
    
    # Diagnosis & procedure codes
    "icd10": r"[A-TV-Z]\d{2}(\.\d{1,2})?",
    "icd10_at": r"[A-TV-Z]\d{2}(\.\d{1,2})?[A-Z]?",
    "mek": r"[A-Z]{2}\d{3}[A-Z]?",  # MEL-Katalog
    "ops": r"\d-\d{3}(\.\d{1,2})?",  # Operationen
    "icpc2": r"[A-Z]\d{2}",  # Primärversorgung
    
    # Lab codes
    "loinc": r"\d{3,7}-\d",
    "elga_code": r"\d{1,2}\.\d{1,2}\.\d{1,2}",
    
    # Pharma
    "pzn": r"(PZN[-/]?)?\d{7,8}",
    "gtin": r"\d{13,14}",
    "atc": r"[A-Z]\d{2}[A-Z]{2}\d{2}",
    "pharma_zulassung": r"\d{1,2}\.\d{3,6}",
    
    # Provider IDs
    "vpnr": r"\d{6}",  # Vertragspartnernummer
    "ordinationsnr": r"\d{6}",
    "kassenzeichen": r"[A-Z]{2,3}\d{5,8}",
    "gda_oid": r"1\.2\.40\.0\.34\.3\.\d+(\.\d+)*",
    
    # Prescription
    "rezeptnummer": r"\d{2}[A-Z]\d{9}",
    "chefarzt_bewilligung": r"CA[-/]?\d{8,12}",
    
    # Medical values
    "blutdruck": r"\d{2,3}\/\d{2,3}",
    "temperatur": r"\d{2}(,\d)?\s?°?C?",
    "bmi": r"\d{2}(,\d)?",
}
```

### Medical Select Options
```python
MEDICAL_DOC_TYPES = [
    "Befund", "Arztbrief", "Entlassungsbrief",
    "Rezept", "Privatrezept", "Suchtgiftrezept",
    "Überweisung", "Einweisung", "Zuweisung",
    "Laborbericht", "Radiologiebefund", "Pathologiebefund",
    "OP-Bericht", "Anästhesieprotokoll",
    "Krankenstandsbestätigung", "Pflegegeldeinstufung",
    "Gutachten", "Stellungnahme"
]

FACHRICHTUNGEN = [
    "Allgemeinmedizin", "Innere Medizin", "Chirurgie",
    "Orthopädie", "Unfallchirurgie", "Neurologie",
    "Psychiatrie", "Kardiologie", "Pulmologie",
    "Gastroenterologie", "Nephrologie", "Onkologie",
    "Radiologie", "Nuklearmedizin", "Pathologie",
    "Dermatologie", "HNO", "Augenheilkunde",
    "Gynäkologie", "Urologie", "Pädiatrie",
    "Anästhesie", "Intensivmedizin", "Notfallmedizin"
]

VERSICHERUNGSTRAEGER = [
    "ÖGK",      # Österreichische Gesundheitskasse
    "SVS",      # Sozialversicherung Selbständige
    "BVAEB",    # Beamte, Eisenbahn, Bergbau
    "KFA",      # Krankenfürsorgeanstalt
    "AUVA",     # Allgemeine Unfallversicherung
]

BEHANDLUNGSARTEN = [
    "ambulant", "stationär", "tagesklinisch",
    "Hausbesuch", "Telemedizin"
]

DRINGLICHKEIT_MED = [
    "Notfall", "Dringend", "Elektiv", "Routine"
]
```

## Usage Examples

### Financial Document Extraction
```python
@guidance
def extract_rechnung(lm, text):
    with system():
        lm += "Du extrahierst Daten aus österreichischen Rechnungen."
    
    with user():
        lm += f"Rechnung:\n{text}"
    
    with assistant():
        lm += "Rechnungsnummer: " + gen(name="rechnungsnr",
            regex=r"(RE|RG|INV|FA)[-/]?\d{4,10}")
        lm += "\nDatum: " + gen(name="datum",
            regex=r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}")
        lm += "\nBetrag: " + gen(name="betrag",
            regex=r"€?\s?\d{1,3}(\.\d{3})*(,\d{2})?")
        lm += "\nMwSt: " + select(options=["0%", "10%", "13%", "20%"], name="mwst")
        lm += "\nUID: " + gen(name="uid", regex=r"ATU\d{8}")
        lm += "\nIBAN: " + gen(name="iban",
            regex=r"AT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}")
    
    return lm
```

### Medical Document Extraction
```python
@guidance
def extract_befund(lm, text):
    with system():
        lm += "Du extrahierst Daten aus österreichischen Befunden."
    
    with user():
        lm += f"Befund:\n{text}"
    
    with assistant():
        lm += "SVNR: " + gen(name="svnr",
            regex=r"\d{4}(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}")
        lm += "\nDatum: " + gen(name="datum",
            regex=r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}")
        lm += "\nDiagnose (ICD-10): " + gen(name="icd",
            regex=r"[A-TV-Z]\d{2}(\.\d{1,2})?")
        lm += "\nFachrichtung: " + select(options=FACHRICHTUNGEN, name="fach")
        lm += "\nVersicherung: " + select(options=VERSICHERUNGSTRAEGER, name="kasse")
        lm += "\nDokumenttyp: " + select(options=MEDICAL_DOC_TYPES, name="typ")
    
    return lm
```

### Legal Document Extraction
```python
@guidance
def extract_bescheid(lm, text):
    with system():
        lm += "Du extrahierst Daten aus österreichischen Bescheiden."
    
    with user():
        lm += f"Bescheid:\n{text}"
    
    with assistant():
        lm += "Geschäftszahl: " + gen(name="gz",
            regex=r"[A-Z]{2,5}[-/]\d{4,12}[-/]?\d{0,4}")
        lm += "\nDatum: " + gen(name="datum",
            regex=r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}")
        lm += "\nBehörde: " + gen(name="behoerde", max_tokens=50, temperature=0.0)
        lm += "\nRechtsgrundlage: " + gen(name="rechtsgrundlage",
            regex=r"§\s?\d{1,4}[a-z]?(\s?(Abs\.?\s?\d{1,3}))?\s?[A-Za-zÄÖÜäöü]+")
        lm += "\nRechtsmittel: " + select(
            options=["Beschwerde", "Berufung", "Revision", "keine"], name="rechtsmittel")
    
    return lm
```

## Validation Helpers

```python
import re

def validate_svnr(svnr: str) -> bool:
    """Validate Austrian social security number with checksum."""
    if not re.match(r"^\d{10}$", svnr):
        return False
    weights = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6]
    checksum = sum(int(d) * w for d, w in zip(svnr, weights)) % 11
    return checksum == int(svnr[3])

def validate_iban_at(iban: str) -> bool:
    """Validate Austrian IBAN checksum."""
    iban = iban.replace(" ", "").upper()
    if not re.match(r"^AT\d{18}$", iban):
        return False
    rearranged = iban[4:] + iban[:4]
    numeric = "".join(str(ord(c) - 55) if c.isalpha() else c for c in rearranged)
    return int(numeric) % 97 == 1

def validate_uid(uid: str) -> bool:
    """Validate Austrian UID number."""
    if not re.match(r"^ATU\d{8}$", uid):
        return False
    digits = [int(d) for d in uid[3:]]
    # Austrian UID checksum algorithm
    s = sum(digits[i] if i % 2 == 0 else sum(divmod(digits[i] * 2, 10)) 
            for i in range(8))
    return s % 10 == 0
```