# Guidance Expert

Expert knowledge for building production systems with the Guidance AI framework.

## Architecture Overview

**CRITICAL**: The system has four components that are **siblings orchestrated by Guidance**, NOT nested wrappers:

```
┌─ Ollama (Port 11434) ────── GPU inference, returns raw logits
├─ LiteLLM ────────────────── Abstracts Ollama/OpenAI/Anthropic protocols
├─ LogitBiasEngine (50051) ── Validates tokens, computes biases
└─ Guidance ───────────────── Orchestrates all three components
```

See `references/architecture.md` for detailed component interactions.

## Quick Reference

### Core Pattern: Immutable Model State
```python
from guidance import models, system, user, assistant, gen, select

lm = models.LiteLLM(model_description=config)
lm1 = lm + "Hello"      # New state
lm2 = lm + "Goodbye"    # Different state (lm unchanged)
```

### Basic Generation
```python
with system():
    lm += "You are an expert."
with user():
    lm += f"Classify: {content}"
with assistant():
    lm += "Type: " + select(options=["A", "B", "C"], name="type")
    lm += "\nDetails: " + gen(name="details", max_tokens=100, temperature=0.3)
```

### Constrained Generation
```python
# Regex constraint
lm += gen(name="email", regex=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Select from options (PREFERRED for classification)
lm += select(options=["High", "Medium", "Low"], name="priority")

# Stop sequences
lm += gen(name="output", max_tokens=500, stop=["---", "END", "\n\n"])
```

## Reference Files

| Topic | Reference File |
|-------|----------------|
| **System architecture, layers, data flow** | `architecture.md` |
| **LogitBiasEngine, remote models, gRPC** | `logit-bias-engine.md` |
| Architecture, immutability, chat context | `core-concepts.md` |
| LiteLLM config, Ollama setup, networking | `litellm-ollama.md` |
| Custom functions, tools, grammars | `guidance-functions.md` |
| Async streaming, callbacks, buffering | `streaming.md` |
| DMS classification, extraction, workflows | `dms-patterns.md` |
| PostgreSQL, pgvector, repositories | `postgresql-pgvector.md` |
| Quick syntax cheat sheet | `quick-reference.md` |
| Ready-to-use code templates | `../scripts/snippets.py` |

## Austrian German DMS Regex Patterns

### General (Allgemein)

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| **Datum (AT)** | `(0[1-9]\|[12][0-9]\|3[01])\.(0[1-9]\|1[0-2])\.(19\|20)\d{2}` | 15.03.2024 |
| **PLZ (AT)** | `[1-9]\d{3}` | 4020 |
| **Telefon (AT)** | `\+43\s?\d{1,4}\s?\d{3,12}` | +43 732 1234567 |
| **Mobil (AT)** | `\+43\s?(660\|664\|676\|680\|681\|688\|699)\s?\d{6,8}` | +43 664 1234567 |
| **E-Mail** | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | max@firma.at |
| **IBAN (AT)** | `AT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}` | AT61 1904 3002 3457 3201 |
| **BIC** | `[A-Z]{4}AT[A-Z0-9]{2}([A-Z0-9]{3})?` | OPSKATWW |
| **UID-Nummer** | `ATU\d{8}` | ATU12345678 |
| **Firmenbuchnr.** | `FN\s?\d{5,6}\s?[a-z]` | FN 123456 d |

### Legal (Rechtlich)

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| **Paragraf** | `§\s?\d{1,4}[a-z]?(\s?(Abs\|Z)\s?\d{1,3})?` | § 1 Abs 2 |
| **Gesetz (BGBl)** | `BGBl\.?\s?(I\|II\|III)?\s?(Nr\.?\s?)?\d{1,4}\/\d{4}` | BGBl. I Nr. 100/2020 |
| **Aktenzeichen** | `\d{1,2}\s?[A-Za-z]{1,4}\s?\d{1,5}\/\d{2,4}[a-z]?` | 3 Ob 123/24x |
| **GZ (Geschäftszahl)** | `[A-Z]{2,5}-\d{4,8}\/\d{2,4}` | BMF-010221/0001/2024 |
| **ZVR-Zahl** | `ZVR:\s?\d{9}` | ZVR: 123456789 |
| **DVR-Nummer** | `DVR:\s?\d{7}` | DVR: 0000001 |
| **GISA-Zahl** | `GISA:\s?\d{8}` | GISA: 12345678 |
| **Ediktsdatei** | `\d{1,2}\s?[A-Z]\s?\d{1,5}\/\d{2}[a-z]` | 17 S 100/24a |
| **Grundbuch** | `EZ\s?\d{1,5}\s?KG\s?\d{5}` | EZ 123 KG 45678 |

### Financial (Finanzen)

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| **Betrag (EUR)** | `€?\s?\d{1,3}(\.\d{3})*(,\d{2})?(\s?€)?` | € 1.234,56 |
| **Betrag (negativ)** | `-?\s?€?\s?\d{1,3}(\.\d{3})*(,\d{2})?` | -€ 123,45 |
| **Steuernummer** | `\d{2}-?\d{3}\/?\d{4}` | 12-345/6789 |
| **Finanzamt-Nr.** | `FA\s?\d{2}` | FA 46 |
| **Abgabenkontonr.** | `\d{2}\s?\d{3}\s?\d{4}` | 12 345 6789 |
| **Rechnungsnr.** | `(RE\|RG\|INV)[-/]?\d{4,10}` | RE-2024001234 |
| **Belegnummer** | `(BN\|BEL)[-/]?\d{6,12}` | BN-123456789 |
| **Kostenstelle** | `KST[-/]?\d{4,8}` | KST-12345678 |
| **Prozent** | `\d{1,3}(,\d{1,2})?\s?%` | 20,00 % |
| **MwSt-Satz** | `(0\|10\|13\|20)\s?%` | 20 % |
| **Kontonummer** | `\d{4,11}` | 12345678901 |
| **BLZ** | `\d{5}` | 19043 |

### Medical (Medizin)

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| **SVNR (10-stellig)** | `\d{4}(0[1-9]\|[12]\d\|3[01])(0[1-9]\|1[0-2])\d{2}` | 1234010190 |
| **VSNR (formatiert)** | `\d{4}\s?(0[1-9]\|[12]\d\|3[01])(0[1-9]\|1[0-2])\d{2}` | 1234 010190 |
| **ICD-10 (Diagnose)** | `[A-Z]\d{2}(\.\d{1,2})?` | J06.9 |
| **ICD-10 (AT erw.)** | `[A-Z]\d{2}(\.\d{1,2})?[A-Z]?` | K29.5G |
| **MEL-Code** | `[A-Z]{2}\d{3}` | AB123 |
| **LOINC** | `\d{3,7}-\d` | 2345-7 |
| **PZN (Pharma)** | `PZN[-/]?\d{7,8}` | PZN-1234567 |
| **GTIN/EAN** | `\d{13}` | 9001234567890 |
| **Ordinationsnr.** | `\d{6}` | 123456 |
| **VPNR (Arzt)** | `\d{6}` | 123456 |
| **GDA-OID** | `1\.2\.40\.0\.34\.3\.\d+\.\d+` | 1.2.40.0.34.3.1.1 |
| **eCard-Nr.** | `80756\d{15}` | 80756123456789012345 |
| **Rezeptnummer** | `\d{2}[A-Z]\d{9}` | 12A123456789 |

## Domain-Specific Select Options

### Document Classification
```python
# Austrian document types
DOC_TYPES_AT = [
    "Rechnung", "Gutschrift", "Mahnung", "Angebot", "Bestellung",
    "Vertrag", "Bescheid", "Urteil", "Protokoll", "Vollmacht",
    "Befund", "Rezept", "Überweisung", "Arztbrief", "Laborbericht"
]
lm += select(options=DOC_TYPES_AT, name="doc_type")

# Priority (German)
PRIORITY_DE = ["Dringend", "Hoch", "Normal", "Niedrig"]
lm += select(options=PRIORITY_DE, name="priority")

# Status (German)
STATUS_DE = ["Offen", "In Bearbeitung", "Abgeschlossen", "Storniert"]
lm += select(options=STATUS_DE, name="status")
```

### Legal Classification
```python
LEGAL_DOC_TYPES = [
    "Klage", "Berufung", "Bescheid", "Urteil", "Beschluss",
    "Vergleich", "Vollmacht", "Vertrag", "Kündigung", "Mahnung",
    "Exekutionsantrag", "Insolvenzantrag", "Grundbuchauszug"
]

GERICHTE_AT = [
    "BG", "LG", "OLG", "OGH", "VwGH", "VfGH", "BVwG", "LVwG"
]

RECHTSGEBIETE = [
    "Zivilrecht", "Strafrecht", "Verwaltungsrecht", "Arbeitsrecht",
    "Familienrecht", "Erbrecht", "Mietrecht", "Insolvenzrecht"
]
```

### Financial Classification
```python
FINANCIAL_DOC_TYPES = [
    "Eingangsrechnung", "Ausgangsrechnung", "Gutschrift",
    "Kontoauszug", "Zahlungsbeleg", "Mahnbescheid",
    "Steuerbescheid", "Lohnzettel", "Bilanz", "GuV"
]

BUCHUNGSKATEGORIEN = [
    "Betriebsausgabe", "Betriebseinnahme", "Privatentnahme",
    "Anlagevermögen", "Umlaufvermögen", "Verbindlichkeit"
]

MWST_SAETZE = ["0%", "10%", "13%", "20%"]
```

### Medical Classification
```python
MEDICAL_DOC_TYPES = [
    "Befund", "Arztbrief", "Rezept", "Überweisung",
    "Laborbericht", "Radiologiebefund", "OP-Bericht",
    "Entlassungsbrief", "Krankenstandsbestätigung"
]

FACHRICHTUNGEN = [
    "Allgemeinmedizin", "Innere Medizin", "Chirurgie",
    "Orthopädie", "Neurologie", "Kardiologie", "Radiologie",
    "Dermatologie", "Gynäkologie", "Urologie", "Pädiatrie"
]

VERSICHERUNGSTRAEGER = [
    "ÖGK", "SVS", "BVAEB", "KFA", "AUVA"
]
```

## Combined Extraction Pattern

```python
@guidance
def extract_austrian_document(lm, text, domain="general"):
    with system():
        lm += f"Du bist ein Experte für österreichische {domain} Dokumente."
    
    with user():
        lm += f"Extrahiere Daten aus: {text}"
    
    with assistant():
        # Common fields
        lm += "Datum: " + gen(name="datum", 
            regex=r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}")
        
        if domain == "financial":
            lm += "\nBetrag: " + gen(name="betrag",
                regex=r"€?\s?\d{1,3}(\.\d{3})*(,\d{2})?")
            lm += "\nUID: " + gen(name="uid", regex=r"ATU\d{8}")
            lm += "\nIBAN: " + gen(name="iban", 
                regex=r"AT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}")
        
        elif domain == "medical":
            lm += "\nSVNR: " + gen(name="svnr", 
                regex=r"\d{4}(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}")
            lm += "\nDiagnose: " + gen(name="icd", regex=r"[A-Z]\d{2}(\.\d{1,2})?")
            lm += "\nFachrichtung: " + select(options=FACHRICHTUNGEN, name="fach")
        
        elif domain == "legal":
            lm += "\nAktenzeichen: " + gen(name="az",
                regex=r"\d{1,2}\s?[A-Za-z]{1,4}\s?\d{1,5}\/\d{2,4}[a-z]?")
            lm += "\nParagraf: " + gen(name="para",
                regex=r"§\s?\d{1,4}[a-z]?(\s?(Abs|Z)\s?\d{1,3})?")
    
    return lm
```

## Token Generation Flow

```
For each token:
1. Guidance → BiasEngine: "What tokens match constraint?"
2. BiasEngine → Guidance: {token_id: bias_value}
3. Guidance → LiteLLM → Ollama: "Generate next token"
4. Ollama → Guidance: logits[vocab_size]
5. Guidance: adjusted_logits = logits + biases
6. Guidance: Sample from adjusted_logits
7. Result: Token is GUARANTEED valid
```

## Model Selection Strategy

### Thinking Models (Complex Reasoning)
- `deepseek-r1` - Best for multi-step reasoning, analysis
- Higher token budgets (2000+)

### Instruction Models (Precise Tasks)
- `neural-chat`, `llama2`, `orca-mini` - Task execution
- Temperature 0.0-0.1 for deterministic output
- Use `select()` for constrained choices

## Critical Rules

### 1. Always Use Context Managers
```python
# CORRECT
with system():
    lm += "System prompt"
with user():
    lm += "User input"
with assistant():
    lm += gen(name="response")

# WRONG - never do this
lm += "system: prompt"
```

### 2. Temperature Guidelines
- `0.0` - Deterministic (classification, extraction)
- `0.3` - Low variance (most tasks)
- `0.7` - Creative (summaries, content)

## LiteLLM Configuration

```python
litellm_config = {
    "model_name": "neural-chat",
    "litellm_params": {
        "model": "ollama/neural-chat",
        "api_base": "http://host.docker.internal:11434/v1",
        "api_key": "ollama",
    }
}

lm = guidance.models.experimental.LiteLLM(
    model_description=litellm_config,
    echo=False,
    max_tokens=2048
)
```

## Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `gen()` without name | `gen(name="output")` |
| High temp for extraction | `temperature=0.0` |
| No context managers | `with system/user/assistant():` |
| German comma in regex | Escape: `\,` or use `(,\d{2})?` |
| Components are nested | Components are siblings |