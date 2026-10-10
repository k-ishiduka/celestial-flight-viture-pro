import * as T from '../outputs/three.module.js';
import { ConstellationFocus } from '../outputs/constellation-focus.js';
import { Narrator } from '../outputs/narrator.js';
import fs from 'node:fs';
globalThis.Audio = class {
  pause() {}
};
const controls = {
  explainSelected: {},
  art: { checked: true },
  inspect: {},
  followFocus: { checked: true },
  inspectTarget: { value: 'constellation' },
  artOpacity: { value: '.28' },
  card: {},
  narrate: {},
  voice: { value: '0', replaceChildren() {} },
  journey: { value: 'flight' },
  subtitle: {},
  speechRate: { value: '.85' },
  speechEngine: { value: 'system' },
  neuralVoice: { value: 'jf_alpha' },
  guideZoom: { checked: true },
};
globalThis.document = { getElementById: id => controls[id] };
globalThis.Option = class {};
globalThis.window = { speechSynthesis: { addEventListener() {} } };
let spoken = [];
globalThis.speechSynthesis = {
  getVoices: () => [{ lang: 'ja-JP', localService: true, name: 'Kyoko' }],
  cancel() {},
  speak(u) {
    spoken.push(u);
  },
};
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
const sky = new T.Group(),
  art = new T.Group(),
  labels = new T.Group(),
  g = new T.BufferGeometry();
g.setAttribute('position', new T.Float32BufferAttribute([1, 0, -1, 0, 1, -1], 3));
const picture = new T.Sprite(new T.SpriteMaterial({ opacity: 0.28 }));
art.add(picture);
const camera = new T.PerspectiveCamera();
let item = { id: 'Test', name: 'テスト座', ra: 0, dec: 0, vector: new T.Vector3(0, 0, -1) };
const e = {
  sky,
  art,
  constellationNames: labels,
  camera,
  constellationAtlas: { Test: { geometry: g, art: picture } },
  constellationCenters: [item],
  lines: new T.LineSegments(g, new T.LineBasicMaterial({ opacity: 0.62 })),
  named: [],
  cancelTurn() {},
  notice() {},
  narrator: { say() {} },
  starName(s) {
    return s.name;
  },
};
const focus = new ConstellationFocus(e);
focus.enabled = true;
focus.begin(item, false);
for (let i = 0; i < 80; i++) focus.update(0.05);
if (focus.age < 3.9 || focus.line.geometry.drawRange.count !== 0) throw Error('unexpected early progression');
for (let i = 0; i < 100; i++) focus.update(0.05);
if (focus.picture.material.opacity <= 0 || e.lines.material.opacity !== 0) throw Error('art isolation');
for (let i = 0; i < 220; i++) focus.update(0.05);
if (focus.active || e.lines.material.opacity !== 0.62) throw Error('restoration');
console.log('Slow line/art sequence, isolation and original opacity restoration: PASS');
const music = { duck() {} };
e.focus = focus;
e.nextTour = () => {};
e.members = JSON.parse(fs.readFileSync('outputs/constellation-members.json'));
e.named = [];
e.guide = {
  active: false,
  lock() {
    this.active = true;
  },
  release() {
    this.active = false;
  },
};
const n = new Narrator(e, music);
await n.say('c_Cyg', [305, 40, 'はくちょう座', ''], true);
for (let i = 0; i < 5; i++) await Promise.resolve();
if (!n.speaking) throw Error('narration did not start');
let count = 0;
while (n.speaking && count++ < 200) {
  spoken.at(-1).onend();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
if (n.speaking) throw Error('chunks incomplete');
const script = spoken.map(u => u.text).join('');
if (!script.includes('デネブ') || !script.includes('等級'))
  throw Error('rich script: ' + script.slice(0, 300));
console.log(
  'Japanese voice sentence queue and constituent star narrative: PASS (' + spoken.length + ' sentences)',
);
