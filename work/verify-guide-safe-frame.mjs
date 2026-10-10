import * as T from '../outputs/three.module.js';
import { GuidedView } from '../outputs/guided-view.js';
import fs from 'node:fs';
const members = JSON.parse(fs.readFileSync('outputs/constellation-members.json'));
let checked = 0;
for (const [width, height] of [
  [1680, 872],
  [960, 540],
  [480, 900],
]) {
  const top = 108,
    bottom = height - 270;
  const ui = { classList: { contains: () => false }, getBoundingClientRect: () => ({ height }) };
  globalThis.document = {
    getElementById: id =>
      id === 'ui'
        ? ui
        : id === 'narrationPanel'
          ? { hidden: false, getBoundingClientRect: () => ({ top: bottom + 16 }) }
          : {},
    querySelector: s => ({
      getBoundingClientRect: () => (s === '.topbar' ? { bottom: top } : { top: height - 120 }),
    }),
  };
  for (const [id, stars] of Object.entries(members)) {
    const camera = new T.PerspectiveCamera(65, width / height, 0.1, 30000),
      guide = new GuidedView({ camera, members, narrator: { speaking: true } });
    guide.lock(id, [stars[0].ra, stars[0].dec]);
    for (let i = 0; i < 250; i++) guide.update(camera, 0.05);
    camera.updateMatrixWorld();
    const stereo = new T.StereoCamera();
    stereo.aspect = 1;
    stereo.eyeSep = 0.12;
    stereo.update(camera);
    for (const view of [stereo.cameraL, stereo.cameraR])
      view.matrixWorldInverse.copy(view.matrixWorld).invert();
    const safeBottom = Math.max(top + height * 0.25, bottom);
    for (const view of width > height ? [camera, stereo.cameraL, stereo.cameraR] : [camera])
      for (const s of stars) {
        const a = (s.ra * Math.PI) / 180,
          b = (s.dec * Math.PI) / 180,
          p = new T.Vector3(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a))
            .multiplyScalar(10000)
            .project(view),
          y = ((1 - p.y) * height) / 2;
        if (y < top - 1 || y > safeBottom + 1 || Math.abs(p.x) > (view === camera ? 0.802 : 0.82))
          throw Error(`${id} ${width}x${height}: outside unobscured frame: ${y}`);
        checked++;
      }
    guide.release();
    for (let i = 0; i < 61; i++) guide.update(camera, 0.05);
    if (camera.projectionMatrix.elements[9] !== 0) throw Error('projection offset not restored');
  }
}
console.log(
  `Guide avoids subtitles and controls in mono / stereo / portrait: PASS (${checked} star projections)`,
);
