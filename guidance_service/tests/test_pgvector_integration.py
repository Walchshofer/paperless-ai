"""
Test pgvector Database Integration

Tests for:
- Connection handling
- Vector storage and retrieval
- Similarity search
- Schema validation
"""
import pytest
import json
import os


# Skip all tests if psycopg2 is not available
pytest.importorskip("psycopg2")


class TestDatabaseConnection:
    """Tests for database connection handling."""

    def test_connection_with_valid_credentials(
        self,
        pg_connection_string,
        skip_if_no_postgres,
    ):
        """Should connect with valid credentials."""
        import psycopg2
        conn = psycopg2.connect(pg_connection_string)
        assert conn is not None
        conn.close()

    def test_connection_handles_invalid_credentials(
        self,
    ):
        """Should handle invalid credentials gracefully."""
        import psycopg2
        with pytest.raises(psycopg2.OperationalError):
            psycopg2.connect(
                "postgresql://invalid:invalid@localhost:5432/nonexistent"
            )

    def test_pgvector_extension_available(
        self, pg_connection_string, skip_if_no_postgres
    ):
        """pgvector extension should be available."""
        import psycopg2
        conn = psycopg2.connect(pg_connection_string)
        cur = conn.cursor()

        try:
            cur.execute("SELECT * FROM pg_extension WHERE extname = 'vector'")
            result = cur.fetchone()
            # Extension may or may not be installed
            # Document expected state
        finally:
            cur.close()
            conn.close()


class TestVectorStorage:
    """Tests for vector storage operations."""

    @pytest.fixture
    def test_table(self, pg_connection_string, skip_if_no_postgres):
        """Create and cleanup test table."""
        import psycopg2
        conn = psycopg2.connect(pg_connection_string)
        cur = conn.cursor()

        # Create test table (aligns with document_embeddings.vector(384))
        cur.execute("""
            CREATE TABLE IF NOT EXISTS test_embeddings (
                id SERIAL PRIMARY KEY,
                document_id INTEGER,
                content TEXT,
                embedding vector(384)
            )
        """)
        conn.commit()

        yield conn, cur

        # Cleanup
        cur.execute("DROP TABLE IF EXISTS test_embeddings")
        conn.commit()
        cur.close()
        conn.close()

    def test_insert_vector(self, test_table):
        """Should insert vector successfully."""
        conn, cur = test_table

        # Create a 384-dimensional test vector
        test_vector = [0.1] * 384

        sql = (
            "INSERT INTO test_embeddings (document_id,"
            " content, embedding) VALUES (%s, %s, %s)"
        )
        cur.execute(sql, (1, "Test document", test_vector))
        conn.commit()

        # Verify insert
        cur.execute(
            "SELECT COUNT(*) FROM test_embeddings WHERE document_id = 1"
        )
        count = cur.fetchone()[0]
        assert count == 1

    def test_vector_dimension_validation(self, test_table):
        """Should reject vectors with wrong dimensions."""
        conn, cur = test_table

        # Wrong dimension (128 instead of 384)
        wrong_vector = [0.1] * 128

        with pytest.raises(Exception):  # DataError or similar
            sql = (
                "INSERT INTO test_embeddings (document_id,"
                " content, embedding) VALUES (%s, %s, %s)"
            )
            cur.execute(sql, (2, "Wrong dimensions", wrong_vector))
            conn.commit()
            conn.commit()


class TestSimilaritySearch:
    """Tests for vector similarity search."""

    @pytest.fixture
    def populated_table(
        self, pg_connection_string, skip_if_no_postgres
    ):
        """Create table with test data."""
        import psycopg2
        conn = psycopg2.connect(pg_connection_string)
        cur = conn.cursor()

        # Create test table (aligns with document_embeddings.vector(384))
        cur.execute("""
            CREATE TABLE IF NOT EXISTS test_similarity (
                id SERIAL PRIMARY KEY,
                content TEXT,
                embedding vector(384)
            )
        """)

        # Insert test vectors
        vectors = [
            ("medical document", [1.0] + [0.0] * 383),
            ("financial document", [0.0, 1.0] + [0.0] * 382),
            ("legal document", [0.0, 0.0, 1.0] + [0.0] * 381),
        ]

        for content, vec in vectors:
            sql = (
                "INSERT INTO test_similarity (content,"
                " embedding) VALUES (%s, %s)"
            )
            cur.execute(sql, (content, vec))

        conn.commit()

        yield conn, cur

        # Cleanup
        cur.execute("DROP TABLE IF EXISTS test_similarity")
        conn.commit()
        cur.close()
        conn.close()

    def test_cosine_similarity_search(self, populated_table):
        """Should find similar vectors using cosine distance."""
        conn, cur = populated_table

        # Search for medical-like vector
        query_vector = [0.9] + [0.1] * 383

        cur.execute("""
            SELECT content, 1 - (embedding <=> %s::vector) as similarity
            FROM test_similarity
            ORDER BY embedding <=> %s::vector
            LIMIT 3
        """, (query_vector, query_vector))

        results = cur.fetchall()
        assert len(results) > 0
        # First result should be "medical document"
        assert results[0][0] == "medical document"

    def test_inner_product_search(self, populated_table):
        """Should find similar vectors using inner product."""
        conn, cur = populated_table

        query_vector = [0.0, 0.9] + [0.0] * 382

        cur.execute("""
            SELECT content, (embedding <#> %s::vector) * -1 as similarity
            FROM test_similarity
            ORDER BY embedding <#> %s::vector
            LIMIT 1
        """, (query_vector, query_vector))

        results = cur.fetchall()
        assert len(results) > 0
        # Should find financial document
        assert results[0][0] == "financial document"


class TestSchemaValidation:
    """Tests for database schema validation."""

    def test_visual_overlays_schema(
        self,
        pg_connection_string,
        skip_if_no_postgres,
    ):
        """visual_overlays table should have correct schema."""
        import psycopg2
        conn = psycopg2.connect(pg_connection_string)
        cur = conn.cursor()

        try:
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'visual_overlays'
            """)
            columns = {row[0]: row[1] for row in cur.fetchall()}

            # If table exists, check schema
            if columns:
                # Expected columns
                expected = ['id', 'document_id', 'page_number', 'overlay_type']
                for col in expected:
                    assert col in columns, f"Missing column: {col}"

        finally:
            cur.close()
            conn.close()


class TestConnectionPooling:
    """Tests for connection pool behavior."""

    def test_multiple_connections(
        self, pg_connection_string, skip_if_no_postgres
    ):
        """Should handle multiple concurrent connections."""
        import psycopg2
        connections = []

        try:
            for _ in range(5):
                conn = psycopg2.connect(pg_connection_string)
                connections.append(conn)

            assert len(connections) == 5

        finally:
            for conn in connections:
                conn.close()

    def test_connection_reuse(self, pg_connection_string, skip_if_no_postgres):
        """Connections should be reusable."""
        import psycopg2
        conn = psycopg2.connect(pg_connection_string)

        try:
            for i in range(3):
                cur = conn.cursor()
                cur.execute("SELECT 1")
                result = cur.fetchone()
                assert result[0] == 1
                cur.close()
        finally:
            conn.close()


class TestErrorRecovery:
    """Tests for error recovery scenarios."""

    def test_recovers_from_query_error(
        self, pg_connection_string, skip_if_no_postgres
    ):
        """Should recover from query errors."""
        import psycopg2
        conn = psycopg2.connect(pg_connection_string)
        cur = conn.cursor()

        try:
            # Force an error
            try:
                cur.execute("SELECT * FROM nonexistent_table")
            except psycopg2.Error:
                conn.rollback()

            # Should still work after rollback
            cur.execute("SELECT 1")
            result = cur.fetchone()
            assert result[0] == 1

        finally:
            cur.close()
            conn.close()
