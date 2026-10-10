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

/** 自然な音声が使えない環境では、解説の音声をブラウザの読み上げに切り替える(保存済みの設定は変えない)。 */
export async function adaptSpeechEngine() {
  if (await naturalVoiceAvailable()) return;
  const select = $('speechEngine');
  const neural = Array.from(select.options).find(option => option.value === 'neural');
  if (neural) {
    neural.disabled = true;
    neural.textContent = '自然な日本語音声(この環境では未設定)';
  }
  if (select.value === 'neural') select.value = 'system';
  $('neuralVoice').disabled = true;
}
