"""夜の航路を起動してChromeで開く。8765番が使用中なら別のポートへ切り替える。"""
import os
import shutil
import subprocess
import sys
import urllib.request
import webbrowser
from http.server import ThreadingHTTPServer
from pathlib import Path

from server import NARRATION_DIR, Handler, start_voice

# 8766番は音声ワーカーが使うため候補に含めない
PORTS = [8765] + list(range(8767, 8777))
APP_MARKER = '夜の航路'.encode()


def is_this_app(port):
    try:
        with urllib.request.urlopen(f'http://localhost:{port}/', timeout=2) as response:
            return APP_MARKER in response.read()
    except Exception:
        return False


def chrome_command():
    """Chromeの起動コマンドを返す。見つからなければ None(既定のブラウザで開く)。"""
    if sys.platform == 'darwin':
        return ['open', '-a', 'Google Chrome']
    candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']
    if sys.platform == 'win32':
        for base in (os.environ.get('ProgramFiles'), os.environ.get('ProgramFiles(x86)'), os.environ.get('LocalAppData')):
            if base:
                candidates.append(os.path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    for name in candidates:
        path = shutil.which(name) or (name if os.path.isfile(name) else None)
        if path:
            return [path]
    return None


def open_browser(url):
    command = chrome_command()
    if command:
        subprocess.run(command + [url], check=False)
    else:
        print('Chromeが見つからないため既定のブラウザで開きます。グラス(WebHID)の接続にはChromeかEdgeが必要です。')
        webbrowser.open(url)


def bind():
    """(server, port) を返す。すでに本アプリが起動中なら (None, port) を返す。"""
    for port in PORTS:
        try:
            return ThreadingHTTPServer(('127.0.0.1', port), Handler), port
        except OSError:
            if is_this_app(port):
                return None, port
    raise RuntimeError(f'使用できるポートがありません({PORTS[0]}番と{PORTS[1]}〜{PORTS[-1]}番)')


def main():
    os.chdir(Path(__file__).resolve().parent)
    NARRATION_DIR.mkdir(exist_ok=True)
    try:
        server, port = bind()
    except RuntimeError as exc:
        print('起動できません:', exc)
        input('Returnで閉じます')
        raise SystemExit(1)
    url = f'http://localhost:{port}/'
    if server is None:
        open_browser(url)
        return
    try:
        start_voice()
    except Exception:
        print('自然な音声の準備が必要です。先にsetup_voice.pyを実行してください。星空はそのまま使えます。')
    open_browser(url)
    print(f'夜の航路を起動しました({url})。このウィンドウを閉じると終了します。')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == '__main__':
    main()
