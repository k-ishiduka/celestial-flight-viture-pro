// ブラウザ内で動く日本語の自然な音声(Piper Plus + つくよみちゃん)。Python もサーバーも不要。
// 初回だけ音声モデルと辞書(合計で約70MB)をダウンロードし、以降はブラウザにキャッシュされる。
//
// 音声: つくよみちゃんコーパス(CV.夢前黎) https://tyc.rei-yumesaki.net/material/corpus/
// ライブラリは index.html の import map(piper-plus / @piper-plus/g2p)で解決する。

const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.mjs';
// モデルが更新されて動かなくならないよう、動作確認したコミットに固定する。
const MODEL_URL =
  'https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan/resolve/36b59c825c36bd386b8960cf3f604382f52f2a87/tsukuyomi-chan-6lang-fp16.onnx';
// このモデルは標準の話速がやや速いため、解説向けに間延びしない程度へ伸ばす。
const BASE_LENGTH_SCALE = 1.25;

export class BrowserVoice {
  constructor() {
    this.loading = null;
    this.tts = null;
  }

  /** モデルを読み込む(2回目以降は同じ Promise を返す)。失敗したら次回やり直せるよう記録を捨てる。 */
  load(onProgress) {
    this.loading ??= (async () => {
      const [{ PiperPlus }, ort] = await Promise.all([import('piper-plus'), import(ORT_URL)]);
      this.tts = await PiperPlus.initialize({ model: MODEL_URL, ort, onProgress });
      return this.tts;
    })().catch(error => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  /** @returns {Promise<Blob>} WAV。rate は 0.65〜1.15(大きいほど速い)。 */
  async synthesize(text, rate = 0.95) {
    const tts = await this.load();
    const lengthScale = BASE_LENGTH_SCALE / Math.max(0.5, Math.min(1.5, rate));
    const audio = await tts.synthesize(text, { language: 'ja', lengthScale });
    return audio.toBlob();
  }
}
