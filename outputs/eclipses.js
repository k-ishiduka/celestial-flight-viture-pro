// 日食・月食: 次に見える食の探索と、食の幾何(重なり・地球の影)の計算。
// 時刻・種類は Astronomy Engine(globalThis.Astronomy)で求める。

const DEG = Math.PI / 180;
export const SOLAR_KIND = { partial: '部分日食', annular: '金環日食', total: '皆既日食' };
export const LUNAR_KIND = { penumbral: '半影月食', partial: '部分月食', total: '皆既月食' };

/** 月食のとき、地球の本影・半影が月の距離で見せる半径(度)。大気による拡大(約2%)を含む近似。 */
export const UMBRA_RADIUS_DEG = 0.7;
export const PENUMBRA_RADIUS_DEG = 1.25;

/** 太陽の円(半径 sunR)のうち、月の円(半径 moonR、中心間距離 d)に隠れている割合。角度の単位は何でもよい。 */
export function obscuredFraction(sunR, moonR, d) {
  if (d >= sunR + moonR) return 0;
  if (d <= Math.abs(sunR - moonR)) return moonR >= sunR ? 1 : (moonR * moonR) / (sunR * sunR);
  const cosSun = (d * d + sunR * sunR - moonR * moonR) / (2 * d * sunR);
  const cosMoon = (d * d + moonR * moonR - sunR * sunR) / (2 * d * moonR);
  const overlap =
    sunR * sunR * Math.acos(cosSun) +
    moonR * moonR * Math.acos(cosMoon) -
    0.5 * Math.sqrt((-d + sunR + moonR) * (d + sunR - moonR) * (d - sunR + moonR) * (d + sunR + moonR));
  return overlap / (Math.PI * sunR * sunR);
}

/** 2つの方向ベクトル(長さは任意)のなす角(度)。 */
export function separationDegrees(a, b) {
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z));
  return Math.acos(Math.min(1, Math.max(-1, dot))) / DEG;
}

/**
 * 地球の影の中心(太陽の反対側)と月の中心の角距離(度)。
 * 影は宇宙空間にあるため、観測者の位置による視差を含まない地心の位置で測る。
 */
export function shadowSeparationDegrees(A, date) {
  const sun = A.GeoVector('Sun', date, true);
  const moon = A.GeoVector('Moon', date, true);
  return separationDegrees({ x: -sun.x, y: -sun.y, z: -sun.z }, moon);
}

/** 月が地球の本影にどれだけ入っているか(0〜1)。月の中心と影の中心の角距離(度)から求める。 */
export function umbralMagnitude(moonRadiusDeg, separationDeg) {
  return Math.min(1, Math.max(0, (UMBRA_RADIUS_DEG + moonRadiusDeg - separationDeg) / (2 * moonRadiusDeg)));
}

const toDate = time => time?.date ?? time ?? null;

/** 地平線より上に見える次の日食(観測地点の地上から見える食)。見つからなければ null。 */
export function nextVisibleSolarEclipse(A, from, observer, maxTries = 16) {
  let info = A.SearchLocalSolarEclipse(from, observer);
  for (let i = 0; i < maxTries; i++) {
    if (info.peak.altitude > 0) {
      return {
        type: 'solar',
        kind: info.kind,
        peak: toDate(info.peak.time),
        altitude: info.peak.altitude,
        obscuration: info.obscuration,
        partialBegin: toDate(info.partial_begin.time),
        partialEnd: toDate(info.partial_end.time),
        totalBegin: info.total_begin ? toDate(info.total_begin.time) : null,
        totalEnd: info.total_end ? toDate(info.total_end.time) : null,
      };
    }
    info = A.NextLocalSolarEclipse(info.peak.time, observer);
  }
  return null;
}

/** 月が地平線より上にある次の月食(半影月食は目立たないので除く)。 */
export function nextVisibleLunarEclipse(A, from, observer, maxTries = 24) {
  let info = A.SearchLunarEclipse(from);
  for (let i = 0; i < maxTries; i++) {
    if (info.kind !== 'penumbral') {
      const moon = A.Equator('Moon', info.peak, observer, true, true);
      const altitude = A.Horizon(info.peak, observer, moon.ra, moon.dec, 'normal').altitude;
      if (altitude > 0) {
        const around = minutes => new Date(toDate(info.peak).getTime() + minutes * 60000);
        return {
          type: 'lunar',
          kind: info.kind,
          peak: toDate(info.peak),
          altitude,
          partialBegin: around(-info.sd_partial),
          partialEnd: around(info.sd_partial),
          totalBegin: info.sd_total > 0 ? around(-info.sd_total) : null,
          totalEnd: info.sd_total > 0 ? around(info.sd_total) : null,
        };
      }
    }
    info = A.NextLunarEclipse(info.peak);
  }
  return null;
}

/** 時差(UTCからの時間)を加えた「年/月/日 時:分」。 */
export function formatLocal(date, timezoneHours) {
  const shifted = new Date(date.getTime() + timezoneHours * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}/${pad(shifted.getUTCMonth() + 1)}/${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** 設定画面に出す説明文。 */
export function describeEclipse(eclipse, timezoneHours) {
  if (!eclipse) return 'この地点で、近いうちに見られる食は見つかりませんでした。';
  const time = date => formatLocal(date, timezoneHours).slice(11);
  const name = (eclipse.type === 'solar' ? SOLAR_KIND : LUNAR_KIND)[eclipse.kind];
  const lines = [
    `${formatLocal(eclipse.peak, timezoneHours)} ごろ ${name}(食の最大。高度 約${Math.round(eclipse.altitude)}°)`,
    `欠け始め ${time(eclipse.partialBegin)} → 最大 ${time(eclipse.peak)} → 終わり ${time(eclipse.partialEnd)}`,
  ];
  if (eclipse.totalBegin) {
    lines.push(
      `${eclipse.type === 'solar' ? (eclipse.kind === 'annular' ? '金環' : '皆既') : '皆既'} ${time(eclipse.totalBegin)} 〜 ${time(eclipse.totalEnd)}`,
    );
  }
  if (eclipse.type === 'solar')
    lines.push(`太陽が隠れる割合(最大) 約${Math.round(eclipse.obscuration * 100)}%`);
  return lines.join(' / ');
}
