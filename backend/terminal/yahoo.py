"""Yahoo Finance chart endpoint (unofficial, the same one yfinance uses). Parsing is kept in
pure functions so the tests run offline; the fetchers are thin."""
import asyncio

import httpx

from . import universe

HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]
# Yahoo 429s some long browser UA strings from datacenter IPs; the short one is accepted.
HEADERS = {"User-Agent": "Mozilla/5.0"}

# label -> (yahoo range, yahoo interval)
RANGES = {
    "1D": ("1d", "5m"), "5D": ("5d", "15m"), "1M": ("1mo", "1d"), "6M": ("6mo", "1d"),
    "1Y": ("1y", "1d"), "5Y": ("5y", "1wk"), "MAX": ("max", "1mo"),
}
INTRADAY = {"1D", "5D"}

_sem = asyncio.Semaphore(8)


class UpstreamError(Exception):
    pass


def _num(v):
    return None if v is None else float(v)


def _result(payload: dict) -> dict:
    chart = (payload or {}).get("chart") or {}
    res = chart.get("result")
    if not res:
        err = (chart.get("error") or {}).get("description") or "no data"
        raise UpstreamError(err)
    return res[0]


def parse_quote(payload: dict, sym: str) -> dict:
    """Latest price, previous close, day stats and an intraday sparkline from a 1d/5m chart."""
    r = _result(payload)
    m = r.get("meta") or {}
    q = ((r.get("indicators") or {}).get("quote") or [{}])[0]
    closes = [float(c) for c in (q.get("close") or []) if c is not None]
    price = _num(m.get("regularMarketPrice"))
    if price is None and closes:
        price = closes[-1]
    if price is None:
        raise UpstreamError("no price")
    prev = _num(m.get("chartPreviousClose")) or _num(m.get("previousClose"))
    change = None if prev in (None, 0) else price - prev
    pct = None if change is None else change / prev * 100
    vols = [v for v in (q.get("volume") or []) if v is not None]
    return {
        "symbol": universe.display(sym),
        "yahoo": sym,
        "name": m.get("longName") or m.get("shortName") or universe.display(sym),
        "price": round(price, 2),
        "prev_close": None if prev is None else round(prev, 2),
        "change": None if change is None else round(change, 2),
        "change_pct": None if pct is None else round(pct, 2),
        "day_high": _num(m.get("regularMarketDayHigh")),
        "day_low": _num(m.get("regularMarketDayLow")),
        "wk52_high": _num(m.get("fiftyTwoWeekHigh")),
        "wk52_low": _num(m.get("fiftyTwoWeekLow")),
        "volume": _num(m.get("regularMarketVolume")) or (float(sum(vols)) if vols else None),
        "time": m.get("regularMarketTime"),
        "currency": m.get("currency"),
        "spark": [round(c, 2) for c in _downsample(closes, 48)],
    }


def _downsample(xs: list[float], n: int) -> list[float]:
    if len(xs) <= n:
        return xs
    step = (len(xs) - 1) / (n - 1)
    return [xs[round(i * step)] for i in range(n)]


def parse_history(payload: dict) -> dict:
    """OHLCV bars. Times are shifted to exchange-local wall clock so the chart shows IST."""
    r = _result(payload)
    m = r.get("meta") or {}
    off = int(m["gmtoffset"]) if m.get("gmtoffset") is not None else 19800
    ts = r.get("timestamp") or []
    q = ((r.get("indicators") or {}).get("quote") or [{}])[0]
    o, h, l, c, v = (q.get(k) or [] for k in ("open", "high", "low", "close", "volume"))
    bars, seen = [], set()
    for i, t in enumerate(ts):
        try:
            row = (o[i], h[i], l[i], c[i])
        except IndexError:
            break
        if any(x is None for x in row):
            continue
        tt = int(t) + off
        if tt in seen:
            continue
        seen.add(tt)
        vol = v[i] if i < len(v) and v[i] is not None else 0
        bars.append({"t": tt, "o": round(row[0], 2), "h": round(row[1], 2), "l": round(row[2], 2),
                     "c": round(row[3], 2), "v": int(vol)})
    bars.sort(key=lambda b: b["t"])
    # Yahoo often leaves today's daily bar as all-null right after the close. Remember the slot
    # so the caller can fill it from the intraday data instead of showing yesterday as "latest".
    pending = None
    if ts and (not bars or int(ts[-1]) + off > bars[-1]["t"]):
        pending = int(ts[-1]) + off
    return {"bars": bars, "name": m.get("longName") or m.get("shortName"), "currency": m.get("currency"), "pending_t": pending}


def bar_from_intraday(payload: dict, t: int) -> dict | None:
    """Collapse one session of intraday data into a single daily bar stamped `t`."""
    r = _result(payload)
    q = ((r.get("indicators") or {}).get("quote") or [{}])[0]
    rows = [(o, h, l, c, v) for o, h, l, c, v in zip(*(q.get(k) or [] for k in ("open", "high", "low", "close", "volume")))
            if None not in (o, h, l, c)]
    if not rows:
        return None
    return {"t": t, "o": round(rows[0][0], 2), "h": round(max(x[1] for x in rows), 2), "l": round(min(x[2] for x in rows), 2),
            "c": round(rows[-1][3], 2), "v": int(sum(x[4] or 0 for x in rows))}


async def _get(client: httpx.AsyncClient, sym: str, rng: str, interval: str) -> dict:
    path = f"/v8/finance/chart/{universe.url_part(sym)}"
    last = None
    for attempt in range(3):
        host = HOSTS[attempt % len(HOSTS)]
        try:
            async with _sem:
                r = await client.get(host + path, params={"range": rng, "interval": interval}, headers=HEADERS)
            if r.status_code == 404:
                raise UpstreamError("unknown symbol")
            if r.status_code != 200:
                last = UpstreamError(f"upstream {r.status_code}")
                await asyncio.sleep(0.4 * (attempt + 1))
                continue
            return r.json()
        except UpstreamError:
            raise
        except Exception as e:  # network error, try the other host
            last = e
    raise UpstreamError(str(last or "upstream failed"))


async def fetch_quote(client, sym: str) -> dict:
    return parse_quote(await _get(client, sym, "1d", "5m"), sym)


async def fetch_history(client, sym: str, label: str) -> dict:
    rng, interval = RANGES[label]
    out = parse_history(await _get(client, sym, rng, interval))
    pending = out.pop("pending_t", None)
    if pending and label not in INTRADAY and label in ("1M", "6M", "1Y"):
        try:
            b = bar_from_intraday(await _get(client, sym, "1d", "5m"), pending)
            if b:
                out["bars"].append(b)
        except Exception:
            pass  # chart still works without the newest bar
    out.update(symbol=universe.display(sym), range=label, interval=interval, intraday=label in INTRADAY)
    return out
