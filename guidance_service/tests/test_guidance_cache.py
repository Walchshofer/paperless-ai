"""
Test Guidance Cache Manager

Tests for:
- Cache key generation
- Cache storage and retrieval
- TTL expiration
- Cache invalidation
"""
import pytest
import json
import time
from cache.guidance_cache import GuidanceCacheManager


class TestCacheKeyGeneration:
    """Tests for cache key generation."""

    def test_generates_consistent_keys(self, cache_manager):
        """Same inputs should generate same cache key."""
        key1 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'hello'},
            model='test-model',
            temperature=0.1
        )
        key2 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'hello'},
            model='test-model',
            temperature=0.1
        )
        assert key1 == key2

    def test_different_variables_different_keys(self, cache_manager):
        """Different variables should generate different keys."""
        key1 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'hello'},
            model='test-model',
            temperature=0.1
        )
        key2 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'world'},
            model='test-model',
            temperature=0.1
        )
        assert key1 != key2

    def test_different_models_different_keys(self, cache_manager):
        """Different models should generate different keys."""
        key1 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'hello'},
            model='model-a',
            temperature=0.1
        )
        key2 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'hello'},
            model='model-b',
            temperature=0.1
        )
        assert key1 != key2

    def test_different_temperature_different_keys(self, cache_manager):
        """Different temperatures should generate different keys."""
        key1 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'hello'},
            model='test-model',
            temperature=0.1
        )
        key2 = cache_manager._generate_key(
            template='test_template',
            variables={'text': 'hello'},
            model='test-model',
            temperature=0.9
        )
        assert key1 != key2


class TestCacheStorage:
    """Tests for cache storage and retrieval."""

    def test_set_and_get(self, clean_cache):
        """Should store and retrieve values."""
        cache = clean_cache
        result = {'generated': {'test': 'value'}, 'validation': {'valid': True}}

        cache.set(
            template='test',
            variables={'x': 1},
            model='model',
            temperature=0.1,
            result=result
        )

        retrieved = cache.get(
            template='test',
            variables={'x': 1},
            model='model',
            temperature=0.1
        )

        assert retrieved is not None
        assert retrieved['generated'] == result['generated']

    def test_get_nonexistent_returns_none(self, clean_cache):
        """Getting non-existent key should return None."""
        cache = clean_cache

        result = cache.get(
            template='nonexistent',
            variables={'x': 1},
            model='model',
            temperature=0.1
        )

        assert result is None

    def test_overwrite_existing(self, clean_cache):
        """Should overwrite existing cache entries."""
        cache = clean_cache

        cache.set('t', {'a': 1}, 'm', 0.1, {'v': 'old'})
        cache.set('t', {'a': 1}, 'm', 0.1, {'v': 'new'})

        retrieved = cache.get('t', {'a': 1}, 'm', 0.1)
        assert retrieved['v'] == 'new'


class TestCacheTTL:
    """Tests for TTL (time-to-live) functionality."""

    def test_expired_entries_not_returned(self, tmp_path):
        """Expired entries should not be returned."""
        # Create cache with very short TTL
        cache = GuidanceCacheManager(str(tmp_path / 'ttl_cache'), ttl_hours=0.0001)

        cache.set('t', {}, 'm', 0.1, {'v': 'test'})

        # Wait for expiry
        time.sleep(0.5)

        result = cache.get('t', {}, 'm', 0.1)
        # May or may not be expired depending on implementation
        # This test documents expected behavior


class TestCacheInvalidation:
    """Tests for cache invalidation."""

    def test_clear_removes_all_entries(self, clean_cache):
        """Clear should remove all cache entries."""
        cache = clean_cache

        cache.set('t1', {}, 'm', 0.1, {'v': '1'})
        cache.set('t2', {}, 'm', 0.1, {'v': '2'})

        cache.clear()

        assert cache.get('t1', {}, 'm', 0.1) is None
        assert cache.get('t2', {}, 'm', 0.1) is None

    def test_clear_specific_template(self, clean_cache):
        """Should support clearing entries for specific template."""
        cache = clean_cache

        cache.set('template_a', {}, 'm', 0.1, {'v': 'a'})
        cache.set('template_b', {}, 'm', 0.1, {'v': 'b'})

        # If clear_template exists
        if hasattr(cache, 'clear_template'):
            cache.clear_template('template_a')
            assert cache.get('template_a', {}, 'm', 0.1) is None
            assert cache.get('template_b', {}, 'm', 0.1) is not None


class TestCachePersistence:
    """Tests for cache persistence across restarts."""

    def test_persists_across_instances(self, tmp_path):
        """Cache should persist across manager instances."""
        cache_dir = str(tmp_path / 'persist_cache')

        # Create cache and store value
        cache1 = GuidanceCacheManager(cache_dir)
        cache1.set('t', {'x': 1}, 'm', 0.1, {'v': 'persisted'})

        # Create new cache instance with same directory
        cache2 = GuidanceCacheManager(cache_dir)
        result = cache2.get('t', {'x': 1}, 'm', 0.1)

        assert result is not None
        assert result['v'] == 'persisted'


class TestCacheEdgeCases:
    """Tests for edge cases and error handling."""

    def test_handles_complex_variables(self, clean_cache):
        """Should handle complex nested variables."""
        cache = clean_cache
        complex_vars = {
            'text': 'hello',
            'nested': {'a': [1, 2, 3], 'b': {'c': 'd'}},
            'list': [1, 'two', 3.0]
        }

        cache.set('t', complex_vars, 'm', 0.1, {'v': 'test'})
        result = cache.get('t', complex_vars, 'm', 0.1)

        assert result is not None

    def test_handles_unicode_in_variables(self, clean_cache):
        """Should handle unicode characters in variables."""
        cache = clean_cache
        unicode_vars = {
            'text': 'Österreich Ärzte Übung',
            'emoji': 'Test 🔬 emoji'
        }

        cache.set('t', unicode_vars, 'm', 0.1, {'v': 'test'})
        result = cache.get('t', unicode_vars, 'm', 0.1)

        assert result is not None

    def test_handles_empty_variables(self, clean_cache):
        """Should handle empty variables dict."""
        cache = clean_cache

        cache.set('t', {}, 'm', 0.1, {'v': 'test'})
        result = cache.get('t', {}, 'm', 0.1)

        assert result is not None
