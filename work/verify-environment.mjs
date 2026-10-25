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
assert.equal(+observer.date, before, 'space does not advance the hidden clock');
observer.active = true;
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
const makeEnvironment = () => {
  const moonObject = new T.Object3D();
  moonObject.material = {
    uniforms: {
      lightDirection: { value: new T.Vector3() },
      shadowDirection: { value: new T.Vector3() },
      shadowOn: { value: 0 },
    },
  };
  return {
    observer,
    camera: new T.PerspectiveCamera(),
    eqGroup: new T.Group(),
    dome: new T.Object3D(),
    horizon: new T.Object3D(),
    sun: new T.Object3D(),
    moon: moonObject,
    corona: new T.Sprite(new T.SpriteMaterial()),
    solarObscuration: 0,
    lunarEclipse: null,
    effectiveSunAltitude: -90,
    updateEclipse: SkyEnvironment.prototype.updateEclipse,
    eclipseNote: SkyEnvironment.prototype.eclipseNote,
    age: 1,
    lastKey: '',
    uniforms: { sunDirection: { value: new T.Vector3() }, sunAltitude: { value: 0 } },
  };
};
const environment = makeEnvironment();
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

// ---- 日食・月食の描画状態(実際の食で確認) ----
const setPlace = (lat, lon, tz, iso) => {
  controls.latitude.value = String(lat);
  controls.longitude.value = String(lon);
  controls.timezone.value = String(tz);
  observer.setDate(new Date(iso));
  observer.update(0);
};
{
  // 2024-04-08 の皆既日食(米国ダラス・昼間): 太陽は完全に隠れ、コロナが出て、昼夜の明るさ再現ONでは暗くなる
  controls.atmosphere.checked = true;
  setPlace(32.7767, -96.797, -5, '2024-04-08T18:42:37Z');
  const eclipse = makeEnvironment();
  SkyEnvironment.prototype.update.call(eclipse, 0);
  assert(eclipse.sunAltitude > 60, '昼間の高い太陽');
  assert(eclipse.solarObscuration > 0.999, `皆既日食 (隠れる割合 ${eclipse.solarObscuration})`);
  assert(eclipse.corona.material.opacity > 0.95, 'コロナが見える');
  assert(eclipse.effectiveSunAltitude < -5, '皆既のあいだは薄明のように暗い');
  assert(eclipse.starVisibility > 0.2, '星が見え始める');
  assert(eclipse.description.includes('日食の最中'));
  // 食が始まる前(部分食の始まりは 17:23 UTC ごろ)は、通常の昼
  setPlace(32.7767, -96.797, -5, '2024-04-08T16:30:00Z');
  const before = makeEnvironment();
  SkyEnvironment.prototype.update.call(before, 0);
  assert(before.solarObscuration === 0 && before.corona.material.opacity === 0);
  assert(before.starVisibility < 0.01 && !before.description.includes('日食'));

  // 2022-11-08 の皆既月食(東京の夕方): 月は地球の影に入り、影の中心は月のすぐ近く
  controls.atmosphere.checked = false;
  setPlace(35.68124, 139.76712, 9, '2022-11-08T10:59:07Z');
  const lunar = makeEnvironment();
  SkyEnvironment.prototype.update.call(lunar, 0);
  assert.equal(lunar.moon.material.uniforms.shadowOn.value, 1);
  assert(lunar.lunarEclipse.inUmbra && lunar.lunarEclipse.magnitude > 0.99);
  assert(lunar.description.includes('月食の最中'));
  const toShadow = lunar.moon.material.uniforms.shadowDirection.value;
  const toMoon = lunar.observer.vector(lunar.moon.position).normalize();
  assert(Math.acos(Math.min(1, toShadow.dot(toMoon))) * (180 / Math.PI) < 0.8, '影の中心は月の近く');
  // 食でない満月は影なし
  setPlace(35.68124, 139.76712, 9, '2022-12-08T13:00:00Z');
  const plain = makeEnvironment();
  SkyEnvironment.prototype.update.call(plain, 0);
  assert.equal(plain.moon.material.uniforms.shadowOn.value, 0);
  assert(plain.lunarEclipse === null && !plain.description.includes('食'));
}
console.log(
  'Eclipses in the sky environment: total solar eclipse darkening/corona and lunar umbra shadow: PASS',
);
