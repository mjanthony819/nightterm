"""NIGHTTERM API: quotes, history and news for NSE. Read-only, no keys, cached."""
import asyncio
import os
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from terminal import news, universe, yahoo
from terminal.cache import TTLCache

QUOTE_TTL = float(os.environ.get("QUOTE_TTL", 45))
HIST_TTL_INTRADAY = 120
HIST_TTL_DAILY = 1800
NEWS_TTL = 300
MAX_SYMBOLS = 60
NOTE = "Quotes delayed ~15 min. Unofficial Yahoo Finance data. Not investment advice."

cache = TTLCache()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.client = httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=True)
    yield
    await app.state.client.aclose()


app = FastAPI(title="NIGHTTERM API", version="1.0", lifespan=lifespan)
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"], allow_headers=["*"])


def _client():
    return app.state.client


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/universe")
def get_universe():
    return {
        "nifty50": [{"symbol": s, "name": n} for s, n in universe.NIFTY50.items()],
        "indices": [{"symbol": s, "name": n} for s, n in universe.INDICES.items()],
        "note": NOTE,
    }


@app.get("/search")
def search(q: str = Query("", max_length=40)):
    return {"results": universe.search(q), "hint": "Any other NSE symbol works too: type it and press Enter."}


async def _one_quote(sym: str):
    async def load():
        return await yahoo.fetch_quote(_client(), sym)
    try:
        q, stale = await cache.fetch(f"q:{sym}", QUOTE_TTL, load)
        return sym, ({**q, "stale": True} if stale else q), None
    except Exception as e:
        return sym, None, str(e)


@app.get("/quotes")
async def quotes(symbols: str = Query(..., max_length=2000)):
    syms, bad = [], []
    for raw in symbols.split(","):
        raw = raw.strip()
        if not raw:
            continue
        y = universe.normalize(raw)
        (syms if y else bad).append(y or raw[:24].upper())
    syms = list(dict.fromkeys(syms))
    if not syms and not bad:
        raise HTTPException(400, "no symbols")
    if len(syms) > MAX_SYMBOLS:
        raise HTTPException(400, f"max {MAX_SYMBOLS} symbols per request")
    results = await asyncio.gather(*[_one_quote(s) for s in syms])
    return {
        "quotes": [q for _, q, _ in results if q],
        "missing": bad + [universe.display(s) for s, q, _ in results if not q],
        "asof": int(time.time()),
        "note": NOTE,
    }


@app.get("/history")
async def history(symbol: str = Query(..., max_length=24), range: str = Query("6M")):
    r = range.upper()
    if r not in yahoo.RANGES:
        raise HTTPException(400, f"range must be one of {', '.join(yahoo.RANGES)}")
    y = universe.normalize(symbol)
    if not y:
        raise HTTPException(400, "bad symbol")

    async def load():
        return await yahoo.fetch_history(_client(), y, r)
    ttl = HIST_TTL_INTRADAY if r in yahoo.INTRADAY else HIST_TTL_DAILY
    try:
        data, stale = await cache.fetch(f"h:{y}:{r}", ttl, load)
    except yahoo.UpstreamError as e:
        raise HTTPException(404, f"{universe.display(y)}: {e}")
    except Exception:
        raise HTTPException(502, "Yahoo Finance did not answer. Try again in a minute.")
    if not data["bars"]:
        raise HTTPException(404, f"{universe.display(y)}: no bars for this range")
    return {**data, "stale": stale, "note": NOTE}


@app.get("/news")
async def get_news(symbol: str | None = Query(None, max_length=24)):
    q = news.DEFAULT_Q
    label = "MARKETS"
    if symbol:
        y = universe.normalize(symbol)
        if not y:
            raise HTTPException(400, "bad symbol")
        s = universe.display(y)
        label = s
        q = news.symbol_query(universe.NIFTY50.get(s, s))

    async def load():
        return await news.fetch(_client(), q)
    try:
        items, stale = await cache.fetch(f"n:{q}", NEWS_TTL, load)
    except Exception:
        raise HTTPException(502, "News feed unavailable right now.")
    return {"label": label, "items": items, "stale": stale, "source": "Google News RSS"}
