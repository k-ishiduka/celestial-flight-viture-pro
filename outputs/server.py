"""夜の航路のローカルサーバー: 静的ファイル配信、音声生成の中継、住所検索の中継。"""
import atexit
import hashlib
import json
import math
import os
import subprocess
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

from voice_runtime import voice_environment

ROOT = Path(__file__).resolve().parent
NARRATION_DIR = ROOT / 'narration'
VOICE_URL = 'http://127.0.0.1:8766/'
VOICES = ('jf_alpha', 'jm_kumo')
MAX_REQUEST_BYTES = 10000
# 生成済み音声の保存上限。超えたら古いものから削除する。
MAX_NARRATION_BYTES = int(os.environ.get('CELESTIAL_NARRATION_MAX_MB', '1500')) * 1024 * 1024
PRUNE_INTERVAL_SECONDS = 60

voice_process = None
voice_start_lock = threading.Lock()
geocode_lock = threading.Lock()
geocode_cache = {}
last_geocode = None
last_prune = None


def stop_voice():
    if voice_process and voice_process.poll() is None:
        voice_process.terminate()


atexit.register(stop_voice)


def voice_is_up(timeout):
    try:
        with urlopen(VOICE_URL, timeout=timeout):
            return True
    except Exception:
        return False


def start_voice():
    global voice_process
    if voice_process and voice_process.poll() is None:
        return
    if voice_is_up(0.3):
        return
    runtime, env = voice_environment()
    with open(ROOT.parent / 'work' / 'voice-worker.log', 'a') as log:
        voice_process = subprocess.Popen(
            [runtime, str(ROOT / 'voice-worker.py')], env=env, stdout=log, stderr=log
        )


def prune_narration():
    """保存上限を超えた分を、更新の古い順に削除する(60秒に1回まで)。"""
    global last_prune
    now = time.monotonic()
    if last_prune is not None and now - last_prune < PRUNE_INTERVAL_SECONDS:
        return
    last_prune = now
    try:
        files = [(p.stat().st_mtime, p.stat().st_size, p) for p in NARRATION_DIR.glob('*.wav')]
    except OSError:
        return
    total = sum(size for _, size, _ in files)
    for _, size, path in sorted(files, key=lambda item: item[0]):
        if total <= MAX_NARRATION_BYTES:
            break
        try:
            path.unlink()
            total -= size
        except OSError:
            pass


def allowed_origins(port):
    return {f'http://localhost:{port}', f'http://127.0.0.1:{port}'}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # ファイル更新後も古いJSが残らないよう、毎回ETag/更新日時で再検証させる(変更が無ければ304)。
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_POST(self):
        if urlparse(self.path).path != '/api/speech':
            return self.send_error(404)
        origin = self.headers.get('Origin', '')
        if origin and origin not in allowed_origins(self.server.server_address[1]):
            return self.send_error(403)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 1 or size > MAX_REQUEST_BYTES:
                return self.send_error(413)
            body = self.rfile.read(size)
            item = json.loads(body)
            text = str(item['text'])[:1800]
            voice = item.get('voice', 'jf_alpha')
            speed = float(item.get('speed', 0.95))
            if voice not in VOICES or not math.isfinite(speed) or not text.strip():
                return self.send_error(400)
            speed = max(0.65, min(1.15, speed))
            key = hashlib.sha256((voice + str(speed) + text).encode()).hexdigest()
            path = NARRATION_DIR / (key + '.wav')
            if path.exists():
                path.touch()  # 使われたものを新しい扱いにして、削除対象から遠ざける
                return self.send_audio(path.read_bytes())
            with voice_start_lock:
                start_voice()
            self.wait_for_voice()
            request = Request(VOICE_URL, data=body, headers={'Content-Type': 'application/json'})
            with urlopen(request, timeout=120) as response:
                audio = response.read()
            self.send_audio(audio)
            prune_narration()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (ValueError, KeyError, TypeError):
            self.send_error(400, 'Invalid speech request')
        except Exception:
            self.send_error(503, 'Natural voice not ready')

    def wait_for_voice(self):
        for _ in range(360):
            if voice_is_up(0.5):
                return
            if voice_process and voice_process.poll() is not None:
                raise RuntimeError('Voice process exited')
            time.sleep(0.5)
        raise RuntimeError('Voice initialization timed out')

    def send_audio(self, audio):
        self.send_response(200)
        self.send_header('Content-Type', 'audio/wav')
        self.send_header('Content-Length', str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def send_json(self, data, extra_headers=()):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        for name, value in extra_headers:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path)
        if path.path == '/api/health':
            cached = len(list(NARRATION_DIR.glob('*.wav')))
            return self.send_json({'status': 'ready', 'naturalVoice': 'local', 'cachedPhrases': cached})
        if path.path == '/api/geocode':
            return self.geocode(parse_qs(path.query).get('q', [''])[0].strip()[:200])
        return super().do_GET()

    def geocode(self, query):
        global last_geocode
        try:
            if not query:
                result = []
            else:
                with geocode_lock:
                    if query not in geocode_cache:
                        # 国土地理院の利用負荷を抑えるため、1秒に1回まで
                        if last_geocode is not None:
                            time.sleep(max(0, 1 - (time.monotonic() - last_geocode)))
                        request = Request(
                            'https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + quote(query),
                            headers={'User-Agent': 'CelestialFlightLocal/1.0'},
                        )
                        with urlopen(request, timeout=10) as response:
                            geocode_cache[query] = json.load(response)
                        last_geocode = time.monotonic()
                    result = geocode_cache[query]
            self.send_json(result, [('Cache-Control', 'no-store')])
        except Exception:
            self.send_error(502, 'Address search unavailable')

    def log_message(self, format, *args):
        if not self.path.startswith('/api/'):
            super().log_message(format, *args)


if __name__ == '__main__':
    NARRATION_DIR.mkdir(exist_ok=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
