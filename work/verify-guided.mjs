import * as T from '../outputs/three.module.js';
import { GuidedView } from '../outputs/guided-view.js';
import fs from 'node:fs';
const members = JSON.parse(fs.readFileSync('outputs/constellation-members.json'));
globalThis.document = { getElementById: () => ({}) };
let worst = 0;
for (const aspect of [16 / 9, 1920 / 958, 1, 9 / 16])
  for (const [id, stars] of Object.entries(members)) {
    const camera = new T.PerspectiveCamera(65, aspect, 0.1, 30000),
      e = { camera, members };
    const guide = new GuidedView(e);
    guide.lock(id, [stars[0].ra, stars[0].dec]);
    for (let i = 0; i < 200; i++) guide.update(camera, 0.05);
    camera.updateMatrixWorld();
    for (const s of stars) {
      const a = (s.ra * Math.PI) / 180,
        b = (s.dec * Math.PI) / 180,
        v = new T.Vector3(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a))
          .multiplyScalar(10000)
          .project(camera);
      worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
      if (Math.abs(v.x) > 0.801 || Math.abs(v.y) > 0.801)
        throw Error('outside view ' + id + ' ' + JSON.stringify(v));
    }
    guide.release();
    for (let i = 0; i < 61; i++) guide.update(camera, 0.05);
    if (guide.active || guide.remaining) throw Error('release');
  }
console.log(
  'All 88 constellations + Summer Triangle fit inside camera; smooth unlock: PASS, maximum projected extent ' +
    worst.toFixed(3),
);
