"""
Austrian/German domain-specific regex patterns for Pydantic Field validation.

These patterns are used with Pydantic's Field(pattern=...) to provide:
1. Early validation before LLM processing
2. Constrained output tokens during gen_json()
3. Deterministic format enforcement

Usage:
    from templates.components.patterns import PATTERN_UID_AT

    class Invoice(BaseModel):
        uid: str = Field(pattern=PATTERN_UID_AT)
"""

# Date patterns (DD.MM.YYYY format common in Austrian/German documents)
# Matches: 01.01.2024, 31.12.1999
PATTERN_DATE_AT = r"(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.(19|20)\d{2}"

# Austrian VAT ID (UID) pattern - ATU + 8 digits
# Matches: ATU12345678
PATTERN_UID_AT = r"ATU\d{8}"

# Austrian IBAN pattern - AT + 2 check + 16 digits (optional spaces)
# Matches: AT61 1904 3002 3457 3201 or AT611904300234573201
PATTERN_IBAN_AT = r"AT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}"

# ICD-10 diagnosis code pattern
# Matches: A00, Z99.9, F32.1
PATTERN_ICD10 = r"[A-TV-Z]\d{2}(\.\d{1,2})?"

# Austrian Social Insurance Number (SVNR) - 10 digits: NNNN DD MM YY
# Matches: 1234010190 (born 01.01.1990)
PATTERN_SVNR = r"\d{4}(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}"

# Euro amount pattern (German format: 1.234,56)
# Matches: €1.234,56, 1234,56 EUR, € 99,00
PATTERN_EURO_AMOUNT = r"(€\s?)?\d{1,3}(\.\d{3})*(,\d{2})?(\s?EUR)?"

# Austrian phone number pattern
# Matches: +43 1 234567, 0664/1234567, +43 664 123 45 67
PATTERN_PHONE_AT = (
    r"(\+43|0)\s?\d{1,4}[\s/-]?\d{3,4}[\s/-]?\d{2,4}[\s/-]?\d{0,4}"
)

# Austrian postal code (PLZ) - 4 digits
# Matches: 1010, 8020, 5020
PATTERN_PLZ_AT = r"[1-9]\d{3}"

# Export all patterns
__all__ = [
    "PATTERN_DATE_AT",
    "PATTERN_UID_AT",
    "PATTERN_IBAN_AT",
    "PATTERN_ICD10",
    "PATTERN_SVNR",
    "PATTERN_EURO_AMOUNT",
    "PATTERN_PHONE_AT",
    "PATTERN_PLZ_AT",
]
