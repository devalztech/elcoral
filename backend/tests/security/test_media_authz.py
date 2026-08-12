exec(open('/tmp/it/_prelude.py').read())
import io, json
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app as fastapi_app

async def _fresh():
    from sqlalchemy.ext.asyncio import create_async_engine
    e = create_async_engine(os.environ["DATABASE_URL"])
    async with e.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all); await conn.run_sync(Base.metadata.create_all)
    await e.dispose()
asyncio.run(_fresh())

results=[]
def rec(n, ok, extra=""):
    results.append(ok); print(("PASS" if ok else "FAIL"), n, extra)

def png():
    b=io.BytesIO(); Image.new("RGB",(12,12),(7,7,7)).save(b,"PNG"); return b.getvalue()

H={"Origin":"https://app.elcoral.com"}
def mkuser(c, name):
    r=c.post("/api/auth/signup", json={"email":f"{name}@example.com","password":"Sup3rSecret!pw","full_name":name.title()+" X","username":name,"account_type":"individual"}, headers=H)
    assert r.status_code==201, r.text
    return r.json()["access_token"], r.json()["user"]["id"]

ca=TestClient(fastapi_app, base_url="https://testserver")
cb=TestClient(fastapi_app, base_url="https://testserver")
cc=TestClient(fastapi_app, base_url="https://testserver")
ta,ua=mkuser(ca,"alice"); tb,ub=mkuser(cb,"bob"); tc,uc=mkuser(cc,"carol")
A={"Authorization":f"Bearer {ta}"}; B={"Authorization":f"Bearer {tb}"}; C={"Authorization":f"Bearer {tc}"}

up=ca.post("/api/media/upload", files={"file":("p.png",png(),"image/png")}, headers=A)
ref=up.json()["ref"]; rec("alice uploads image", up.status_code==200, ref)

# --- DM with attachment
conv=ca.post("/api/messages/conversations", json={"username":"bob"}, headers={**A,**H})
rec("create conversation", conv.status_code in (200,201), conv.text[:200])
cid=conv.json()["id"] if conv.status_code in (200,201) else None
msg=ca.post(f"/api/messages/conversations/{cid}", json={"body":"look","media_refs":[ref]}, headers={**A,**H})
rec("send DM with media", msg.status_code in (200,201), msg.text[:250])
sender_url=(msg.json().get("media_urls") or [None])[0]
rec("sender gets a media url", bool(sender_url), str(sender_url)[:120])

def get_as(client, url, hdrs):
    return client.get(url[url.index("/api/media"):], headers=hdrs)

# recipient list
lst=cb.get(f"/api/messages/conversations/{cid}", headers=B)
recip_url=(lst.json()["items"][0].get("media_urls") or [None])[0] if lst.status_code==200 else None
rec("recipient sees message", lst.status_code==200 and bool(recip_url), str(recip_url)[:130])

rec("sender opens own media", get_as(ca, sender_url, A).status_code==200)
rec("recipient opens their url", get_as(cb, recip_url, B).status_code==200)
rec("recipient CANNOT reuse sender's url", get_as(cb, sender_url, B).status_code==403)
rec("outsider CANNOT reuse sender's url", get_as(cc, sender_url, C).status_code==403)
rec("outsider CANNOT reuse recipient's url", get_as(cc, recip_url, C).status_code==403)
rec("anonymous CANNOT open dm media", TestClient(fastapi_app, base_url="https://testserver").get(sender_url[sender_url.index("/api/media"):]).status_code==401)
rec("outsider cannot read conversation", cc.get(f"/api/messages/conversations/{cid}", headers=C).status_code in (403,404))

# --- public post media stays public
up2=ca.post("/api/media/upload", files={"file":("q.png",png(),"image/png")}, headers=A)
ref2=up2.json()["ref"]
post=ca.post("/api/posts", json={"kind":"media","body":"hello world","media_refs":[ref2],"media_types":["image/png"]}, headers={**A,**H})
rec("create post with media", post.status_code in (200,201), post.text[:200])
purl=(post.json().get("media_urls") or [None])[0]
anon=TestClient(fastapi_app, base_url="https://testserver")
rec("post media is publicly fetchable", bool(purl) and anon.get(purl[purl.index("/api/media"):]).status_code==200, str(purl)[:130])
rec("post media url carries no aud", bool(purl) and "aud=" not in purl)

# --- Telegram/storage ref is not a credential on its own: the sender's
# real (local-fallback) ref, unsigned, must be refused exactly like any
# other ref, whether the requester is the sender, the recipient, or a
# stranger. The ref itself carries no authority — only a valid signature
# does.
rec("sender's own real ref, unsigned -> 403", ca.get(f"/api/media/{ref}", headers=A).status_code==403)
rec("recipient's real ref, unsigned -> 403", cb.get(f"/api/media/{ref}", headers=B).status_code==403)
rec("outsider's real ref, unsigned -> 403", cc.get(f"/api/media/{ref}", headers=C).status_code==403)

# --- expired / tampered signatures on a REAL private URL (not the
# synthetic ref="42" used in test_security.py) — end-to-end with actual
# uploaded, attached, DM media.
import time
from app.core.media_url import _sign, sign_media_ref, PRIVATE_MEDIA_URL_TTL_SECONDS
exp_past = int(time.time()) - (PRIVATE_MEDIA_URL_TTL_SECONDS + 60)
expired_url = f"/api/media/{ref}?exp={exp_past}&sig={_sign(ref, exp_past, str(ub))}&aud={ub}"
rec("expired private URL for real DM media -> 403", cb.get(expired_url, headers=B).status_code==403)
tampered_exp, tampered_sig = sign_media_ref(ref, audience=str(ub))
tampered_url = f"/api/media/{ref}?exp={tampered_exp}&sig={tampered_sig[:-4]+'AAAA'}&aud={ub}"
rec("tampered signature on real DM media -> 403", cb.get(tampered_url, headers=B).status_code==403)

print("\n%d/%d passed" % (sum(results), len(results)))
