"""
Lookup endpoints backing onboarding's location/company fields, so the
frontend never calls external services directly (no CORS issues, one
place for caching/rate-limiting, providers swappable without a frontend
change).

  - /api/lookup/countries/all -> full country list (local, always available)
  - /api/lookup/countries     -> country search-as-you-type (local)
  - /api/lookup/cities        -> countries.dev city search (remote + graceful degrade)
  - /api/lookup/companies     -> Clearbit Autocomplete (remote + graceful degrade)

Countries are served from a vendored ISO 3166-1 list (see
app/core/countries.py) rather than a third-party call. The previous
implementation hit `https://countries.dev/all`, which does not exist —
it answered with an HTML 404 page, the broad `except` swallowed it, and
the endpoint returned `[]` forever. That left the onboarding country
dropdown permanently empty, and since the location step can't be
advanced without a country, the wizard could never be finished.
"""

import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core import countries as country_data
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.models.user import User

router = APIRouter(prefix="/api/lookup", tags=["lookup"])

_TIMEOUT = httpx.Timeout(5.0)
# Upstream calls are made with an explicitly-built params dict and a hard
# response ceiling so neither the URL nor the response size is under
# caller control.
_MAX_UPSTREAM_BYTES = 256 * 1024
_MAX_RESULTS = 10

# Typeahead input only: letters, digits, spaces and the punctuation that
# actually occurs in company/city names. Everything else (control chars,
# quotes, angle brackets, slashes, %, &, newlines) is rejected outright
# rather than escaped, so nothing exotic can ever be forwarded upstream.
_QUERY_PATTERN = re.compile(r"^[\w .,'\-&()]+$", re.UNICODE)


def _clean_query(raw: str) -> str:
    """Normalise and constrain a typeahead term before it leaves this server."""
    value = " ".join(raw.split())  # collapse whitespace, strip newlines/tabs
    if not value or len(value) > 64:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Search term must be 1-64 characters",
        )
    if not _QUERY_PATTERN.match(value):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Search term contains unsupported characters",
        )
    return value


async def _fetch_json(client: httpx.AsyncClient, url: str, params: dict):
    """GET with redirects disabled and a response-size ceiling."""
    resp = await client.get(url, params=params, follow_redirects=False)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    if len(resp.content) > _MAX_UPSTREAM_BYTES:
        return None
    return resp.json()


# ---------------------------------------------------------------------------
# Remote-backed lookups
# ---------------------------------------------------------------------------
#
# These two are the only endpoints that forward anything to a third party,
# which makes them the only ones that could be turned into an open proxy.
# Three things stop that:
#   1. Authentication — a valid member access token is required, so an
#      anonymous script cannot use us to hammer (or be billed for) Clearbit
#      and countries.dev. These fields only ever appear inside the
#      onboarding/profile editor, which is already behind a login.
#   2. Rate limiting — per IP, on top of the global limiter.
#   3. Input constraint — the term is normalised, length-capped and
#      character-allow-listed, the country must be a real ISO 3166-1 code,
#      the upstream URL is a fixed constant, redirects are not followed and
#      the response size is capped. Nothing the caller sends can change
#      *which* host is contacted.
@router.get("/companies")
@limiter.limit("30/minute")
async def search_companies(
    request: Request,
    q: str = Query(min_length=2, max_length=100),
    user: User = Depends(get_current_user),
):
    query = _clean_query(q)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            data = await _fetch_json(
                client,
                "https://autocomplete.clearbit.com/v1/companies/suggest",
                {"query": query},
            )
    except Exception:
        return []

    if not isinstance(data, list):
        return []

    return [
        {"name": item.get("name"), "domain": item.get("domain"), "logo": item.get("logo")}
        for item in data
        if isinstance(item, dict) and item.get("name")
    ][:_MAX_RESULTS]


@router.get("/countries/all")
async def list_all_countries():
    """
    Full country list for the onboarding dropdown. Served locally, so it
    is never empty and never slow — countries change far too rarely to
    justify a network dependency on a blocking form field.
    """
    return country_data.COUNTRIES


@router.get("/countries")
@limiter.limit("120/minute")
async def search_countries(request: Request, q: str = Query(min_length=1, max_length=100)):
    """Search-as-you-type over the same local list (no third party involved)."""
    return country_data.search_countries(_clean_query(q))


@router.get("/cities")
@limiter.limit("30/minute")
async def search_cities(
    request: Request,
    q: str = Query(min_length=1, max_length=100),
    country: str = Query(min_length=2, max_length=2),
    user: User = Depends(get_current_user),
):
    """
    City typeahead. A full city list is far too large to ship or render,
    so this stays a remote search. If the provider is slow or down the
    result is an empty list — the city field is optional, so onboarding
    still completes.
    """
    query = _clean_query(q)
    code = country.strip().upper()
    if not code.isalpha() or country_data.get_country(code) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unknown country code",
        )

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            data = await _fetch_json(
                client,
                "https://countries.dev/cities",
                {"q": query, "country": code, "limit": _MAX_RESULTS},
            )
    except Exception:
        return []

    if data is None:
        return []
    if isinstance(data, dict):
        data = [data]

    return [
        {"name": c.get("name"), "countryCode": c.get("countryCode"), "geonameId": c.get("geonameId")}
        for c in data
        if isinstance(c, dict) and c.get("name")
    ][:_MAX_RESULTS]
