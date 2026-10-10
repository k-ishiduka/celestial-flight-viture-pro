from http.server import ThreadingHTTPServer
from server import Handler, start_voice
from pathlib import Path
import os, subprocess, urllib.request

os.chdir(Path(__file__).resolve().parent)
url = 'http://localhost:8765/'
try:
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
except OSError:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            if '夜の航路'.encode() not in response.read():
                raise RuntimeError('別のアプリが8765番を使用しています')
    except Exception as exc:
        print('起動できません:', exc)
        input('Returnで閉じます')
        raise SystemExit(1)
    subprocess.run(['open', '-a', 'Google Chrome', url], check=False)
else:
    try:
        start_voice()
    except Exception:
        print('自然な音声の準備が必要です。先にsetup_voice.pyを実行してください。星空はそのまま使えます。')
    subprocess.run(['open', '-a', 'Google Chrome', url], check=False)
    print('夜の航路を起動しました。このウィンドウを閉じると終了します。')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
