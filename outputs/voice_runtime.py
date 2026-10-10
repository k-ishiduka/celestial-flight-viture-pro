"""Restore the local voice bundle outside iCloud's per-file eviction area."""
import json
import os
from pathlib import Path
import tarfile
import tempfile

WORK = Path(__file__).resolve().parent.parent / 'work'
VERSION = 'kokoro-ja-20261010'


def voice_environment():
    manifest = json.loads((WORK / 'voice-bundle.json').read_text())
    python = Path(manifest['python'])
    if not python.is_file():
        raise RuntimeError('音声用Pythonが見つかりません')
    pointer = WORK / 'voice-local.json'
    runtime = None
    try:
        saved = json.loads(pointer.read_text())
        candidate = Path(saved['root'])
        if saved['version'] == VERSION and (candidate / '.ready').read_text() == VERSION:
            if (candidate / 'site-packages/torch/__init__.py').is_file() and (candidate / 'assets/kokoro-v1_0.pth').is_file():
                runtime = candidate
    except (OSError, ValueError, KeyError):
        pass
    if runtime is None:
        runtime = Path(tempfile.mkdtemp(prefix='celestial-flight-voice-'))
        with tarfile.open(WORK / 'voice-bundle.tar.gz', 'r:gz') as archive:
            for member in archive:
                target = (runtime / member.name).resolve()
                if runtime.resolve() not in target.parents or not (member.isfile() or member.isdir()):
                    raise RuntimeError('音声データの形式を確認してください')
                archive.extract(member, runtime)
        (runtime / '.ready').write_text(VERSION)
        pending = pointer.with_suffix('.tmp')
        pending.write_text(json.dumps({'root': str(runtime), 'version': VERSION}))
        pending.replace(pointer)
    env = os.environ.copy()
    env.update(PYTHONPATH=str(runtime / 'site-packages'),
               CELESTIAL_VOICE_ASSETS=str(runtime / 'assets'),
               HF_HOME=str(runtime / 'cache'),
               HF_HUB_DISABLE_TELEMETRY='1', HF_HUB_OFFLINE='1',
               PYTHONPYCACHEPREFIX=str(runtime / 'pycache'),
               MPLCONFIGDIR=str(runtime / 'mpl'))
    return str(python), env
