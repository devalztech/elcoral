"""
Proxies third-party lookup APIs used by onboarding's typeahead fields, so
the frontend never calls external services directly. Keeping this on the
backend means: no CORS issues, one place to add caching/rate-limiting
later, and the provider can be swapped without any frontend change.

  - /api/lookup/companies -> Clearbit Autocomplete (name, domain, logo)
  - /api/lookup/countries -> countries.dev (name, alpha2Code, flag)
  - /api/lookup/cities    -> countries.dev (name, countryCode, geonameId)

All are free, keyless, third-party services — wrapped in a short timeout
and a broad except so a slow/down provider degrades to an empty result
list instead of breaking the onboarding form.
"""

import httpx
from fastapi import APIRouter, Query

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
    Full country list for a real dropdown (as opposed to /countries above,
    which is search-as-you-type). Countries don't change often enough to
    justify re-fetching per keystroke — the frontend fetches this once and
    renders it as a scrollable list.
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get("https://countries.dev/all", params={"fields": "name,alpha2Code,flag"})
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    countries = [
        {"name": c.get("name"), "code": c.get("alpha2Code"), "flag": c.get("flag")}
        for c in data
        if c.get("alpha2Code") and c.get("name")
    ]
    return sorted(countries, key=lambda c: c["name"])


@router.get("/countries")
async def search_countries(q: str = Query(min_length=1, max_length=100)):
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"https://countries.dev/name/{q}", params={"fields": "name,alpha2Code,flag"})
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    if isinstance(data, dict):
        data = [data]

    return [
        {"name": c.get("name"), "code": c.get("alpha2Code"), "flag": c.get("flag")}
        for c in data
        if c.get("alpha2Code")
    ][:10]


@router.get("/cities")
async def search_cities(
    q: str = Query(min_length=1, max_length=100),
    country: str = Query(min_length=2, max_length=2),
):
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

    return [
        {"name": c.get("name"), "countryCode": c.get("countryCode"), "geonameId": c.get("geonameId")}
        for c in data
        if c.get("name")
    ]
