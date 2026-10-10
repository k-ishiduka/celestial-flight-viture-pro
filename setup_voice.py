"""Run with Python 3.12 to prepare offline Japanese speech on this Mac."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlretrieve
import venv


def main():
    if sys.version_info[:2] != (3, 12):
        raise SystemExit('Python 3.12で実行してください: python3.12 setup_voice.py')
    project = Path(__file__).resolve().parent
    work = project / 'work'
    work.mkdir(exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix='celestial-flight-voice-'))
    print('自然な日本語音声を準備しています。初回は数分かかります。', flush=True)
    venv.EnvBuilder(with_pip=True).create(root / 'venv')
    python = root / 'venv/bin/python'
    subprocess.run([str(python), '-m', 'pip', 'install', '-r', str(project / 'requirements-voice.txt')], check=True)
    assets = root / 'assets'
    assets.mkdir()
    for name in ['config.json', 'kokoro-v1_0.pth', 'voices/jf_alpha.pt', 'voices/jm_kumo.pt']:
        print('音声データ:', name, flush=True)
        urlretrieve('https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/' + name, assets / Path(name).name)
    shutil.move(str(root / 'venv/lib/python3.12/site-packages'), str(root / 'site-packages'))
    version = 'kokoro-ja-20261010'
    def keep(info):
        return None if '__pycache__' in Path(info.name).parts or info.issym() else info
    pending = work / 'voice-bundle.tar.gz.tmp'
    with tarfile.open(pending, 'w:gz', compresslevel=2) as archive:
        archive.add(root / 'site-packages', arcname='site-packages', filter=keep)
        archive.add(assets, arcname='assets', filter=keep)
    pending.replace(work / 'voice-bundle.tar.gz')
    (work / 'voice-bundle.json').write_text(json.dumps({'python': str(Path(sys.executable).resolve()), 'version': version}))
    (root / '.ready').write_text(version)
    (work / 'voice-local.json').write_text(json.dumps({'root': str(root), 'version': version}))
    print('音声の準備が完了しました。outputs/星空を開く.commandから起動できます。')


if __name__ == '__main__':
    main()
