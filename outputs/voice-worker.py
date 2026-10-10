# coding: utf-8
from pathlib import Path
import os, json, hashlib, threading, math
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import numpy as np
import soundfile as sf
import torch
import unidic, unidic_lite
unidic.DICDIR=unidic_lite.DICDIR
from kokoro import KPipeline, KModel
root=Path(__file__).resolve().parent
output=root/'narration';output.mkdir(exist_ok=True)
torch.set_num_threads(3)
assets=Path(os.environ.get('CELESTIAL_VOICE_ASSETS',root.parent/'work'/'voice-assets'))
model=KModel(repo_id='hexgrad/Kokoro-82M',config=str(assets/'config.json'),model=str(assets/'kokoro-v1_0.pth'))
model.eval()
pipeline=KPipeline(lang_code='j',model=model,device='cpu')
voices={name:torch.load(assets/(name+'.pt'),map_location='cpu',weights_only=True) for name in ['jf_alpha','jm_kumo']}
lock=threading.Lock()
class VoiceHandler(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200);self.end_headers();self.wfile.write(b'ready')
 def do_POST(self):
  try:
   size=int(self.headers.get('Content-Length','0'))
   if size<1 or size>10000:raise ValueError('request size')
   item=json.loads(self.rfile.read(size));text=str(item['text'])[:1800];voice=item.get('voice','jf_alpha')
   if voice not in ['jf_alpha','jm_kumo']:raise ValueError('voice')
   speed=float(item.get('speed',.95))
   if not math.isfinite(speed):raise ValueError('speed')
   speed=max(.65,min(1.15,speed))
   key=hashlib.sha256((voice+str(speed)+text).encode()).hexdigest();path=output/(key+'.wav')
   with lock:
    if not path.exists():
     with torch.inference_mode():parts=[audio.cpu().numpy() for _,_,audio in pipeline(text,voice=voices[voice],speed=speed)]
     if not parts:raise ValueError('empty audio')
     waveform=np.concatenate(parts);peak=float(np.max(np.abs(waveform)));waveform=waveform*min(1,.9/max(.01,peak));sf.write(path,waveform,24000,subtype='PCM_16')
   body=path.read_bytes();self.send_response(200);self.send_header('Content-Type','audio/wav');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception as error:
   print(type(error).__name__,str(error),flush=True);self.send_error(500)
 def log_message(self,*args):pass
ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('CELESTIAL_VOICE_PORT','8766'))),VoiceHandler).serve_forever()
