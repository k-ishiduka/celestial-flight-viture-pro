// ブラウザ内の音声: 読み込みに失敗しても次回やり直せること(Node には CDN ライブラリが無いので必ず失敗する)。
import assert from 'node:assert/strict';
import { BrowserVoice } from '../outputs/browser-voice.js';

const voice = new BrowserVoice();
await assert.rejects(() => voice.load());
assert.equal(voice.loading, null, '失敗した読み込みの記録が残っている');
const first = voice.load().catch(() => {});
const second = voice.load().catch(() => {});
assert.notEqual(voice.loading, null, '読み込み中は同じ Promise を共有する');
await Promise.all([first, second]);
assert.equal(voice.loading, null);
console.log('Browser voice: failed loads are retryable and concurrent calls share one load: PASS');
