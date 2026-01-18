import os
from collections import Counter, defaultdict
from threading import Lock
from typing import Dict, Iterable, List, Optional, Tuple


_TRUTHY = {"1", "true", "yes", "on"}


def _env_bool(key: str, default: str = "false") -> bool:
    return os.getenv(key, default).strip().lower() in _TRUTHY


def _normalize_tag(tag: object) -> Optional[str]:
    if tag is None:
        return None
    text = str(tag).strip()
    if not text:
        return None
    return text


def _normalize_tag_list(tags: Iterable[object]) -> List[str]:
    cleaned: List[str] = []
    seen = set()
    for tag in tags or []:
        text = _normalize_tag(tag)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
    return cleaned


class TagStatistics:
    def __init__(
        self,
        max_tags: int = 2000,
        max_cooccurrence_per_tag: int = 200,
    ) -> None:
        self._max_tags = max_tags
        self._max_cooccurrence_per_tag = max_cooccurrence_per_tag
        self._tag_frequency: Dict[str, Counter] = defaultdict(Counter)
        self._co_occurrence: Dict[str, Dict[str, Counter]] = defaultdict(
            lambda: defaultdict(Counter)
        )
        self._canonical: Dict[str, str] = {}
        self._events: Counter = Counter()
        self._total_events = 0
        self._lock = Lock()

    def total_events(self, domain: Optional[str] = None) -> int:
        with self._lock:
            if domain:
                return int(self._events.get(domain, 0))
            return int(self._total_events)

    def record(self, tags: Iterable[object], domain: str) -> None:
        cleaned = _normalize_tag_list(tags)
        normalized = [tag.lower() for tag in cleaned]
        with self._lock:
            self._events[domain] += 1
            self._total_events += 1
            for tag, key in zip(cleaned, normalized):
                if key not in self._canonical:
                    self._canonical[key] = tag
                self._tag_frequency[domain][key] += 1

            for i, tag_a in enumerate(normalized):
                for tag_b in normalized[i + 1 :]:
                    self._co_occurrence[domain][tag_a][tag_b] += 1
                    self._co_occurrence[domain][tag_b][tag_a] += 1

            self._prune_domain(domain)

    def build_context(
        self,
        existing_tags: Iterable[object],
        domain: str,
        min_events: int,
        frequent_limit: int,
        cooccurrence_limit: int,
        min_count: int,
    ) -> str:
        existing_clean = _normalize_tag_list(existing_tags)
        existing_keys = {tag.lower() for tag in existing_clean}
        with self._lock:
            if self._total_events < min_events:
                return ""
            frequency = self._tag_frequency.get(domain, Counter()).copy()
            co_map = {
                tag: counts.copy()
                for tag, counts in self._co_occurrence.get(domain, {}).items()
            }
            canonical = dict(self._canonical)

        frequent_tags = [
            canonical.get(tag, tag)
            for tag, count in frequency.most_common(frequent_limit)
            if tag not in existing_keys and count >= min_count
        ]

        cooccurrence_entries: List[Tuple[str, List[str]]] = []
        if existing_keys:
            for seed in existing_keys:
                candidates = [
                    canonical.get(tag, tag)
                    for tag, count in co_map.get(seed, Counter()).most_common(
                        cooccurrence_limit
                    )
                    if tag not in existing_keys and count >= min_count
                ]
                if candidates:
                    cooccurrence_entries.append(
                        (canonical.get(seed, seed), candidates)
                    )

        parts: List[str] = []
        if frequent_tags:
            parts.append(f"frequent tags: {', '.join(frequent_tags)}")
        if cooccurrence_entries:
            co_text_entries = [
                f"{seed} -> {', '.join(tags)}"
                for seed, tags in cooccurrence_entries
            ]
            co_text = "; ".join(co_text_entries)
            parts.append(f"co-occurrence hints: {co_text}")

        if not parts:
            return ""
        joined_parts = '; '.join(parts)
        return f"Tag stats (hint): {joined_parts}."

    def _prune_domain(self, domain: str) -> None:
        freq = self._tag_frequency.get(domain)
        if freq and len(freq) > self._max_tags:
            most_common = dict(freq.most_common(self._max_tags))
            self._tag_frequency[domain] = Counter(most_common)
        co_map = self._co_occurrence.get(domain, {})
        for tag, counter in list(co_map.items()):
            if len(counter) <= self._max_cooccurrence_per_tag:
                continue
            trimmed = dict(counter.most_common(self._max_cooccurrence_per_tag))
            co_map[tag] = Counter(trimmed)


_TAG_STATS = TagStatistics(
    max_tags=int(os.getenv("GUIDANCE_STATS_MAX_TAGS", "2000")),
    max_cooccurrence_per_tag=int(
        os.getenv("GUIDANCE_STATS_MAX_COOC_PER_TAG", "200")
    ),
)


def stats_enabled() -> bool:
    return _env_bool("GUIDANCE_STATS_ENABLED", "false")


def record_tag_stats(
    *,
    domain: str,
    suggested_tags: Iterable[object],
    missing_tags: Iterable[object],
) -> None:
    if not stats_enabled():
        return
    tags = list(suggested_tags or []) + list(missing_tags or [])
    _TAG_STATS.record(tags, domain or "unknown")


def build_tag_stats_context(
    *,
    existing_tags: Iterable[object],
    domain: str,
) -> str:
    if not stats_enabled():
        return ""
    min_events = int(os.getenv("GUIDANCE_STATS_MIN_EVENTS", "500"))
    frequent_limit = int(os.getenv("GUIDANCE_STATS_FREQUENT_LIMIT", "5"))
    cooccurrence_limit = int(
        os.getenv("GUIDANCE_STATS_COOCCURRENCE_LIMIT", "3")
    )
    min_count = int(os.getenv("GUIDANCE_STATS_MIN_COUNT", "2"))
    return _TAG_STATS.build_context(
        existing_tags=existing_tags,
        domain=domain or "unknown",
        min_events=min_events,
        frequent_limit=frequent_limit,
        cooccurrence_limit=cooccurrence_limit,
        min_count=min_count,
    )
