"""
Pytest Fixtures for Guidance Service Tests

Provides reusable fixtures for:
- Flask test client
- Mock Ollama responses
- Sample template variables
- Database connections (pgvector)
"""
import pytest
import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from cache.guidance_cache import GuidanceCacheManager


# ============================================================================
# FLASK APP FIXTURES
# ============================================================================

@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    app = create_app()
    app.config.update({
        'TESTING': True,
        'DEBUG': False,
    })
    yield app


@pytest.fixture
def client(app):
    """Create test client for Flask app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create CLI runner for testing commands."""
    return app.test_cli_runner()


# ============================================================================
# CACHE FIXTURES
# ============================================================================

@pytest.fixture
def cache_manager(tmp_path):
    """Create a temporary cache manager for testing."""
    cache_dir = tmp_path / "test_cache"
    return GuidanceCacheManager(str(cache_dir))


@pytest.fixture
def clean_cache(cache_manager):
    """Ensure cache is clean before each test."""
    cache_manager.clear()
    yield cache_manager
    cache_manager.clear()


# ============================================================================
# MOCK OLLAMA FIXTURES
# ============================================================================

@pytest.fixture
def mock_ollama_response():
    """Mock successful Ollama API response."""
    return {
        "model": "sauerkraut-llama3.1:8b",
        "response": json.dumps({
            "dokumenttyp": "Korrespondenz",
            "sprache": "Deutsch",
            "themata": ["Finanzen", "Buchhaltung"],
            "enthaelt_finanzen": True,
            "enthaelt_personendaten": False,
            "vertrauen": 0.92
        }),
        "done": True
    }


@pytest.fixture
def mock_ollama_error():
    """Mock Ollama API error response."""
    return {
        "error": "model not found"
    }


# ============================================================================
# SAMPLE DATA FIXTURES
# ============================================================================

@pytest.fixture
def medical_variables():
    """Sample variables for medical template."""
    return {
        "medical_text": """
        Patient: Max Mustermann, geb. 01.01.1980
        Diagnose: Diabetes mellitus Typ 2 (E11.9)
        Medikation: Metformin 500mg 1-0-1
        Nächster Termin: 15.02.2025
        """
    }


@pytest.fixture
def financial_variables():
    """Sample variables for financial template."""
    return {
        "financial_text": """
        Rechnung Nr. 2024-12345
        Rechnungsdatum: 20.12.2024
        Lieferant: Mustermann GmbH
        ATU12345678
        Nettobetrag: 1.000,00 EUR
        MwSt 20%: 200,00 EUR
        Bruttobetrag: 1.200,00 EUR
        """
    }


@pytest.fixture
def legal_variables():
    """Sample variables for legal template."""
    return {
        "legal_text": """
        MIETVERTRAG

        Zwischen:
        Vermieter: Immobilien AG, Wien
        Mieter: Hans Schmidt, 1010 Wien

        Mietobjekt: Wohnung Top 5, Musterstraße 123
        Mietzins: 1.500,00 EUR monatlich
        Beginn: 01.01.2025
        """
    }


@pytest.fixture
def general_variables():
    """Sample variables for general template."""
    return {
        "document_text": """
        Sehr geehrte Damen und Herren,

        hiermit bestätigen wir den Erhalt Ihrer Anfrage vom 15.12.2024.
        Wir werden uns schnellstmöglich bei Ihnen melden.

        Mit freundlichen Grüßen
        Kundenservice
        """
    }


# ============================================================================
# VALIDATION FIXTURES
# ============================================================================

@pytest.fixture
def valid_medical_output():
    """Valid output from medical extractor."""
    return {
        "patient": {
            "name": "Max Mustermann",
            "geburtsdatum": "1980-01-01"
        },
        "diagnosen": [
            {
                "icd10": "E11.9"
            }
        ],
        "medikamente": [
            {
                "name": "Metformin",
                "dosierung": "500mg"
            }
        ],
        "laborwerte": [
            {
                "name": "HbA1c",
                "wert": "7.1",
                "einheit": "%"
            }
        ],
        "vertrauen": 0.95
    }


@pytest.fixture
def valid_financial_output():
    """Valid output from financial extractor."""
    return {
        "parteien": {
            "rechnungssteller": {
                "name": "Mustermann GmbH",
                "uid": "ATU12345678"
            }
        },
        "daten": {
            "rechnungsdatum": "2024-12-20"
        },
        "betraege": {
            "summe_netto": 1000.00,
            "steuersatz": 20.0,
            "steuerbetrag": 200.00,
            "summe_brutto": 1200.00
        }
    }


@pytest.fixture
def valid_legal_output():
    """Valid output from legal extractor."""
    return {
        "vertragsparteien": {
            "partei_1": "Immobilien AG",
            "partei_2": "Hans Schmidt"
        },
        "daten": {
            "abschluss_datum": "2024-12-20",
            "gueltig_ab": "2025-01-01"
        },
        "jurisdiktion_und_recht": {
            "anwendbares_recht": "Österreich (ABGB)"
        },
        "vertrauen": 0.91
    }


@pytest.fixture
def valid_general_output():
    """Valid output from general classifier."""
    return {
        "dokumenttyp": "Korrespondenz",
        "sprache": "Deutsch",
        "themata": ["Kundenservice", "Bestätigung"],
        "enthaelt_finanzen": False,
        "enthaelt_personendaten": False,
        "vertrauen": 0.85
    }


# ============================================================================
# DATABASE FIXTURES (pgvector)
# ============================================================================

@pytest.fixture(scope='session')
def pg_connection_string():
    """PostgreSQL connection string for testing."""
    return os.environ.get(
        'TEST_POSTGRES_DSN',
        'postgresql://postgres:postgres@localhost:5432/guidance_test'
    )


@pytest.fixture
def skip_if_no_postgres(pg_connection_string):
    """Skip test if PostgreSQL is not available."""
    import psycopg2
    try:
        conn = psycopg2.connect(pg_connection_string)
        conn.close()
    except Exception:
        pytest.skip("PostgreSQL not available for testing")
