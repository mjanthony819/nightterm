"""The default universe: NIFTY 50 snapshot plus the index tickers shown in the top strip.
Index membership changes at rebalances, so this is a snapshot, not a feed."""
import re
from urllib.parse import quote

NIFTY50 = {
    "RELIANCE": "Reliance Industries", "TCS": "Tata Consultancy Services", "HDFCBANK": "HDFC Bank",
    "INFY": "Infosys", "ICICIBANK": "ICICI Bank", "HINDUNILVR": "Hindustan Unilever", "ITC": "ITC",
    "SBIN": "State Bank of India", "BHARTIARTL": "Bharti Airtel", "KOTAKBANK": "Kotak Mahindra Bank",
    "LT": "Larsen & Toubro", "AXISBANK": "Axis Bank", "ASIANPAINT": "Asian Paints", "MARUTI": "Maruti Suzuki",
    "SUNPHARMA": "Sun Pharma", "TITAN": "Titan", "BAJFINANCE": "Bajaj Finance", "NESTLEIND": "Nestle India",
    "ULTRACEMCO": "UltraTech Cement", "WIPRO": "Wipro", "HCLTECH": "HCL Technologies", "NTPC": "NTPC",
    "POWERGRID": "Power Grid", "ONGC": "ONGC", "TATASTEEL": "Tata Steel", "M&M": "Mahindra & Mahindra",
    "TECHM": "Tech Mahindra", "JSWSTEEL": "JSW Steel", "ADANIPORTS": "Adani Ports", "COALINDIA": "Coal India",
    "BAJAJFINSV": "Bajaj Finserv", "DRREDDY": "Dr Reddy's", "CIPLA": "Cipla", "EICHERMOT": "Eicher Motors",
    "GRASIM": "Grasim", "HEROMOTOCO": "Hero MotoCorp", "DIVISLAB": "Divi's Labs", "HINDALCO": "Hindalco",
    "INDUSINDBK": "IndusInd Bank", "APOLLOHOSP": "Apollo Hospitals", "TATACONSUM": "Tata Consumer",
    "SBILIFE": "SBI Life", "HDFCLIFE": "HDFC Life", "BAJAJ-AUTO": "Bajaj Auto", "ADANIENT": "Adani Enterprises",
    "BEL": "Bharat Electronics", "TRENT": "Trent", "SHRIRAMFIN": "Shriram Finance", "JIOFIN": "Jio Financial",
    "ETERNAL": "Eternal (Zomato)",
}

INDICES = {"^NSEI": "NIFTY 50", "^NSEBANK": "BANK NIFTY", "^BSESN": "SENSEX", "^INDIAVIX": "INDIA VIX"}

_SYM = re.compile(r"^[A-Z0-9&.^\-]{1,24}$")


def normalize(sym: str) -> str | None:
    """User input -> Yahoo symbol, or None if it looks invalid. Bare names get .NS."""
    s = (sym or "").strip().upper()
    if not _SYM.match(s):
        return None
    if s.startswith("^") or s.endswith(".NS") or s.endswith(".BO"):
        return s
    return s + ".NS"


def display(yahoo_sym: str) -> str:
    return yahoo_sym[:-3] if yahoo_sym.endswith(".NS") else yahoo_sym


def url_part(yahoo_sym: str) -> str:
    return quote(yahoo_sym, safe="")


def search(q: str, limit: int = 12) -> list[dict]:
    t = (q or "").strip().upper()
    if not t:
        return []
    hits = [{"symbol": s, "name": n} for s, n in NIFTY50.items() if t in s.upper() or t in n.upper()]
    hits.sort(key=lambda h: (not h["symbol"].startswith(t), h["symbol"]))
    return hits[:limit]
