import asyncio
import time

import pytest
from fastapi.testclient import TestClient

import main
from terminal import news, universe, yahoo
from terminal.cache import TTLCache

CHART = {"chart": {"result": [{
    "meta": {"symbol": "TCS.NS", "longName": "Tata Consultancy Services Limited", "regularMarketPrice": 110.0,
             "chartPreviousClose": 100.0, "regularMarketDayHigh": 111, "regularMarketDayLow": 99,
             "fiftyTwoWeekHigh": 150, "fiftyTwoWeekLow": 80, "regularMarketVolume": 1234, "currency": "INR",
             "regularMarketTime": 1700000000, "gmtoffset": 19800},
    "timestamp": [1000, 1060, 1120, 1120, 1180],
    "indicators": {"quote": [{
        "open": [1, 2, None, 3, 4], "high": [2, 3, None, 4, 5], "low": [0.5, 1, None, 2, 3],
        "close": [1.5, 2.5, None, 3.5, 4.5], "volume": [10, 20, None, 30, None]}]},
}], "error": None}}


def test_normalize():
    assert universe.normalize("tcs") == "TCS.NS"
    assert universe.normalize("m&m") == "M&M.NS"
    assert universe.normalize("^nsei") == "^NSEI"
    assert universe.normalize("RELIANCE.BO") == "RELIANCE.BO"
    for bad in ["", "a b", "x" * 40, "TCS;DROP", "../etc", "<script>"]:
        assert universe.normalize(bad) is None


def test_url_part_encodes_ampersand():
    assert universe.url_part("M&M.NS") == "M%26M.NS"


def test_nifty_universe_size_and_search():
    assert len(universe.NIFTY50) == 50
    assert universe.search("tata")[0]["name"].lower().startswith("tata")
    assert universe.search("rel")[0]["symbol"] == "RELIANCE"
    assert universe.search("") == []


def test_parse_quote():
    q = yahoo.parse_quote(CHART, "TCS.NS")
    assert q["symbol"] == "TCS" and q["price"] == 110.0
    assert q["change"] == 10.0 and q["change_pct"] == 10.0
    assert q["spark"] == [1.5, 2.5, 3.5, 4.5]  # None skipped
    assert q["wk52_high"] == 150


def test_parse_quote_falls_back_to_last_close_and_handles_missing_prev():
    p = {"chart": {"result": [{"meta": {}, "indicators": {"quote": [{"close": [5.0, 6.0]}]}}]}}
    q = yahoo.parse_quote(p, "X.NS")
    assert q["price"] == 6.0 and q["change"] is None and q["change_pct"] is None


def test_parse_quote_errors():
    with pytest.raises(yahoo.UpstreamError):
        yahoo.parse_quote({"chart": {"result": None, "error": {"description": "Not Found"}}}, "ZZZ.NS")
    with pytest.raises(yahoo.UpstreamError):
        yahoo.parse_quote({"chart": {"result": [{"meta": {}, "indicators": {"quote": [{}]}}]}}, "ZZZ.NS")


def test_parse_history_dedupes_timestamps():
    p = {"chart": {"result": [{"meta": {"gmtoffset": 0}, "timestamp": [5, 5, 6], "indicators": {"quote": [{
        "open": [1, 9, 2], "high": [1, 9, 2], "low": [1, 9, 2], "close": [1, 9, 2], "volume": [1, 1, 1]}]}}]}}
    assert [b["c"] for b in yahoo.parse_history(p)["bars"]] == [1, 2]


def test_parse_history_drops_null_rows_dedupes_and_shifts_to_ist():
    h = yahoo.parse_history(CHART)
    ts = [b["t"] for b in h["bars"]]
    assert ts == sorted(set(ts))
    assert ts[0] == 1000 + 19800
    assert len(h["bars"]) == 4  # the all-null row is dropped, never plotted as a zero bar
    assert h["bars"][-1]["v"] == 0  # null volume becomes 0
    for b in h["bars"]:
        assert b["l"] <= min(b["o"], b["c"]) and b["h"] >= max(b["o"], b["c"])


def test_downsample_keeps_ends():
    xs = list(range(200))
    d = yahoo._downsample([float(x) for x in xs], 48)
    assert len(d) == 48 and d[0] == 0 and d[-1] == 199


RSS = """<?xml version="1.0"?><rss><channel>
<item><title>Nifty rallies on banks - Mint</title><link>https://news.example/a</link><pubDate>Thu, 15 Oct 2026 10:00:00 GMT</pubDate><source url="https://mint">Mint</source></item>
<item><title>Sensex falls - ET</title><link>https://news.example/b</link><pubDate>Thu, 15 Oct 2026 12:00:00 GMT</pubDate></item>
<item><title>Nifty rallies on banks - Mint</title><link>https://news.example/dup</link><pubDate>Thu, 15 Oct 2026 09:00:00 GMT</pubDate><source>Mint</source></item>
<item><title>bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>"""


def test_parse_rss():
    items = news.parse_rss(RSS)
    assert [i["title"] for i in items] == ["Sensex falls", "Nifty rallies on banks"]
    assert items[0]["source"] == "ET" and items[1]["source"] == "Mint"
    assert items[0]["ts"] > items[1]["ts"]
    assert all(i["link"].startswith("https://") for i in items)


def test_cache_ttl_stale_and_single_flight():
    c = TTLCache()
    calls = {"n": 0}

    async def ok():
        calls["n"] += 1
        await asyncio.sleep(0.01)
        return "v"

    async def boom():
        raise RuntimeError("down")

    async def run():
        r = await asyncio.gather(*[c.fetch("k", 60, ok) for _ in range(5)])
        assert calls["n"] == 1 and all(x == ("v", False) for x in r)
        v, stale = await c.fetch("k", 0, boom)  # expired, upstream down -> stale value
        assert (v, stale) == ("v", True)
        with pytest.raises(RuntimeError):
            await c.fetch("never", 60, boom)
    asyncio.run(run())


@pytest.fixture()
def client(monkeypatch):
    main.cache = TTLCache()

    async def fake_quote(client, sym):
        if sym == "BAD.NS":
            raise yahoo.UpstreamError("unknown symbol")
        return yahoo.parse_quote(CHART, sym)

    async def fake_hist(client, sym, label):
        if sym == "BAD.NS":
            raise yahoo.UpstreamError("unknown symbol")
        out = yahoo.parse_history(CHART)
        out.update(symbol=universe.display(sym), range=label, interval="1d", intraday=False)
        return out

    async def fake_news(client, q):
        return news.parse_rss(RSS)

    monkeypatch.setattr(yahoo, "fetch_quote", fake_quote)
    monkeypatch.setattr(yahoo, "fetch_history", fake_hist)
    monkeypatch.setattr(news, "fetch", fake_news)
    with TestClient(main.app) as c:
        yield c


def test_health_and_universe(client):
    assert client.get("/health").json() == {"ok": True}
    u = client.get("/universe").json()
    assert len(u["nifty50"]) == 50 and u["indices"][0]["symbol"] == "^NSEI"
    assert "delayed" in u["note"].lower()


def test_quotes_endpoint_reports_missing_and_dedupes(client):
    r = client.get("/quotes", params={"symbols": "tcs,TCS,bad,<x>, ,m&m"}).json()
    assert sorted(q["symbol"] for q in r["quotes"]) == ["M&M", "TCS"]
    assert sorted(r["missing"]) == ["<X>", "BAD"]


def test_quotes_limits(client):
    assert client.get("/quotes", params={"symbols": ",".join(f"S{i}" for i in range(61))}).status_code == 400
    assert client.get("/quotes", params={"symbols": " , "}).status_code == 400


def test_history_endpoint(client):
    r = client.get("/history", params={"symbol": "TCS", "range": "1y"})
    assert r.status_code == 200 and r.json()["range"] == "1Y" and len(r.json()["bars"]) == 4
    assert client.get("/history", params={"symbol": "TCS", "range": "9Y"}).status_code == 400
    assert client.get("/history", params={"symbol": "BAD", "range": "1M"}).status_code == 404
    assert client.get("/history", params={"symbol": "a b", "range": "1M"}).status_code == 400


def test_news_endpoint(client):
    assert client.get("/news").json()["label"] == "MARKETS"
    r = client.get("/news", params={"symbol": "tcs"}).json()
    assert r["label"] == "TCS" and len(r["items"]) == 2
    assert client.get("/news", params={"symbol": "a b"}).status_code == 400


def test_pending_daily_bar_is_flagged_and_filled_from_intraday():
    daily = {"chart": {"result": [{"meta": {"gmtoffset": 0}, "timestamp": [100, 200], "indicators": {"quote": [{
        "open": [1, None], "high": [2, None], "low": [1, None], "close": [2, None], "volume": [5, None]}]}}]}}
    h = yahoo.parse_history(daily)
    assert len(h["bars"]) == 1 and h["pending_t"] == 200
    intra = {"chart": {"result": [{"meta": {}, "timestamp": [1, 2, 3], "indicators": {"quote": [{
        "open": [10, 11, None], "high": [12, 15, None], "low": [9, 10, None], "close": [11, 14, None], "volume": [3, 4, None]}]}}]}}
    b = yahoo.bar_from_intraday(intra, 200)
    assert b == {"t": 200, "o": 10, "h": 15, "l": 9, "c": 14, "v": 7}


def test_search_endpoint(client):
    r = client.get("/search", params={"q": "tata"}).json()
    assert r["results"] and r["results"][0]["symbol"].startswith("TATA")
    assert "hint" in r
    assert client.get("/search", params={"q": ""}).json()["results"] == []
    assert client.get("/search", params={"q": "zzzzzz"}).json()["results"] == []


def test_parse_rss_edge_cases():
    # no pubDate -> ts None, sorts after dated items; missing title -> skipped; whitespace collapsed
    xml = """<?xml version="1.0"?><rss><channel>
    <item><title>No date here - Src</title><link>https://x.example/1</link></item>
    <item><title>Dated   with   spaces - Src</title><link>https://x.example/2</link><pubDate>Thu, 15 Oct 2026 10:00:00 GMT</pubDate></item>
    <item><link>https://x.example/3</link></item>
    </channel></rss>"""
    items = news.parse_rss(xml)
    assert [i["title"] for i in items] == ["Dated with spaces", "No date here"]
    assert items[0]["ts"] is not None and items[1]["ts"] is None


def test_parse_rss_respects_limit():
    xml = '<?xml version="1.0"?><rss><channel>' + "".join(
        f'<item><title>H{i:02d} - S</title><link>https://x.example/{i}</link>'
        f'<pubDate>Thu, 15 Oct 2026 10:00:00 GMT</pubDate></item>'
        for i in range(50)) + "</channel></rss>"
    assert len(news.parse_rss(xml, limit=10)) == 10


def test_cache_evicts_oldest_quarter_at_capacity_and_reuses_locks():
    c = TTLCache(max_items=4)
    for i in range(4):
        c.put(f"k{i}", i)
    c.put("k4", 4)  # over capacity: oldest quarter (4 // 4 = 1 entry) is evicted
    assert "k0" not in c._d
    assert len(c._d) == 4
    assert c.get("k4", 60) == 4
    assert c.lock("a") is c.lock("a")  # same key, same lock: single-flight depends on it


class _Resp:
    def __init__(self, status, payload=None):
        self.status_code = status
        self._payload = payload or {}

    def json(self):
        return self._payload


class _FlakyClient:
    """Scripted stand-in for httpx.AsyncClient: plays back statuses/exceptions in order."""
    def __init__(self, script):
        self.script = list(script)
        self.urls = []

    async def get(self, url, **kwargs):
        self.urls.append(url)
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        return step


def test_get_404_raises_immediately_without_retrying():
    client = _FlakyClient([_Resp(404)])
    with pytest.raises(yahoo.UpstreamError):
        asyncio.run(yahoo._get(client, "ZZZ.NS", "1d", "5m"))
    assert len(client.urls) == 1  # an unknown symbol is not a transient error


def test_get_fails_over_to_second_host_on_500():
    ok = _Resp(200, {"chart": {"result": [{"meta": {}}]}})
    client = _FlakyClient([_Resp(500), ok])
    out = asyncio.run(yahoo._get(client, "TCS.NS", "1d", "5m"))
    assert out == ok.json()
    assert client.urls[0].startswith(yahoo.HOSTS[0]) and client.urls[1].startswith(yahoo.HOSTS[1])


def test_get_raises_upstream_error_after_all_attempts_fail():
    client = _FlakyClient([_Resp(500), _Resp(502), _Resp(503)])
    with pytest.raises(yahoo.UpstreamError):
        asyncio.run(yahoo._get(client, "TCS.NS", "1d", "5m"))
    assert len(client.urls) == 3  # bounded retries, never an infinite loop


def test_get_retries_network_errors_on_the_other_host():
    ok = _Resp(200, {"chart": {"result": []}})
    client = _FlakyClient([OSError("conn reset"), ok])
    out = asyncio.run(yahoo._get(client, "TCS.NS", "1d", "5m"))
    assert out == ok.json() and len(client.urls) == 2


def test_parse_quote_sums_intraday_volume_when_meta_volume_missing():
    p = {"chart": {"result": [{"meta": {"regularMarketPrice": 10.0},
        "indicators": {"quote": [{"close": [9.0, 10.0], "volume": [100, None, 250]}]}}]}}
    assert yahoo.parse_quote(p, "X.NS")["volume"] == 350.0
    p2 = {"chart": {"result": [{"meta": {"regularMarketPrice": 10.0},
        "indicators": {"quote": [{"close": [9.0, 10.0], "volume": [None, None]}]}}]}}
    assert yahoo.parse_quote(p2, "X.NS")["volume"] is None


def test_bar_from_intraday_returns_none_when_every_row_is_null():
    p = {"chart": {"result": [{"meta": {}, "timestamp": [1, 2], "indicators": {"quote": [{
        "open": [None, None], "high": [None, None], "low": [None, None],
        "close": [None, None], "volume": [None, None]}]}}]}}
    assert yahoo.bar_from_intraday(p, 200) is None


def test_quotes_serves_stale_quote_when_upstream_fails(client, monkeypatch):
    fresh = client.get("/quotes", params={"symbols": "TCS"}).json()
    assert "stale" not in fresh["quotes"][0]  # live answers are not flagged
    q = yahoo.parse_quote(CHART, "TCS.NS")
    # Older than QUOTE_TTL (45s) but within the stale window, as after a cold deploy.
    main.cache._d["q:TCS.NS"] = (time.monotonic() - 100, q)

    async def down(_client, sym):
        raise yahoo.UpstreamError("upstream 500")
    monkeypatch.setattr(yahoo, "fetch_quote", down)
    r = client.get("/quotes", params={"symbols": "TCS"}).json()
    assert r["quotes"][0]["symbol"] == "TCS" and r["quotes"][0]["stale"] is True
    assert r["missing"] == []  # a stale quote is still a quote, not a miss


def test_history_serves_stale_bars_when_upstream_fails(client, monkeypatch):
    fresh = client.get("/history", params={"symbol": "TCS", "range": "1Y"}).json()
    assert fresh["stale"] is False
    data = yahoo.parse_history(CHART)
    data.update(symbol="TCS", range="1Y", interval="1d", intraday=False)
    # Older than HIST_TTL_DAILY (1800s), inside the 3600s stale window.
    main.cache._d["h:TCS.NS:1Y"] = (time.monotonic() - 2000, data)

    async def down(_client, sym, label):
        raise yahoo.UpstreamError("upstream 500")
    monkeypatch.setattr(yahoo, "fetch_history", down)
    r = client.get("/history", params={"symbol": "TCS", "range": "1Y"})
    assert r.status_code == 200 and r.json()["stale"] is True
    assert len(r.json()["bars"]) == 4


def test_search_ranks_prefix_hits_first_and_respects_limit():
    hits = universe.search("BAJAJ")
    assert [h["symbol"] for h in hits] == ["BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE"]
    assert universe.search("TCS")[0]["symbol"] == "TCS"  # exact prefix beats any name match
    five = universe.search("A", limit=5)
    assert len(five) == 5 and all(h["symbol"].startswith("A") for h in five)


def test_parse_quote_prev_close_fallback_and_zero_prev():
    p = {"chart": {"result": [{"meta": {"regularMarketPrice": 105.0, "previousClose": 100.0},
        "indicators": {"quote": [{"close": [104.0, 105.0]}]}}]}}
    q = yahoo.parse_quote(p, "X.NS")
    assert q["prev_close"] == 100.0 and q["change"] == 5.0 and q["change_pct"] == 5.0
    zero = {"chart": {"result": [{"meta": {"regularMarketPrice": 105.0, "chartPreviousClose": 0},
        "indicators": {"quote": [{"close": [105.0]}]}}]}}
    q2 = yahoo.parse_quote(zero, "X.NS")
    assert q2["change"] is None and q2["change_pct"] is None  # never divide by a zero prev close


def test_downsample_passes_short_lists_through_untouched():
    xs = [float(i) for i in range(10)]
    assert yahoo._downsample(xs, 48) == xs


def test_quotes_with_only_invalid_symbols_is_200_with_missing(client):
    r = client.get("/quotes", params={"symbols": "<x>,a b"})
    assert r.status_code == 200
    j = r.json()
    assert j["quotes"] == [] and sorted(j["missing"]) == ["<X>", "A B"]


def test_history_unexpected_error_is_502_not_404(client, monkeypatch):
    async def boom(_client, sym, label):
        raise RuntimeError("yahoo changed their payload")
    monkeypatch.setattr(yahoo, "fetch_history", boom)
    r = client.get("/history", params={"symbol": "TCS", "range": "1M"})
    assert r.status_code == 502  # an unknown symbol is 404; a broken upstream is 502
