import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as T from '../outputs/three.module.js';
const scope = { Date, Math };
vm.runInNewContext(fs.readFileSync('outputs/astronomy.browser.min.js', 'utf8'), scope);
globalThis.Astronomy = scope.Astronomy;
const A = globalThis.Astronomy;
const { Observer, horizonMatrix } = await import('../outputs/observer.js');
const { equatorialPosition } = await import('../outputs/sky-environment.js');
let worst = 0;
for (const iso of ['2000-01-01T00:00:00Z', '2026-10-09T12:00:00Z', '2050-06-21T05:00:00Z'])
  for (const [lat, lon] of [
    [35.68124, 139.76712],
    [-33.86, 151.2],
    [90, 0],
    [-90, 0],
  ]) {
    const date = new Date(iso),
      obs = new A.Observer(lat, lon, 0),
      matrix = horizonMatrix(date, lat, lon);
    for (const [ra, dec] of [
      [101.2872, -16.7161],
      [279.2347, 38.7837],
      [37.95, 89.26],
    ]) {
      const angle = Math.PI / 180;
      const j2000 = new A.Vector(
        Math.cos(dec * angle) * Math.cos(ra * angle),
        Math.cos(dec * angle) * Math.sin(ra * angle),
        Math.sin(dec * angle),
        date,
      );
      const ofDate = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(date), j2000));
      const horizontal = A.Horizon(date, obs, ofDate.ra, ofDate.dec);
      const actual = new T.Vector3(j2000.x, j2000.z, j2000.y).applyMatrix4(matrix);
      const altitude = Math.asin(actual.y) / angle,
        azimuth = (Math.atan2(actual.x, -actual.z) / angle + 360) % 360;
      const error = Math.abs(altitude - horizontal.altitude);
      worst = Math.max(worst, error);
      assert(error < 1e-8);
      assert(Math.abs(((azimuth - horizontal.azimuth + 540) % 360) - 180) < 1e-8);
    }
    const moon = A.Equator('Moon', date, obs, false, true);
    assert(equatorialPosition(moon).toArray().every(Number.isFinite));
    assert(Math.abs(equatorialPosition(moon).length() - 9900) < 1e-8);
    const fraction = A.Illumination('Moon', date).phase_fraction;
    assert(fraction >= 0 && fraction <= 1);
  }
const controls = Object.fromEntries(
  [
    'timezone',
    'date',
    'observe',
    'timePlay',
    'timeFlow',
    'now',
    'season',
    'locate',
    'searchAddress',
    'address',
    'locations',
    'latitude',
    'longitude',
    'planetMode',
  ].map(id => [id, { value: '0', checked: false, dispatchEvent() {} }]),
);
controls.timezone.value = '9';
controls.latitude.value = '35';
controls.longitude.value = '139';
globalThis.document = { getElementById: id => controls[id] };
const observer = new Observer(new T.Scene(), new T.PerspectiveCamera(), () => {});
controls.timeFlow.value = '86400';
controls.timeFlow.onchange();
controls.timePlay.onclick();
assert.equal(controls.timeFlow.value, '0');
controls.timePlay.onclick();
assert.equal(controls.timeFlow.value, '86400');
const before = +observer.date;
observer.update(1);
assert.equal(+observer.date - before, 86400000);
controls.timeFlow.value = '-3600';
observer.update(1);
assert.equal(+observer.date - before, 86400000 - 3600000);
observer.active = true;
observer.update(0);
const object = new T.Group();
observer.apply(object);
assert(object.matrix.elements.every(Number.isFinite));
console.log(
  `Epoch-correct horizon at both poles and both hemispheres, Moon placement, forward/reverse time and pause-resume: PASS (worst altitude error ${worst.toExponential(2)} degrees)`,
);
const { SkyEnvironment } = await import('../outputs/sky-environment.js');
controls.atmosphere = { checked: false };
controls.horizonGuides = { checked: true };
observer.setDate(new Date('2026-10-10T03:00:00Z'));
observer.update(0);
const moonObject = new T.Object3D();
moonObject.material = { uniforms: { lightDirection: { value: new T.Vector3() } } };
const environment = {
  observer,
  camera: new T.PerspectiveCamera(),
  eqGroup: new T.Group(),
  dome: new T.Object3D(),
  horizon: new T.Object3D(),
  sun: new T.Object3D(),
  moon: moonObject,
  age: 1,
  lastKey: '',
  uniforms: { sunDirection: { value: new T.Vector3() }, sunAltitude: { value: 0 } },
};
SkyEnvironment.prototype.update.call(environment, 0);
assert(environment.sunAltitude > 0);
assert.equal(environment.starVisibility, 1);
assert.equal(environment.dome.visible, false);
controls.atmosphere.checked = true;
SkyEnvironment.prototype.update.call(environment, 0);
assert(environment.starVisibility < 0.01);
assert.equal(environment.dome.visible, true);
console.log(
  'Ground observation keeps stars visible by default in daylight; optional realistic daylight still works: PASS',
);
