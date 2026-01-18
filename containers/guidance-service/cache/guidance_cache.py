import hashlib
import json
import pickle
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import diskcache as dc

class GuidanceCacheManager:
    """
    Sophisticated caching strategy for Guidance generation outputs.
    Uses seed-based hashing and template-aware cache management.
    """

    def __init__(self, cache_dir: str = './cache', ttl_hours: int = 72):
        self.cache = dc.Cache(cache_dir)
        self.ttl = timedelta(hours=ttl_hours)
        self.stats = {
            'hits': 0, 'misses': 0, 'invalidations': 0, 'expired': 0
        }

    def _generate_cache_key(
        self,
        template: str,
        variables: Dict,
        model: str,
        temperature: float,
    ) -> str:
        """Generate deterministic cache key."""
        cache_input = {
            'template': template,
            'model': model,
            'temperature': temperature,
            'variables': self._serialize_variables(variables)
        }
        cache_str = json.dumps(cache_input, sort_keys=True)
        return hashlib.sha256(cache_str.encode()).hexdigest()

    def _serialize_variables(self, variables: Dict) -> Dict:
        """Serialize variables for consistent hashing."""
        serialized = {}
        for key, value in variables.items():
            if isinstance(value, (str, int, float, bool, type(None))):
                serialized[key] = value
            elif isinstance(value, dict) or isinstance(value, list):
                serialized[key] = json.dumps(value, sort_keys=True)
            else:
                serialized[key] = str(value)
        return serialized

    def get(
        self,
        template: str,
        variables: Dict,
        model: str,
        temperature: float,
    ) -> Optional[Dict]:
        """Retrieve cached result if exists and not expired."""
        cache_key = self._generate_cache_key(
            template, variables, model, temperature
        )
        try:
            cached_entry = self.cache.get(cache_key)
            if cached_entry is None:
                self.stats['misses'] += 1
                return None

            entry_data, timestamp = cached_entry
            if datetime.now() - timestamp > self.ttl:
                del self.cache[cache_key]
                self.stats['expired'] += 1
                return None

            self.stats['hits'] += 1
            return entry_data
        except:
            self.stats['misses'] += 1
            return None

    def set(
        self,
        template: str,
        variables: Dict,
        model: str,
        temperature: float,
        result: Dict,
    ) -> bool:
        """Store result in cache with timestamp."""
        cache_key = self._generate_cache_key(
            template, variables, model, temperature
        )
        try:
            self.cache[cache_key] = (result, datetime.now())
            return True
        except:
            return False