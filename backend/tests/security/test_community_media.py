exec(open('/tmp/it/_prelude.py').read())
import io
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
res=[]
def rec(n, ok, x=""): res.append(ok); print(("PASS" if ok else "FAIL"), n, x)
def png():
    b=io.BytesIO(); Image.new("RGB",(10,10),(3,3,3)).save(b,"PNG"); return b.getvalue()
H={"Origin":"https://app.elcoral.com"}
def mk(c,n):
    r=c.post("/api/auth/signup", json={"email":f"{n}@example.com","password":"Sup3rSecret!pw","full_name":n.title()+" Y","username":n,"account_type":"individual"}, headers=H)
    return r.json()["access_token"], r.json()["user"]["id"]
ca=TestClient(fastapi_app, base_url="https://testserver"); cb=TestClient(fastapi_app, base_url="https://testserver"); cc=TestClient(fastapi_app, base_url="https://testserver")
ta,_=mk(ca,"ann"); tb,_=mk(cb,"ben"); tc,_=mk(cc,"cid")
A={"Authorization":f"Bearer {ta}"};B={"Authorization":f"Bearer {tb}"};C={"Authorization":f"Bearer {tc}"}
com=ca.post("/api/communities", json={"name":"Private Lab","description":"d","topic":"other","is_private":False}, headers={**A,**H})
rec("create private community", com.status_code==201, com.text[:200])
slug=com.json()["slug"]
j=cb.post(f"/api/communities/{slug}/join", headers={**B,**H}); rec("ben joins", j.status_code in (200,201), j.text[:150])
ref=ca.post("/api/media/upload", files={"file":("c.png",png(),"image/png")}, headers=A).json()["ref"]
m=ca.post(f"/api/communities/{slug}/messages", json={"body":"secret","media_refs":[ref]}, headers={**A,**H})
rec("post community chat media", m.status_code==201, m.text[:200])
au=(m.json().get("media_urls") or [None])[0]
lst=cb.get(f"/api/communities/{slug}/messages", headers=B)
bu=(lst.json()["items"][0].get("media_urls") or [None])[0] if lst.status_code==200 else None
rec("member sees own-bound url", bool(bu) and "aud=" in bu, str(bu)[:120])
p=lambda u: u[u.index("/api/media"):]
rec("author opens own url", ca.get(p(au), headers=A).status_code==200)
rec("member opens own url", cb.get(p(bu), headers=B).status_code==200)
rec("member cannot reuse author url", cb.get(p(au), headers=B).status_code==403)
rec("non-member cannot reuse url", cc.get(p(au), headers=C).status_code==403)
rec("non-member cannot list messages", cc.get(f"/api/communities/{slug}/messages", headers=C).status_code in (403,404))
rec("anonymous cannot open community media", TestClient(fastapi_app, base_url="https://testserver").get(p(au)).status_code==401)
print("\n%d/%d passed" % (sum(res), len(res)))
