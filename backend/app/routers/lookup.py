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

import httpx
from fastapi import APIRouter, Query

from app.core import countries as country_data

router = APIRouter(prefix="/api/lookup", tags=["lookup"])

_TIMEOUT = httpx.Timeout(5.0)


@router.get("/companies")
async def search_companies(q: str = Query(min_length=2, max_length=100)):
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                "https://autocomplete.clearbit.com/v1/companies/suggest", params={"query": q}
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    return [
        {"name": item.get("name"), "domain": item.get("domain"), "logo": item.get("logo")}
        for item in data
        if item.get("name")
    ]


@router.get("/countries/all")
async def list_all_countries():
    """
    Full country list for the onboarding dropdown. Served locally, so it
    is never empty and never slow — countries change far too rarely to
    justify a network dependency on a blocking form field.
    """
    return country_data.COUNTRIES


@router.get("/countries")
async def search_countries(q: str = Query(min_length=1, max_length=100)):
    """Search-as-you-type over the same local list."""
    return country_data.search_countries(q)


@router.get("/cities")
async def search_cities(
    q: str = Query(min_length=1, max_length=100),
    country: str = Query(min_length=2, max_length=2),
):
    """
    City typeahead. A full city list is far too large to ship or render,
    so this stays a remote search. If the provider is slow or down the
    result is an empty list — the city field is optional, so onboarding
    still completes.
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                "https://countries.dev/cities", params={"q": q, "country": country.upper(), "limit": 10}
            )
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    if isinstance(data, dict):
        data = [data]

    return [
        {"name": c.get("name"), "countryCode": c.get("countryCode"), "geonameId": c.get("geonameId")}
        for c in data
        if c.get("name")
    ]
