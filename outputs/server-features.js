// 付属サーバー(Python)が無くても動くよう、サーバー依存の機能を検出・代替する。
const $ = id => document.getElementById(id);
const GSI_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=';

/** 住所検索。付属サーバー経由を試し、無ければ国土地理院へ直接問い合わせる(CORS許可済み)。 */
export async function geocode(query) {
  try {
    const response = await fetch('/api/geocode?q=' + encodeURIComponent(query));
    if (response.ok && (response.headers.get('content-type') || '').includes('json')) return response.json();
  } catch {}
  const response = await fetch(GSI_URL + encodeURIComponent(query));
  if (!response.ok) throw Error('住所検索に接続できません。緯度・経度で指定できます。');
  return response.json();
}

/** 自然な日本語音声(付属サーバー + Kokoro)が使えるか。 */
export async function naturalVoiceAvailable() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return false;
    return (await response.json()).voiceReady === true;
  } catch {
    return false;
  }
}

/** 音声エンジンの選択に合わせて、関連する表示・操作を切り替える。 */
function updateVoiceControls() {
  const engine = $('speechEngine').value;
  $('neuralVoice').disabled = engine !== 'neural';
  $('voiceCredit').hidden = engine !== 'browser';
}

/**
 * 付属サーバーの自然な音声(Kokoro)が使えない環境では、ブラウザ内の自然な声(Piper Plus)へ切り替える。
 * 保存済みの設定は書き換えない(change イベントを出さない)。
 */
export async function adaptSpeechEngine() {
  const select = $('speechEngine');
  select.addEventListener('change', updateVoiceControls);
  if (!(await naturalVoiceAvailable())) {
    const neural = Array.from(select.options).find(option => option.value === 'neural');
    if (neural) {
      neural.disabled = true;
      neural.textContent = '自然な日本語音声(付属サーバー版・この環境では未設定)';
    }
    if (select.value === 'neural') select.value = 'browser';
  }
  updateVoiceControls();
}
