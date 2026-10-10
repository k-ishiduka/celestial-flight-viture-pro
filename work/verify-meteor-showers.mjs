// 流星群: 活動度・年またぎ・選択・放射点から遠ざかる向き・地平線の判定。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../outputs/three.module.js';
import {
  ACTIVE_THRESHOLD,
  SHOWERS,
  activeShowers,
  activityLevel,
  chooseShower,
  createMeteor,
  daysFromPeak,
  describeShower,
  meteorPosition,
  meteorsPerMinute,
  nextShower,
  peakNight,
} from '../outputs/meteor-showers.js';

const at = (y, m, d, h = 12) => new Date(Date.UTC(y, m - 1, d, h));
const geminids = SHOWERS.find(s => s.id === 'geminids');
const quadrantids = SHOWERS.find(s => s.id === 'quadrantids');

// 極大日は1.0、離れるほど小さい
assert.ok(Math.abs(activityLevel(geminids, at(2026, 12, 14)) - 1) < 1e-9);
assert.ok(activityLevel(geminids, at(2026, 12, 18)) < activityLevel(geminids, at(2026, 12, 16)));
assert.ok(activityLevel(geminids, at(2026, 7, 1)) < ACTIVE_THRESHOLD);
// 年またぎ: 12/31 は 1/3 の極大に近い(昨年側の極大ではなく翌年側を使う)
assert.ok(Math.abs(daysFromPeak(quadrantids, at(2026, 12, 31)) - -3) < 0.01);
assert.ok(Math.abs(daysFromPeak(quadrantids, at(2027, 1, 5)) - 2) < 0.01);

// 活動中の一覧(10/21 はオリオン座流星群が先頭)
assert.equal(activeShowers(at(2026, 10, 21))[0].shower.id, 'orionids');
assert.equal(activeShowers(at(2026, 3, 1)).length, 0);
// 選択: off は何も出さない / auto は活動中のみ / 直接指定は日付に関係なく極大扱い
assert.equal(chooseShower('off', at(2026, 12, 14)), null);
assert.equal(chooseShower('auto', at(2026, 3, 1)), null);
assert.equal(chooseShower('perseids', at(2026, 3, 1)).level, 1);
assert.equal(chooseShower('unknown', at(2026, 3, 1)), null);
// 次の流星群
assert.equal(nextShower(at(2026, 3, 1)).shower.id, 'lyrids');
assert.ok(nextShower(at(2026, 12, 14, 13)).shower.id === 'ursids');
// 頻度: 上限と下限
assert.ok(meteorsPerMinute(geminids, 1) <= 14);
assert.ok(
  meteorsPerMinute(
    SHOWERS.find(s => s.id === 'draconids'),
    0.1,
  ) >= 1,
);
assert.ok(describeShower('auto', at(2026, 3, 1)).includes('こと座流星群'));
assert.ok(describeShower('geminids', at(2026, 3, 1)).includes('ふたご座流星群'));

// 流星は放射点から遠ざかる向きに動く(角距離が増え続ける)
const radiant = new T.Vector3(
  Math.cos((geminids.dec * Math.PI) / 180) * Math.cos((geminids.ra * Math.PI) / 180),
  Math.sin((geminids.dec * Math.PI) / 180),
  Math.cos((geminids.dec * Math.PI) / 180) * Math.sin((geminids.ra * Math.PI) / 180),
);
let seed = 7;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
for (let n = 0; n < 200; n++) {
  const meteor = createMeteor(geminids, random);
  assert.ok(meteor, 'いつでも見える条件なら必ず作れる');
  let previous = -1;
  for (let step = 0; step <= 10; step++) {
    const p = meteorPosition(meteor, (meteor.length * step) / 10);
    assert.ok(Math.abs(p.length() - 1) < 1e-9, '単位球の上にある');
    const separation = Math.acos(Math.min(1, p.dot(radiant)));
    assert.ok(separation >= previous - 1e-9, '放射点から遠ざかる');
    previous = separation;
  }
  const startSeparation = (Math.acos(meteor.start.dot(radiant)) * 180) / Math.PI;
  assert.ok(startSeparation >= 7.9 && startSeparation <= 85.1);
  assert.ok(meteor.duration > 0.2 && meteor.length > 0);
}
// 見えない場所は避ける。全部見えなければ null
assert.equal(
  createMeteor(geminids, random, () => false),
  null,
);
const upper = createMeteor(geminids, random, v => v.y > 0);
assert.ok(upper === null || upper.start.y > 0);
// 見ごろの日時: 夜(12時以降)は同じ日、明け方は翌日(年末は翌年)
assert.deepEqual(peakNight(geminids, 2026), { year: 2026, month: 12, day: 15, hour: 2 });
assert.deepEqual(
  peakNight(
    SHOWERS.find(s => s.id === 'ursids'),
    2026,
  ),
  { year: 2026, month: 12, day: 23, hour: 5 },
);
assert.deepEqual(
  peakNight(
    SHOWERS.find(s => s.id === 'draconids'),
    2026,
  ),
  { year: 2026, month: 10, day: 8, hour: 20 },
);
assert.deepEqual(peakNight({ peak: [12, 31], bestHour: 3 }, 2026), { year: 2027, month: 1, day: 1, hour: 3 });
// 設定画面の選択肢が、データと一致していること
const html = fs.readFileSync('outputs/index.html', 'utf8');
const select = html.match(/<select id="meteorShower">([\s\S]*?)<\/select>/)[1];
const optionIds = [...select.matchAll(/value="([^"]+)"/g)].map(m => m[1]);
assert.deepEqual(optionIds, ['auto', 'off', ...SHOWERS.map(s => s.id)]);
for (const s of SHOWERS) {
  assert.ok(
    select.includes(s.name) && select.includes(`${s.peak[0]}/${s.peak[1]}頃`),
    s.id + ' の表示名・日付が一致しない',
  );
}
console.log('Meteor showers: activity, year wrap, selection, rates, outward paths and visibility: PASS');
