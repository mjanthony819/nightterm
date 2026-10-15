"""Google News RSS for India, parsed server-side. No key needed."""
import re
import xml.etree.ElementTree as ET
from datetime import timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus, urlparse

import httpx

DEFAULT_Q = 'Nifty OR Sensex OR "Indian stock market" when:2d'
URL = "https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en"
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36"}


def parse_rss(xml_text: str, limit: int = 40) -> list[dict]:
    root = ET.fromstring(xml_text)
    items = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        if not title or urlparse(link).scheme not in ("http", "https"):
            continue
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None and src_el.text else ""
        if source and title.endswith(" - " + source):
            title = title[: -len(source) - 3].rstrip()
        elif not source and " - " in title:
            title, _, source = title.rpartition(" - ")
        ts = None
        try:
            d = parsedate_to_datetime(it.findtext("pubDate") or "")
            ts = int((d if d.tzinfo else d.replace(tzinfo=timezone.utc)).timestamp())
        except Exception:
            pass
        items.append({"title": re.sub(r"\s+", " ", title), "link": link, "source": source, "ts": ts})
    items.sort(key=lambda x: x["ts"] or 0, reverse=True)
    seen, out = set(), []
    for x in items:  # same headline from several mirrors
        k = x["title"].lower()[:80]
        if k not in seen:
            seen.add(k)
            out.append(x)
    return out[:limit]


def symbol_query(name: str) -> str:
    return f'"{name}" stock when:7d'


async def fetch(client: httpx.AsyncClient, q: str) -> list[dict]:
    r = await client.get(URL.format(q=quote_plus(q)), headers=HEADERS)
    r.raise_for_status()
    return parse_rss(r.text)
