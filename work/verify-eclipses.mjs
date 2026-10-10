// 日食・月食: 重なりの幾何、既知の実際の食(2024年皆既日食・2022年皆既月食)との照合。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scope = { Date, Math };
vm.runInNewContext(fs.readFileSync('outputs/astronomy.browser.min.js', 'utf8'), scope);
const A = scope.Astronomy;
const {
  PENUMBRA_RADIUS_DEG,
  UMBRA_RADIUS_DEG,
  describeEclipse,
  formatLocal,
  nextVisibleLunarEclipse,
  nextVisibleSolarEclipse,
  obscuredFraction,
  separationDegrees,
  shadowSeparationDegrees,
  umbralMagnitude,
} = await import('../outputs/eclipses.js');

// ---- 幾何 ----
assert.equal(obscuredFraction(0.27, 0.27, 0.6), 0, '離れていれば0');
assert.equal(obscuredFraction(0.27, 0.28, 0), 1, '月が大きく中心が重なれば皆既');
assert.equal(obscuredFraction(0.27, 0.27, 0), 1);
assert.ok(
  Math.abs(obscuredFraction(0.27, 0.25, 0) - (0.25 / 0.27) ** 2) < 1e-12,
  '月が小さく重なれば金環(面積比)',
);
let previous = 2;
for (let d = 0; d <= 0.6; d += 0.02) {
  const f = obscuredFraction(0.27, 0.26, d);
  assert.ok(f >= 0 && f <= 1 && f <= previous + 1e-12, '離れるほど減る');
  previous = f;
}
assert.ok(
  Math.abs(obscuredFraction(1, 1, 1) - (2 * Math.acos(0.5) - Math.sin(2 * Math.acos(0.5))) / Math.PI) < 1e-9,
  '同じ半径で半径分ずれた重なり',
);
assert.equal(umbralMagnitude(0.26, 0), 1);
assert.equal(umbralMagnitude(0.26, 5), 0);
assert.ok(Math.abs(umbralMagnitude(0.26, UMBRA_RADIUS_DEG) - 0.5) < 1e-9, '縁が影の縁にかかれば半分');
assert.ok(Math.abs(separationDegrees({ x: 1, y: 0, z: 0 }, { x: 0, y: 3, z: 0 }) - 90) < 1e-9);

// ---- 2024-04-08 の皆既日食(米国ダラス): 18:42 UTC ごろ ----
const dallas = new A.Observer(32.7767, -96.797, 0);
const solar = nextVisibleSolarEclipse(A, new Date('2024-03-01T00:00:00Z'), dallas);
assert.equal(solar.kind, 'total');
assert.ok(
  Math.abs(solar.peak - new Date('2024-04-08T18:42:00Z')) < 6 * 60000,
  '皆既日食の最大は 18:42 UTC ごろ',
);
assert.ok(
  solar.obscuration > 0.999 && solar.totalBegin && solar.totalEnd && solar.totalEnd > solar.totalBegin,
);
assert.ok(solar.altitude > 0);
// 最大の瞬間、月は太陽を完全に覆う(位置はアプリと同じ地上からの見かけの位置)
const at = (body, date, observer) => A.Equator(body, date, observer, false, true);
// A.Equator の赤経は時間(15°/h)、赤緯は度
const dir = e => {
  const ra = e.ra * 15 * (Math.PI / 180);
  const dec = e.dec * (Math.PI / 180);
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.sin(dec), z: Math.cos(dec) * Math.sin(ra) };
};
{
  const sun = at('Sun', solar.peak, dallas),
    moon = at('Moon', solar.peak, dallas);
  const radius = km =>
    (Math.asin(km / (149597870.7 * (km === 695700 ? sun.dist : moon.dist))) * 180) / Math.PI;
  const sunR = radius(695700),
    moonR = radius(1737.4);
  const sep = separationDegrees(dir(sun), dir(moon));
  assert.ok(sep < moonR - sunR, `太陽と月の中心がほぼ重なる (離角 ${sep.toFixed(3)}°)`);
  assert.ok(obscuredFraction(sunR, moonR, sep) > 0.999);
  // 前後1時間は重ならない
  const far = new Date(solar.peak.getTime() + 3600000);
  assert.ok(
    obscuredFraction(
      sunR,
      moonR,
      separationDegrees(dir(at('Sun', far, dallas)), dir(at('Moon', far, dallas))),
    ) < 0.2,
  );
}

// ---- 2022-11-08 の皆既月食(東京で夕方に見えた): 10:59 UTC ごろ ----
const tokyo = new A.Observer(35.68124, 139.76712, 0);
const lunar = nextVisibleLunarEclipse(A, new Date('2022-10-01T00:00:00Z'), tokyo);
assert.equal(lunar.kind, 'total');
assert.ok(
  Math.abs(lunar.peak - new Date('2022-11-08T10:59:00Z')) < 6 * 60000,
  '皆既月食の最大は 10:59 UTC ごろ',
);
assert.ok(lunar.altitude > 0 && lunar.totalBegin < lunar.peak && lunar.peak < lunar.totalEnd);
assert.ok(lunar.partialBegin < lunar.totalBegin && lunar.totalEnd < lunar.partialEnd);
{
  // 影との位置関係は地心で測る(2022-11-08 の影の軸は月の中心から約0.24°)
  const sep = shadowSeparationDegrees(A, lunar.peak);
  assert.ok(sep > 0.15 && sep < 0.35, `最大の離角は約0.24° (${sep.toFixed(3)}°)`);
  assert.ok(sep < UMBRA_RADIUS_DEG);
  assert.ok(umbralMagnitude(0.26, sep) > 0.99, '食分が1を超える深い皆既');
  // 欠け始め(部分食の始まり)は、月の縁が本影の縁に触れる位置
  const begin = shadowSeparationDegrees(A, lunar.partialBegin);
  assert.ok(
    Math.abs(begin - (UMBRA_RADIUS_DEG + 0.26)) < 0.08,
    `部分食の始まりは縁が触れる位置 (${begin.toFixed(3)}°)`,
  );
  // 食でない満月(2022-12-08)は、影から十分離れている
  const plain = shadowSeparationDegrees(A, new Date('2022-12-08T04:08:00Z'));
  assert.ok(plain > PENUMBRA_RADIUS_DEG + 0.3, `食でない満月は影の外 (${plain.toFixed(2)}°)`);
}

// ---- 表示文 ----
assert.equal(formatLocal(new Date('2022-11-08T10:59:00Z'), 9), '2022/11/08 19:59');
assert.ok(describeEclipse(lunar, 9).includes('皆既月食') && describeEclipse(lunar, 9).includes('19:59'));
assert.ok(describeEclipse(solar, -5).includes('皆既日食') && describeEclipse(solar, -5).includes('割合'));
assert.ok(describeEclipse(null, 9).includes('見つかりませんでした'));
// 東京で見える次の日食は、現在の暦で必ず見つかる
const tokyoNext = nextVisibleSolarEclipse(A, new Date('2026-10-11T00:00:00Z'), tokyo);
assert.ok(tokyoNext && tokyoNext.peak > new Date('2026-10-11T00:00:00Z') && tokyoNext.altitude > 0);
console.log('Eclipses: geometry, 2024 total solar (Dallas), 2022 total lunar (Tokyo), shadow geometry: PASS');
