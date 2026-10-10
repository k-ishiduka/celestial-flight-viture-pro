// お気に入りの観測地点。名前・緯度・経度・時差(UTCからの時間)をブラウザに保存する。
const STORAGE_KEY = 'celestial-places';
export const MAX_PLACES = 20;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** 保存データを読み、不正な項目は捨てる。 */
export function normalizePlaces(raw) {
  if (!Array.isArray(raw)) return [];
  const places = [];
  for (const item of raw) {
    const lat = Number(item?.lat);
    const lon = Number(item?.lon);
    const name = String(item?.name ?? '')
      .trim()
      .slice(0, 40);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const tz = Number(item.tz);
    places.push({
      name,
      lat: clamp(lat, -90, 90),
      lon: clamp(lon, -180, 180),
      tz: Number.isFinite(tz) ? clamp(tz, -12, 14) : 9,
    });
  }
  return places.slice(0, MAX_PLACES);
}

/** 同じ名前なら上書き、新しい名前なら先頭に追加する。 */
export function addPlace(places, place) {
  const [added] = normalizePlaces([place]);
  if (!added) return places;
  return normalizePlaces([added, ...places.filter(p => p.name !== added.name)]);
}

export function removePlace(places, name) {
  return places.filter(p => p.name !== name);
}

export function formatCoordinates(lat, lon) {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'} / ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;
}

function readStorage() {
  try {
    return normalizePlaces(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

function writeStorage(places) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {}
}

export class FavoritePlaces {
  constructor(notice) {
    const $ = id => document.getElementById(id);
    this.$ = $;
    this.notice = notice;
    this.places = readStorage();
    this.render();
    $('savePlace').onclick = () => this.save();
    $('deletePlace').onclick = () => this.remove();
    $('savedPlaces').onchange = () => this.choose();
  }

  render(selected = '') {
    const { $ } = this;
    $('savedPlaces').replaceChildren(
      new Option(this.places.length ? '保存した場所を選ぶ' : '保存した場所はありません', ''),
      ...this.places.map(p => new Option(`${p.name} · ${formatCoordinates(p.lat, p.lon)}`, p.name)),
    );
    $('savedPlaces').value = selected;
    $('deletePlace').disabled = !selected;
  }

  save() {
    const { $ } = this;
    const lat = Number($('latitude').value);
    const lon = Number($('longitude').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return this.notice('緯度・経度が正しくありません');
    const name = $('placeName').value.trim() || formatCoordinates(lat, lon);
    const tz = Number($('timezone').value);
    this.places = addPlace(this.places, { name, lat, lon, tz });
    writeStorage(this.places);
    this.render(name);
    $('placeName').value = '';
    this.notice(`「${name.slice(0, 40)}」を保存しました`);
  }

  choose() {
    const { $ } = this;
    const place = this.places.find(p => p.name === $('savedPlaces').value);
    $('deletePlace').disabled = !place;
    if (!place) return;
    $('latitude').value = place.lat;
    $('longitude').value = place.lon;
    $('timezone').value = place.tz;
    for (const id of ['latitude', 'longitude', 'timezone'])
      $(id).dispatchEvent(new Event('change', { bubbles: true }));
    this.notice(`「${place.name}」へ移動しました`);
  }

  remove() {
    const { $ } = this;
    const name = $('savedPlaces').value;
    if (!name) return;
    this.places = removePlace(this.places, name);
    writeStorage(this.places);
    this.render();
    this.notice(`「${name}」を削除しました`);
  }
}
