// 星座の神話・由来: 全88星座(+夏の大三角)に文章があり、読み上げに適した形で、ナレーションに組み込まれること。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { constellationMyths } from '../outputs/constellation-myths.js';
import { constellationStories } from '../outputs/constellation-stories.js';
import { Narrator } from '../outputs/narrator.js';
import { starReadings } from '../outputs/star-readings.js';
import { equatorialVector } from '../outputs/rich-guide.js';

const read = f => JSON.parse(fs.readFileSync('outputs/' + f));

// ---- データ ----
assert.deepEqual(
  Object.keys(constellationMyths).sort(),
  Object.keys(constellationStories).sort(),
  '全星座に神話・由来がある',
);
const seenText = new Set();
for (const [id, text] of Object.entries(constellationMyths)) {
  assert.equal(typeof text, 'string', id);
  assert.ok(text.length >= 80 && text.length <= 260, `${id}: 長さが適切 (${text.length}文字)`);
  assert.ok(text.endsWith('。'), `${id}: 文末が句点`);
  assert.ok(!/undefined|NaN|\n|\s{2,}/.test(text), `${id}: 余計な文字が無い`);
  assert.ok(!seenText.has(text), `${id}: 重複`);
  seenText.add(text);
  // 1文が長すぎると、読み上げが途切れにくくても聞き取りにくい
  for (const sentence of text.match(/[^。]+。?/g))
    assert.ok(sentence.length <= 90, `${id}: 1文が長い (${sentence.length}文字)`);
  // 読み上げで誤読されやすい英字は、M13・S字などの定番以外に入れない
  const latin = (text.match(/[A-Za-z]+/g) || []).filter(w => !['M', 'S'].includes(w));
  assert.deepEqual(latin, [], `${id}: 英字 ${latin}`);
}
assert.ok(
  constellationMyths.Ori.includes('さそり') && constellationMyths.Sco.includes('オリオン'),
  '対になる話が呼応している',
);
assert.ok(constellationMyths.And.includes('ペルセウス') && constellationMyths.Per.includes('メドゥーサ'));

// ---- ナレーションへの組み込み ----
const controls = { mythNarration: { checked: true }, art: { checked: false } };
globalThis.document = { getElementById: id => controls[id] ?? { checked: false } };
const named = read('named-stars.json');
for (const s of named) s.vector = equatorialVector(s.ra, s.dec);
const members = read('constellation-members.json');
const experience = {
  named,
  members,
  starName: s => starReadings[s.name] || s.name,
  focus: { memberName: (s, i) => s.name || `${i + 1}番目の星` },
};
const narrator = Object.create(Narrator.prototype);
narrator.experience = experience;
narrator.sequence = 0;

const features = read('constellation-names.json').features;
for (const feature of features) {
  const id = feature.id;
  const [ra, dec] = feature.geometry.coordinates;
  const d = [ra, dec, feature.properties.ja || feature.properties.name, ''];
  controls.mythNarration.checked = true;
  const withMyth = narrator.build('c_' + id, d).segments;
  controls.mythNarration.checked = false;
  const without = narrator.build('c_' + id, d).segments;
  const mythText = withMyth.map(s => s.text).join('');
  assert.ok(mythText.includes(constellationMyths[id].slice(0, 30)), `${id}: 神話がナレーションに入る`);
  assert.ok(withMyth.length > without.length, `${id}: オフでは語らない`);
  assert.ok(
    !without
      .map(s => s.text)
      .join('')
      .includes(constellationMyths[id].slice(0, 30)),
  );
  // 星を順に結ぶ演出(member)と終わりの合図は、神話の前に済む
  const lastMember = withMyth.reduce(
    (last, s, i) => (s.member !== undefined || s.finishMembers ? i : last),
    -1,
  );
  const firstMythChunk = withMyth.findIndex(s => s.text.includes('にまつわるお話です'));
  assert.ok(firstMythChunk > lastMember, `${id}: 星の説明のあとに神話`);
  assert.ok(
    withMyth.every(s => s.text && s.text.length <= 130),
    `${id}: 読み上げ単位が長すぎない`,
  );
}
// 星(個別の恒星)の解説には神話を足さない
controls.mythNarration.checked = true;
const star = named[0];
const starSegments = narrator.build('s_' + star.name, [
  star.ra,
  star.dec,
  experience.starName(star),
  '',
]).segments;
assert.ok(!starSegments.some(s => s.text.includes('にまつわるお話')));
console.log(
  'Constellation myths: 89 texts, readable length/sentences, wired into narration and switchable: PASS',
);
