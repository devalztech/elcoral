import sys, io, zlib, struct
sys.path.insert(0,'/tmp/elcoral/backend')
sys.modules.setdefault('app', __import__('app'))
from app.core.file_validation import validate_upload, FileValidationError
from PIL import Image

def png(w=8,h=8):
    b=io.BytesIO(); Image.new("RGB",(w,h),(1,2,3)).save(b,"PNG"); return b.getvalue()
def jpg():
    b=io.BytesIO(); Image.new("RGB",(8,8)).save(b,"JPEG"); return b.getvalue()

cases=[]
def check(name, fn, expect_ok):
    try:
        r=fn(); ok=True; msg=r
    except FileValidationError as e:
        ok=False; msg=str(e)
    status = "PASS" if ok==expect_ok else "FAIL"
    print(f"{status:4} {name}: {'accepted '+str(msg) if ok else 'rejected: '+msg}")

check("real png as image/png", lambda: validate_upload(png(),"image/png","a.png"), True)
check("real jpeg as image/jpeg", lambda: validate_upload(jpg(),"image/jpeg","a.jpg"), True)
check("jpeg claimed as image/png", lambda: validate_upload(jpg(),"image/png","a.png"), False)
check("php script claimed as image/png", lambda: validate_upload(b"<?php system($_GET[0]); ?>"*10,"image/png","x.png"), False)
check("png header + garbage", lambda: validate_upload(b"\x89PNG\r\n\x1a\n"+b"\x00"*500,"image/png","x.png"), False)
check("html claimed text/plain", lambda: validate_upload(b"<html><script>alert(1)</script></html>","text/plain","a.txt"), False)
check("plain utf8 text", lambda: validate_upload("hello, world\nsecond line".encode(),"text/plain","a.txt"), True)
check("pdf real", lambda: validate_upload(b"%PDF-1.4\n%stuff\n"+b"0"*100,"application/pdf","a.pdf"), True)
check("zip claimed as pdf", lambda: validate_upload(b"PK\x03\x04"+b"0"*100,"application/pdf","a.pdf"), False)
check("docx (zip) as ooxml", lambda: validate_upload(b"PK\x03\x04"+b"0"*100,"application/vnd.openxmlformats-officedocument.wordprocessingml.document","a.docx"), True)
check("mp4 ftyp isom", lambda: validate_upload(b"\x00\x00\x00\x18ftypisom"+b"0"*100,"video/mp4","a.mp4"), True)
check("mp4 claimed as image/heic", lambda: validate_upload(b"\x00\x00\x00\x18ftypisom"+b"0"*100,"image/heic","a.heic"), False)
check("heic brand as image/heic", lambda: validate_upload(b"\x00\x00\x00\x18ftypheic"+b"0"*100,"image/heic","a.heic"), True)
check("webm as video/webm", lambda: validate_upload(b"\x1a\x45\xdf\xa3"+b"0"*100,"video/webm","a.webm"), True)
check("webp", lambda: validate_upload(b"RIFF\x00\x00\x00\x00WEBPVP8 "+b"0"*100,"image/webp","a.webp"), False)
check("oversize image 30MB", lambda: validate_upload(png()+b"\x00"*(30*1024*1024),"image/png","a.png"), False)
check("empty", lambda: validate_upload(b"","image/png","a.png"), False)
