// お気に入り地点: 保存データの検証・追加・削除・上限。
import assert from 'node:assert/strict';
import {
  MAX_PLACES,
  addPlace,
  formatCoordinates,
  normalizePlaces,
  removePlace,
} from '../outputs/favorite-places.js';

assert.deepEqual(normalizePlaces(null), []);
assert.deepEqual(normalizePlaces('x'), []);
// 不正な項目は捨て、範囲外は丸め、時差が無ければ 9(日本)にする
const cleaned = normalizePlaces([
  { name: ' 自宅 ', lat: '35.5', lon: 139.7, tz: 9 },
  { name: '', lat: 1, lon: 1 },
  { name: 'NaN', lat: 'abc', lon: 1 },
  { name: '範囲外', lat: 999, lon: -999, tz: 99 },
  { name: '時差なし', lat: 0, lon: 0 },
  null,
]);
assert.deepEqual(
  cleaned.map(p => [p.name, p.lat, p.lon, p.tz]),
  [
    ['自宅', 35.5, 139.7, 9],
    ['範囲外', 90, -180, 14],
    ['時差なし', 0, 0, 9],
  ],
);

// 同じ名前は上書きされ、先頭に来る
let places = addPlace([], { name: 'A', lat: 1, lon: 2, tz: 9 });
places = addPlace(places, { name: 'B', lat: 3, lon: 4, tz: -5 });
places = addPlace(places, { name: 'A', lat: 10, lon: 20, tz: 9 });
assert.deepEqual(
  places.map(p => p.name),
  ['A', 'B'],
);
assert.equal(places[0].lat, 10);
assert.deepEqual(addPlace(places, { name: '', lat: 1, lon: 1 }), places, '名前が空の場合は変更しない');

// 上限
let many = [];
for (let i = 0; i < MAX_PLACES + 5; i++) many = addPlace(many, { name: 'P' + i, lat: 0, lon: 0, tz: 0 });
assert.equal(many.length, MAX_PLACES);
assert.equal(many[0].name, 'P' + (MAX_PLACES + 4), '新しいものが残る');

assert.deepEqual(
  removePlace(places, 'A').map(p => p.name),
  ['B'],
);
assert.equal(formatCoordinates(35.68124, 139.76712), '35.681° N / 139.767° E');
assert.equal(formatCoordinates(-33.8688, -70.5), '33.869° S / 70.500° W');
console.log('Favorite places: validation, overwrite, limit, remove and formatting: PASS');
