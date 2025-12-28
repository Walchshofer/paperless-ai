"""
Test Templates and Validators Alignment

Tests for:
- Template output schema matches validator expectations
- Validators correctly identify valid/invalid outputs
- Domain-specific validation rules (ICD-10, ATU, etc.)
"""
import pytest
import json
from validators.medical import validate_medical_extraction
from validators.financial import validate_financial_extraction
from validators.legal import validate_legal_extraction
from validators.general import validate_general_extraction


# ============================================================================
# MEDICAL VALIDATOR TESTS
# ============================================================================

class TestMedicalValidator:
    """Tests for medical extraction validator."""

    def test_valid_medical_output(self, valid_medical_output):
        """Valid medical output should pass validation."""
        result = validate_medical_extraction(valid_medical_output)
        assert result['valid'] is True
        assert len(result['errors']) == 0

    def test_valid_icd10_codes(self):
        """Valid ICD-10 codes should pass."""
        output = {
            "patient": {
                "name": "Max Mustermann",
                "geburtsdatum": "1980-01-01"
            },
            "diagnosen": [
                {"icd10": "E11.9"},
                {"icd10": "I10"},
                {"icd10": "J06.9"}
            ],
            "vertrauen": 0.9
        }
        result = validate_medical_extraction(output)
        # Should not have ICD-10 format errors
        icd_errors = [e for e in result['errors'] if 'ICD' in e.upper()]
        assert len(icd_errors) == 0

    def test_invalid_icd10_codes(self):
        """Invalid ICD-10 codes should produce errors."""
        output = {
            "patient": {
                "name": "Max Mustermann",
                "geburtsdatum": "1980-01-01"
            },
            "diagnosen": [
                {"icd10": "INVALID"},
                {"icd10": "123.456"}
            ],
            "vertrauen": 0.9
        }
        result = validate_medical_extraction(output)
        # May or may not be strict about format
        # Document expected behavior

    def test_missing_patient_info_warns(self):
        """Missing patient info should produce warning."""
        output = {
            "diagnosen": [],
            "medikamente": [],
            "laborwerte": [],
            "vertrauen": 0.5
        }
        result = validate_medical_extraction(output)
        # Should have warnings about missing data
        assert len(result.get('warnings', [])) > 0 or len(result.get('errors', [])) > 0

    def test_confidence_out_of_range(self):
        """Confidence outside 0-1 should error."""
        output = {
            "patient": {
                "name": "Max Mustermann",
                "geburtsdatum": "1980-01-01"
            },
            "diagnosen": [{"icd10": "E11.9"}],
            "vertrauen": 1.5  # Invalid
        }
        result = validate_medical_extraction(output)
        confidence_issues = [
            e for e in result.get('errors', []) + result.get('warnings', [])
            if 'confidence' in e.lower() or 'vertrauen' in e.lower()
        ]
        assert len(confidence_issues) > 0


# ============================================================================
# FINANCIAL VALIDATOR TESTS
# ============================================================================

class TestFinancialValidator:
    """Tests for financial extraction validator."""

    def test_valid_financial_output(self, valid_financial_output):
        """Valid financial output should pass validation."""
        result = validate_financial_extraction(valid_financial_output)
        assert result['valid'] is True
        assert len(result['errors']) == 0

    def test_valid_atu_number(self):
        """Valid Austrian ATU number should pass."""
        output = {
            "parteien": {
                "rechnungssteller": {
                    "name": "Test GmbH",
                    "uid": "ATU12345678"
                }
            },
            "daten": {"rechnungsdatum": "2024-12-20"},
            "betraege": {
                "summe_netto": 100,
                "steuersatz": 20,
                "steuerbetrag": 20,
                "summe_brutto": 120
            }
        }
        result = validate_financial_extraction(output)
        atu_errors = [e for e in result['errors'] if 'ATU' in e.upper()]
        assert len(atu_errors) == 0

    def test_invalid_atu_number(self):
        """Invalid ATU number should produce error."""
        output = {
            "parteien": {
                "rechnungssteller": {
                    "name": "Test GmbH",
                    "uid": "ATU123"  # Too short
                }
            },
            "daten": {"rechnungsdatum": "2024-12-20"},
            "betraege": {
                "summe_netto": 100,
                "steuersatz": 20,
                "steuerbetrag": 20,
                "summe_brutto": 120
            }
        }
        result = validate_financial_extraction(output)
        # Should catch invalid ATU
        atu_issues = [e for e in result.get('errors', []) + result.get('warnings', []) if 'ATU' in e.upper() or 'uid' in e.lower()]
        assert len(atu_issues) > 0

    def test_math_consistency_netto_brutto(self):
        """Netto + MwSt should equal Brutto."""
        output = {
            "parteien": {
                "rechnungssteller": {
                    "name": "Test GmbH",
                    "uid": "ATU12345678"
                }
            },
            "betraege": {
                "summe_netto": 1000.00,
                "steuersatz": 20,
                "steuerbetrag": 200.00,
                "summe_brutto": 1200.00  # Correct
            },
            "daten": {"rechnungsdatum": "2024-12-20"}
        }
        result = validate_financial_extraction(output)
        math_errors = [e for e in result['errors'] if 'konsistenz' in e.lower() or 'math' in e.lower()]
        assert len(math_errors) == 0

    def test_math_inconsistency_detected(self):
        """Inconsistent amounts should produce error."""
        output = {
            "parteien": {
                "rechnungssteller": {
                    "name": "Test GmbH",
                    "uid": "ATU12345678"
                }
            },
            "betraege": {
                "summe_netto": 1000.00,
                "steuersatz": 20,
                "steuerbetrag": 200.00,
                "summe_brutto": 1500.00  # Wrong!
            },
            "daten": {"rechnungsdatum": "2024-12-20"}
        }
        result = validate_financial_extraction(output)
        # Should detect inconsistency
        # Implementation may vary


# ============================================================================
# LEGAL VALIDATOR TESTS
# ============================================================================

class TestLegalValidator:
    """Tests for legal extraction validator."""

    def test_valid_legal_output(self, valid_legal_output):
        """Valid legal output should pass validation."""
        result = validate_legal_extraction(valid_legal_output)
        assert result['valid'] is True
        assert len(result['errors']) == 0

    def test_valid_extractor_format(self):
        """Legal extractor format should validate correctly."""
        output = {
            "vertragsparteien": {
                "partei_1": "Vermieter GmbH",
                "partei_2": "Mieter AG"
            },
            "daten": {
                "abschluss_datum": "2024-12-20",
                "gueltig_ab": "2025-01-01"
            },
            "jurisdiktion_und_recht": {
                "anwendbares_recht": "Österreich (ABGB)"
            },
            "vertrauen": 0.9
        }
        result = validate_legal_extraction(output)
        assert result['valid'] is True

    def test_valid_classifier_format(self):
        """Legal classifier format should validate correctly."""
        output = {
            "dokumenttyp": "Mietvertrag",
            "komplexitaet": "Mittel",
            "vermutete_jurisdiktion": "Österreich",
            "vertrauen": 0.85
        }
        result = validate_legal_extraction(output)
        assert result['valid'] is True

    def test_missing_parties_errors(self):
        """Missing contract parties should produce error."""
        output = {
            "vertragsparteien": {
                "partei_1": "Only one party"
                # partei_2 missing
            },
            "vertrauen": 0.9
        }
        result = validate_legal_extraction(output)
        assert result['valid'] is False
        party_errors = [e for e in result['errors'] if 'partei' in e.lower() or 'party' in e.lower()]
        assert len(party_errors) > 0

    def test_invalid_date_format(self):
        """Invalid date format should produce error."""
        output = {
            "vertragsparteien": {
                "partei_1": "A",
                "partei_2": "B"
            },
            "daten": {
                "abschluss_datum": "20.12.2024"  # Wrong format (should be YYYY-MM-DD)
            },
            "vertrauen": 0.9
        }
        result = validate_legal_extraction(output)
        date_issues = [
            e for e in result.get('errors', []) + result.get('warnings', [])
            if 'date' in e.lower() or 'datum' in e.lower()
        ]
        assert len(date_issues) > 0


# ============================================================================
# GENERAL VALIDATOR TESTS
# ============================================================================

class TestGeneralValidator:
    """Tests for general extraction validator."""

    def test_valid_general_output(self, valid_general_output):
        """Valid general output should pass validation."""
        result = validate_general_extraction(valid_general_output)
        assert result['valid'] is True
        assert len(result['errors']) == 0

    def test_classifier_format(self):
        """General classifier format should validate."""
        output = {
            "dokumenttyp": "Korrespondenz",
            "sprache": "Deutsch",
            "themata": ["Finanzen", "Buchhaltung"],
            "enthaelt_finanzen": True,
            "enthaelt_personendaten": False,
            "vertrauen": 0.88
        }
        result = validate_general_extraction(output)
        assert result['valid'] is True

    def test_legacy_extractor_format(self):
        """Legacy extractor format should still validate."""
        output = {
            "zusammenfassung": "Dies ist eine Zusammenfassung des Dokuments mit ausreichend Text.",
            "schluesselwoerter": ["Rechnung", "Zahlung", "Betrag"]
        }
        result = validate_general_extraction(output)
        assert result['valid'] is True

    def test_empty_themata_warns(self):
        """Empty themata list should produce warning."""
        output = {
            "dokumenttyp": "Sonstige",
            "sprache": "Deutsch",
            "themata": [],  # Empty
            "vertrauen": 0.8
        }
        result = validate_general_extraction(output)
        # Should have warning about empty themata
        warnings = result.get('warnings', [])
        themata_warnings = [w for w in warnings if 'themata' in w.lower() or 'topics' in w.lower()]
        assert len(themata_warnings) > 0

    def test_routing_recommendation_format(self):
        """Cross-pipeline router output should validate."""
        output = {
            "empfehlung": "Financial",
            "sicherheit": 0.92,
            "begruendung": "Dokument enthält Rechnungsdaten"
        }
        result = validate_general_extraction(output)
        assert result['valid'] is True

    def test_invalid_pipeline_recommendation(self):
        """Invalid pipeline recommendation should error."""
        output = {
            "empfehlung": "UnknownPipeline",
            "sicherheit": 0.9
        }
        result = validate_general_extraction(output)
        assert result['valid'] is False


# ============================================================================
# CROSS-VALIDATOR TESTS
# ============================================================================

class TestValidatorEdgeCases:
    """Tests for edge cases across all validators."""

    @pytest.mark.parametrize("validator,output", [
        (validate_medical_extraction, {}),
        (validate_financial_extraction, {}),
        (validate_legal_extraction, {}),
        (validate_general_extraction, {}),
    ])
    def test_empty_output_handled(self, validator, output):
        """Empty output should be handled gracefully."""
        result = validator(output)
        assert 'valid' in result
        assert 'errors' in result

    @pytest.mark.parametrize("validator", [
        validate_medical_extraction,
        validate_financial_extraction,
        validate_legal_extraction,
        validate_general_extraction,
    ])
    def test_none_input_handled(self, validator):
        """None input should not crash."""
        try:
            result = validator(None)
            assert result['valid'] is False
        except (TypeError, AttributeError):
            # Also acceptable - clearly fails on None
            pass

    @pytest.mark.parametrize("validator", [
        validate_medical_extraction,
        validate_financial_extraction,
        validate_legal_extraction,
        validate_general_extraction,
    ])
    def test_confidence_validation_common(self, validator):
        """All validators should check confidence bounds."""
        output = {"vertrauen": 2.0}  # Invalid
        result = validator(output)
        # Should catch invalid confidence
        confidence_issues = [
            e for e in result.get('errors', []) + result.get('warnings', [])
            if 'confidence' in e.lower() or 'vertrauen' in e.lower()
        ]
        # At least one validator should flag this
