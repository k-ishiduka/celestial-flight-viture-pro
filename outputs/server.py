from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote
from urllib.request import Request, urlopen
import json, threading, time, subprocess, os, atexit, hashlib, math
from voice_runtime import voice_environment
voice_process=None
voice_start_lock=threading.Lock()
def stop_voice():
 if voice_process and voice_process.poll() is None:voice_process.terminate()
atexit.register(stop_voice)
def start_voice():
 global voice_process
 root=Path(__file__).resolve().parent
 if voice_process and voice_process.poll() is None:return
 try:
  with urlopen('http://127.0.0.1:8766/',timeout=.3):return
 except Exception:pass
 runtime,env=voice_environment()
 with open(root.parent/'work'/'voice-worker.log','a') as log:
  voice_process=subprocess.Popen([runtime,str(root/'voice-worker.py')],env=env,stdout=log,stderr=log)
lock=threading.Lock()
cache={}
last=0
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(Path(__file__).parent),**kwargs)
 def do_POST(self):
  if urlparse(self.path).path!='/api/speech':return self.send_error(404)
  origin=self.headers.get('Origin','')
  if origin and origin not in ['http://localhost:8765','http://127.0.0.1:8765']:return self.send_error(403)
  try:
   size=int(self.headers.get('Content-Length','0'))
   if size<1 or size>10000:return self.send_error(413)
   body=self.rfile.read(size)
   item=json.loads(body);text=str(item['text'])[:1800];voice=item.get('voice','jf_alpha');speed=float(item.get('speed',.95))
   if voice not in ['jf_alpha','jm_kumo'] or not math.isfinite(speed) or not text.strip():return self.send_error(400)
   speed=max(.65,min(1.15,speed));key=hashlib.sha256((voice+str(speed)+text).encode()).hexdigest();path=Path(__file__).resolve().parent/'narration'/(key+'.wav')
   if path.exists():
    audio=path.read_bytes();return self.send_audio(audio)
   with voice_start_lock:start_voice()
   for attempt in range(360):
    try:
     with urlopen('http://127.0.0.1:8766/',timeout=.5):break
    except Exception:
     if voice_process and voice_process.poll() is not None:raise RuntimeError('Voice process exited')
     time.sleep(.5)
   else:raise RuntimeError('Voice initialization timed out')
   request=Request('http://127.0.0.1:8766/',data=body,headers={'Content-Type':'application/json'})
   with urlopen(request,timeout=120) as response:audio=response.read()
   self.send_audio(audio)
  except (BrokenPipeError,ConnectionResetError):pass
  except (ValueError,KeyError,TypeError):self.send_error(400,'Invalid speech request')
  except Exception:self.send_error(503,'Natural voice not ready')
 def send_audio(self,audio):
  self.send_response(200);self.send_header('Content-Type','audio/wav');self.send_header('Content-Length',str(len(audio)));self.end_headers();self.wfile.write(audio)
 def do_GET(self):
  global last
  u=urlparse(self.path)
  if u.path=='/api/health':
   data=json.dumps({'status':'ready','naturalVoice':'local','cachedPhrases':len(list((Path(__file__).parent/'narration').glob('*.wav')))}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data);return
  if u.path!='/api/geocode':return super().do_GET()
  q=parse_qs(u.query).get('q',[''])[0].strip()[:200]
  try:
   if not q:result=[]
   else:
    with lock:
     if q not in cache:
      time.sleep(max(0,1-(time.monotonic()-last)))
      request=Request('https://msearch.gsi.go.jp/address-search/AddressSearch?q='+quote(q),headers={'User-Agent':'CelestialFlightLocal/1.0'})
      with urlopen(request,timeout=10) as response:cache[q]=json.load(response)
      last=time.monotonic()
     result=cache[q]
   body=json.dumps(result,ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
  except Exception:self.send_error(502,'Address search unavailable')
 def log_message(self,format,*args):
  if not self.path.startswith('/api/'):super().log_message(format,*args)
if __name__=='__main__':
 ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
