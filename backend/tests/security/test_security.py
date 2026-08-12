import os, sys, io, asyncio
os.environ["DATABASE_URL"]="postgresql+asyncpg://postgres@127.0.0.1:5433/elcoral_test"
os.environ["JWT_SECRET_KEY"]="test-secret-key-for-regression-suite"
os.environ["CORS_ORIGINS"]="https://app.elcoral.com"
os.environ["ENVIRONMENT"]="development"
sys.path.insert(0,'/tmp/elcoral/backend')

from fastapi.testclient import TestClient
import app.models.user, app.models.profile, app.models.post, app.models.social
import app.models.settings, app.models.message, app.models.community, app.models.admin, app.models.notification
from app.core.database import engine, Base
import app.core.database as dbmod
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

# TestClient spins a fresh event loop per request unless used as a context
# manager; NullPool keeps asyncpg connections from being reused across loops.
_engine = create_async_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
dbmod.engine = _engine
dbmod.AsyncSessionLocal.configure(bind=_engine)
from app.main import app as fastapi_app

async def _create():
    from sqlalchemy.ext.asyncio import create_async_engine
    ddl = create_async_engine(os.environ["DATABASE_URL"])
    async with ddl.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await ddl.dispose()
asyncio.run(_create())

results=[]
def rec(name, ok, extra=""):
    results.append((name, ok, extra))
    print(("PASS" if ok else "FAIL"), name, extra)

c = TestClient(fastapi_app, base_url="https://testserver")
H={"Origin":"https://app.elcoral.com"}

# --- signup / auth
r=c.post("/api/auth/signup", json={"email":"a@example.com","password":"Sup3rSecret!pw","full_name":"A A","username":"alpha","account_type":"individual"}, headers=H)
rec("signup 201", r.status_code==201, r.text[:200])
tok=r.json()["access_token"]
rec("csrf cookie issued", "csrf_token" in c.cookies, str(dict(c.cookies)))
rec("media_session cookie issued", "media_session" in c.cookies, "")

r2=c.post("/api/auth/signup", json={"email":"b@example.com","password":"Sup3rSecret!pw","full_name":"B B","username":"beta","account_type":"individual"}, headers=H)
tok_b=r2.json()["access_token"]
csrf_b=c.cookies.get("csrf_token")

# --- CSRF on refresh
r=c.post("/api/auth/refresh", headers=H)  # no header, cookie present
rec("refresh without CSRF header -> 403", r.status_code==403, str(r.status_code))
r=c.post("/api/auth/refresh", headers={**H,"X-CSRF-Token":"wrong"})
rec("refresh with wrong CSRF -> 403", r.status_code==403, str(r.status_code))
r=c.post("/api/auth/refresh", headers={**H,"X-CSRF-Token":c.cookies.get("csrf_token")})
rec("refresh with correct CSRF -> 200", r.status_code==200, r.text[:120])
r=c.post("/api/auth/refresh", headers={"Origin":"https://evil.example","X-CSRF-Token":c.cookies.get("csrf_token")})
rec("refresh from evil origin -> 403", r.status_code==403, str(r.status_code))
r=c.post("/api/auth/logout", headers=H)
rec("logout without CSRF header -> 403", r.status_code==403, str(r.status_code))

# --- lookup auth + validation
r=c.get("/api/lookup/companies?q=acme")
rec("companies anonymous -> 401", r.status_code==401, str(r.status_code))
r=c.get("/api/lookup/cities?q=lag&country=NG")
rec("cities anonymous -> 401", r.status_code==401, str(r.status_code))
A={"Authorization":f"Bearer {tok_b}"}
r=c.get("/api/lookup/cities?q=lag&country=ZZ", headers=A)
rec("cities bad country -> 422", r.status_code==422, str(r.status_code))
r=c.get("/api/lookup/companies?q=%3Cscript%3Ex", headers=A)
rec("companies hostile chars -> 422", r.status_code==422, str(r.status_code))
r=c.get("/api/lookup/companies?q=" + "a"*90, headers=A)
rec("companies overlong term -> 422", r.status_code==422, str(r.status_code))
r=c.get("/api/lookup/countries/all")
rec("countries/all still public", r.status_code==200 and len(r.json())>200, str(r.status_code))

# --- media signature / audience
from app.core.media_url import media_ref_to_url, sign_media_ref
import app.core.config as cfg
pub = media_ref_to_url("42")
priv_b = media_ref_to_url("42", viewer_id=str(r2.json()["user"]["id"]))
def path(u): return u[u.index("/api/media"):]
r=c.get("/api/media/42")
rec("media without signature -> 403", r.status_code==403, str(r.status_code))
r=c.get("/api/media/42?exp=99999999999&sig=deadbeef")
rec("media forged signature -> 403", r.status_code==403, str(r.status_code))
exp,sig = sign_media_ref("42", audience="")
r=c.get(f"/api/media/42?exp={exp}&sig={sig}")
rec("public signed media passes auth gate (404/502 from storage ok)", r.status_code in (404,502), str(r.status_code))
# private link replayed by wrong user
uid_a = None
me=c.get("/api/auth/me", headers={"Authorization":f"Bearer {tok}"})
uid_a = me.json()["id"]; uid_b = r2.json()["user"]["id"]
exp,sig = sign_media_ref("42", audience=str(uid_a))
c.cookies.clear()
r=c.get(f"/api/media/42?exp={exp}&sig={sig}&aud={uid_a}")
rec("viewer-bound media anonymous -> 401", r.status_code==401, str(r.status_code))
r=c.get(f"/api/media/42?exp={exp}&sig={sig}&aud={uid_b}", headers={"Authorization":f"Bearer {tok_b}"})
rec("audience tampering -> 403 (sig mismatch)", r.status_code==403, str(r.status_code))
r=c.get(f"/api/media/42?exp={exp}&sig={sig}&aud={uid_a}", headers={"Authorization":f"Bearer {tok_b}"})
rec("other user replays private link -> 403", r.status_code==403, str(r.status_code))
r=c.get(f"/api/media/42?exp={exp}&sig={sig}&aud={uid_a}", headers={"Authorization":f"Bearer {tok}"})
rec("owner opens private link (reaches storage)", r.status_code in (404,502), str(r.status_code))
# expired
import time
from app.core.media_url import _sign
past=int(time.time())-100000
r=c.get(f"/api/media/42?exp={past}&sig={_sign('42',past,'')}")
rec("expired signature -> 403", r.status_code==403, str(r.status_code))

# --- private media TTL (15 min) vs public media TTL (7 days)
from app.core.media_url import PRIVATE_MEDIA_URL_TTL_SECONDS, PUBLIC_MEDIA_URL_TTL_SECONDS
rec("private TTL is 15 minutes", PRIVATE_MEDIA_URL_TTL_SECONDS==15*60, str(PRIVATE_MEDIA_URL_TTL_SECONDS))
rec("public TTL is unchanged at 7 days", PUBLIC_MEDIA_URL_TTL_SECONDS==7*24*60*60, str(PUBLIC_MEDIA_URL_TTL_SECONDS))
# a freshly minted private URL actually carries the short TTL, not the long one
priv_exp,priv_sig = sign_media_ref("42", audience=str(uid_a))
rec("private sign_media_ref uses short TTL", abs(priv_exp - (int(time.time())+PRIVATE_MEDIA_URL_TTL_SECONDS)) < 5, str(priv_exp))
pub_exp,pub_sig = sign_media_ref("42", audience="")
rec("public sign_media_ref uses long TTL", abs(pub_exp - (int(time.time())+PUBLIC_MEDIA_URL_TTL_SECONDS)) < 5, str(pub_exp))
# a private link signed 16 minutes ago (past its 15-min TTL) is rejected...
just_past = int(time.time()) - (16*60)
r=c.get(f"/api/media/42?exp={just_past}&sig={_sign('42',just_past,str(uid_a))}&aud={uid_a}", headers={"Authorization":f"Bearer {tok}"})
rec("private link past 15min TTL -> 403", r.status_code==403, str(r.status_code))
# ...while a public link at the same age is still valid (7-day TTL, so
# "signed 16 minutes ago" is nowhere near expiry) — proves the two TTLs
# are genuinely independent, not one shared clock.
r=c.get(f"/api/media/42?exp={just_past+PUBLIC_MEDIA_URL_TTL_SECONDS}&sig={_sign('42', just_past+PUBLIC_MEDIA_URL_TTL_SECONDS, '')}")
rec("public link at same age still valid (404/502 from storage ok)", r.status_code in (404,502), str(r.status_code))

# --- upload
r=c.post("/api/media/upload", files={"file":("x.png", b"<?php echo 1; ?>", "image/png")}, headers={"Authorization":f"Bearer {tok}"})
rec("spoofed png upload -> 415", r.status_code==415, r.text[:120])
r=c.post("/api/media/upload", files={"file":("x.exe", b"MZ\x90\x00", "application/x-msdownload")}, headers={"Authorization":f"Bearer {tok}"})
rec("disallowed type -> 415", r.status_code==415, str(r.status_code))
r=c.post("/api/media/upload", files={"file":("x.png", b"\x89PNG\r\n\x1a\n0000", "image/png")})
rec("upload anonymous -> 401/403", r.status_code in (401,403), str(r.status_code))
from PIL import Image
b=io.BytesIO(); Image.new("RGB",(8,8)).save(b,"PNG")
r=c.post("/api/media/upload", files={"file":("x.png", b.getvalue(), "image/png")}, headers={"Authorization":f"Bearer {tok}"})
# Telegram is unconfigured in this suite, so storage falls back to local
# disk (app/core/telegram_storage.py) — a valid image is correctly
# ACCEPTED (200) and given a ref, not rejected. A previous version of
# this test asserted 502 here, which was only ever true before the local
# fallback existed; asserting 502 now would mean "punish a correct
# accept" rather than test anything security-relevant.
rec("valid png accepted, stored via local fallback -> 200", r.status_code==200, r.text[:150])
rec("valid png upload returns a usable ref", r.status_code==200 and bool(r.json().get("ref")), r.text[:150])

print("\n%d/%d passed" % (sum(1 for _,ok,_ in results if ok), len(results)))
