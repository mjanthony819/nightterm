"""Tiny in-memory TTL cache that can serve stale values when upstream fails."""
import asyncio
import time


class TTLCache:
    def __init__(self, max_items: int = 2000):
        self._d: dict[str, tuple[float, object]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self.max_items = max_items

    def get(self, key: str, ttl: float):
        hit = self._d.get(key)
        if hit and time.monotonic() - hit[0] < ttl:
            return hit[1]
        return None

    def stale(self, key: str, max_age: float):
        hit = self._d.get(key)
        if hit and time.monotonic() - hit[0] < max_age:
            return hit[1]
        return None

    def put(self, key: str, value):
        if len(self._d) >= self.max_items:
            oldest = sorted(self._d.items(), key=lambda kv: kv[1][0])[: self.max_items // 4]
            for k, _ in oldest:
                self._d.pop(k, None)
        self._d[key] = (time.monotonic(), value)

    def lock(self, key: str) -> asyncio.Lock:
        return self._locks.setdefault(key, asyncio.Lock())

    async def fetch(self, key: str, ttl: float, loader, stale_for: float = 3600):
        """Return (value, stale_flag). One upstream call per key at a time."""
        v = self.get(key, ttl)
        if v is not None:
            return v, False
        async with self.lock(key):
            v = self.get(key, ttl)
            if v is not None:
                return v, False
            try:
                v = await loader()
            except Exception:
                old = self.stale(key, stale_for)
                if old is not None:
                    return old, True
                raise
            self.put(key, v)
            return v, False
