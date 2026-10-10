// 主な流星群(放射点・極大日・出現数)と、空に流す流星の計算。
// 数値は国際流星機構(IMO)の流星群カレンダー等にもとづく目安で、年によって極大は前後する。
import * as T from './three.module.js';

/**
 * ra/dec: 放射点(度)。peak: 極大の月・日。zhr: 極大時の1時間あたりの出現数(理想条件)。
 * width: 活動の広がり(日)。極大から離れるほどガウス分布で減る。speed: 大気圏突入速度(km/s)。
 * bestHour: 放射点が高く昇って見ごろになる現地時刻(時)。12時より前なら、極大の日の夜が明けた翌朝。
 */
export const SHOWERS = [
  {
    id: 'quadrantids',
    name: 'しぶんぎ座流星群',
    radiant: 'りゅう座',
    ra: 230,
    dec: 49,
    peak: [1, 3],
    zhr: 110,
    width: 0.6,
    speed: 41,
    bestHour: 4,
  },
  {
    id: 'lyrids',
    name: 'こと座流星群',
    radiant: 'こと座',
    ra: 271,
    dec: 34,
    peak: [4, 22],
    zhr: 18,
    width: 2,
    speed: 49,
    bestHour: 3,
  },
  {
    id: 'eta-aquariids',
    name: 'みずがめ座η流星群',
    radiant: 'みずがめ座',
    ra: 338,
    dec: -1,
    peak: [5, 6],
    zhr: 50,
    width: 4,
    speed: 66,
    bestHour: 4,
  },
  {
    id: 'perseids',
    name: 'ペルセウス座流星群',
    radiant: 'ペルセウス座',
    ra: 48,
    dec: 58,
    peak: [8, 12],
    zhr: 100,
    width: 3,
    speed: 59,
    bestHour: 2,
  },
  {
    id: 'draconids',
    name: 'りゅう座流星群',
    radiant: 'りゅう座',
    ra: 262,
    dec: 54,
    peak: [10, 8],
    zhr: 10,
    width: 0.5,
    speed: 20,
    bestHour: 20,
  },
  {
    id: 'orionids',
    name: 'オリオン座流星群',
    radiant: 'オリオン座',
    ra: 95,
    dec: 16,
    peak: [10, 21],
    zhr: 20,
    width: 3,
    speed: 66,
    bestHour: 2,
  },
  {
    id: 'leonids',
    name: 'しし座流星群',
    radiant: 'しし座',
    ra: 152,
    dec: 22,
    peak: [11, 17],
    zhr: 15,
    width: 1,
    speed: 71,
    bestHour: 4,
  },
  {
    id: 'geminids',
    name: 'ふたご座流星群',
    radiant: 'ふたご座',
    ra: 112,
    dec: 33,
    peak: [12, 14],
    zhr: 150,
    width: 2,
    speed: 35,
    bestHour: 2,
  },
  {
    id: 'ursids',
    name: 'こぐま座流星群',
    radiant: 'こぐま座',
    ra: 217,
    dec: 76,
    peak: [12, 22],
    zhr: 10,
    width: 1.2,
    speed: 33,
    bestHour: 5,
  },
];

/** この活動度(極大の何割か)を下回る流星群は「活動中」とみなさない。 */
export const ACTIVE_THRESHOLD = 0.1;
const DAY = 86400000;
/** 画面で見やすいよう、実際の出現数の約4倍の頻度で流す(演出)。 */
const VISUAL_BOOST = 4;
const MAX_PER_MINUTE = 14;
const MIN_PER_MINUTE_WHEN_ACTIVE = 1;
export const SKY_RADIUS = 9000;

/** 日付と、その年の極大日との差(日)。年をまたぐ流星群(しぶんぎ座など)も近い方を取る。 */
export function daysFromPeak(shower, date) {
  const year = date.getUTCFullYear();
  let best = Infinity;
  for (const y of [year - 1, year, year + 1]) {
    const peak = Date.UTC(y, shower.peak[0] - 1, shower.peak[1], 12);
    const diff = (date.getTime() - peak) / DAY;
    if (Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

/** 極大を1.0とした活動度(0〜1)。 */
export function activityLevel(shower, date) {
  const d = daysFromPeak(shower, date);
  return Math.exp(-0.5 * (d / shower.width) ** 2);
}

/** 活動中の流星群を、活動度の高い順に返す。 */
export function activeShowers(date) {
  return SHOWERS.map(shower => ({ shower, level: activityLevel(shower, date) }))
    .filter(item => item.level >= ACTIVE_THRESHOLD)
    .sort((a, b) => b.level - a.level);
}

/** 日付より後に最初に極大を迎える流星群と、その日数。 */
export function nextShower(date) {
  let best = null;
  for (const shower of SHOWERS) {
    let d = -daysFromPeak(shower, date);
    if (d <= 0) d += 365.25;
    if (!best || d < best.days) best = { shower, days: d };
  }
  return best;
}

/** 設定値('off' / 'auto' / 流星群ID)と日付から、流す流星群と活動度を決める。 */
export function chooseShower(mode, date) {
  if (mode === 'off') return null;
  if (mode === 'auto') return activeShowers(date)[0] ?? null;
  const shower = SHOWERS.find(s => s.id === mode);
  // 流星群を直接選んだときは、日付に関係なく極大の活動度で流す
  return shower ? { shower, level: 1 } : null;
}

/** 1分あたりに流す流星の数(演出込み)。 */
export function meteorsPerMinute(shower, level) {
  const perMinute = ((shower.zhr * level) / 60) * VISUAL_BOOST;
  return Math.min(MAX_PER_MINUTE, Math.max(MIN_PER_MINUTE_WHEN_ACTIVE, perMinute));
}

export function formatPeak(shower) {
  return `${shower.peak[0]}/${shower.peak[1]}頃`;
}

/** 状態表示の文章。 */
export function describeShower(mode, date) {
  if (mode === 'off') return '流星群の表示は切ってあります。';
  const chosen = chooseShower(mode, date);
  if (!chosen) {
    const next = nextShower(date);
    return `この日時に活動中の主な流星群はありません。次は${next.shower.name}(${formatPeak(next.shower)}、あと約${Math.round(next.days)}日)です。`;
  }
  const { shower, level } = chosen;
  const percent = Math.round(level * 100);
  const hourly = Math.round(shower.zhr * level);
  return `${shower.name} · 放射点は${shower.radiant}(極大 ${formatPeak(shower)}) · 活動 ${percent}%(理想的な空で1時間に約${hourly}個)。流れ星の頻度は見やすく約${VISUAL_BOOST}倍にしています。`;
}

// ---- 流星の生成と動き ----

const toVector = (raDeg, decDeg, radius = 1) => {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return new T.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.sin(dec),
    Math.cos(dec) * Math.sin(ra),
  ).multiplyScalar(radius);
};

/**
 * 放射点から離れる向きに流れる流星を1つ作る。
 * isVisible(単位ベクトル) が false の位置(地平線の下など)は避ける。
 */
export function createMeteor(shower, random = Math.random, isVisible = () => true) {
  const radiant = toVector(shower.ra, shower.dec);
  for (let attempt = 0; attempt < 12; attempt++) {
    // 放射点から8°〜85°離れた位置に、一様な向きで出現させる
    const distance = ((8 + random() * 77) * Math.PI) / 180;
    const around = random() * Math.PI * 2;
    const helper = Math.abs(radiant.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
    const east = new T.Vector3().crossVectors(helper, radiant).normalize();
    const north = new T.Vector3().crossVectors(radiant, east).normalize();
    const away = east.clone().multiplyScalar(Math.cos(around)).addScaledVector(north, Math.sin(around));
    const start = radiant
      .clone()
      .multiplyScalar(Math.cos(distance))
      .addScaledVector(away, Math.sin(distance));
    if (!isVisible(start)) continue;
    // 放射点と出現位置を通る大円に沿って、放射点から遠ざかる向きの接線(出現位置と直交する単位ベクトル)
    const tangent = away
      .clone()
      .multiplyScalar(Math.cos(distance))
      .addScaledVector(radiant, -Math.sin(distance));
    const fast = shower.speed / 70;
    return {
      start,
      tangent,
      length: ((5 + random() * 18) * (0.6 + fast * 0.6) * Math.PI) / 180,
      duration: 0.55 + random() * 0.6 - fast * 0.2,
      age: 0,
    };
  }
  return null;
}

/** 流星の頭の位置(単位ベクトル)。progress は 0〜1。 */
export function meteorPosition(meteor, angle, target = new T.Vector3()) {
  return target
    .copy(meteor.start)
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(meteor.tangent, Math.sin(angle));
}

const MAX_METEORS = 16;
const TAIL_SEGMENTS = 10;
// WebGL の線は1ピクセル幅なので、少しずらした3本を重ねて太く見せる
const LINE_OFFSETS = [-1, 0, 1];
const LINE_SPREAD = 3.5;

/** 先頭の光る点に使う、やわらかい円のテクスチャ。 */
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(190,215,255,0.7)');
  gradient.addColorStop(1, 'rgba(120,160,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(canvas);
}

export class MeteorShowerSky {
  constructor(group, observer, getMode) {
    this.observer = observer;
    this.getMode = getMode;
    this.meteors = [];
    this.wait = 1;
    const segments = MAX_METEORS * TAIL_SEGMENTS * LINE_OFFSETS.length;
    this.positions = new Float32Array(segments * 6);
    this.colors = new Float32Array(segments * 6);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(this.positions, 3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('color', new T.BufferAttribute(this.colors, 3).setUsage(T.DynamicDrawUsage));
    this.lines = new T.LineSegments(
      geometry,
      new T.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.lines.frustumCulled = false;
    group.add(this.lines);

    this.headPositions = new Float32Array(MAX_METEORS * 3);
    this.headColors = new Float32Array(MAX_METEORS * 3);
    const headGeometry = new T.BufferGeometry();
    headGeometry.setAttribute(
      'position',
      new T.BufferAttribute(this.headPositions, 3).setUsage(T.DynamicDrawUsage),
    );
    headGeometry.setAttribute(
      'color',
      new T.BufferAttribute(this.headColors, 3).setUsage(T.DynamicDrawUsage),
    );
    this.heads = new T.Points(
      headGeometry,
      new T.PointsMaterial({
        size: 9,
        sizeAttenuation: false,
        map: glowTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.heads.frustumCulled = false;
    group.add(this.heads);
    this.a = new T.Vector3();
    this.b = new T.Vector3();
    this.side = new T.Vector3();
  }

  /** 地上観測のときは、地平線より上の空だけに流す。 */
  isVisible(direction) {
    if (!this.observer?.active) return true;
    this.a.copy(direction).applyMatrix4(this.observer.matrix);
    return this.a.y > 0.05;
  }

  update(dt) {
    const chosen = chooseShower(this.getMode(), this.observer?.date ?? new Date());
    if (chosen) {
      this.wait -= dt;
      if (this.wait <= 0 && this.meteors.length < MAX_METEORS) {
        const meteor = createMeteor(chosen.shower, Math.random, direction => this.isVisible(direction));
        if (meteor) this.meteors.push(meteor);
        const perMinute = meteorsPerMinute(chosen.shower, chosen.level);
        // 流星の間隔にはばらつきを持たせる
        this.wait = (60 / perMinute) * (0.4 + Math.random() * 1.2);
      }
    } else {
      this.meteors.length = 0;
    }

    this.positions.fill(0);
    this.colors.fill(0);
    this.headPositions.fill(0);
    this.headColors.fill(0);
    let segment = 0;
    for (const meteor of this.meteors) meteor.age += dt;
    this.meteors = this.meteors.filter(meteor => meteor.age < meteor.duration);
    this.meteors.forEach((meteor, index) => {
      const progress = meteor.age / meteor.duration;
      const headAngle = meteor.length * (1 - (1 - progress) ** 2);
      const tail = Math.min(headAngle, meteor.length * 0.45);
      const envelope = Math.sin(progress * Math.PI);
      for (const offset of LINE_OFFSETS) {
        for (let i = 0; i < TAIL_SEGMENTS; i++) {
          const from = headAngle - (tail * (i + 1)) / TAIL_SEGMENTS;
          const to = headAngle - (tail * i) / TAIL_SEGMENTS;
          meteorPosition(meteor, from, this.a).multiplyScalar(SKY_RADIUS);
          meteorPosition(meteor, to, this.b).multiplyScalar(SKY_RADIUS);
          // 進行方向と直交する向きへずらす
          this.side.crossVectors(meteor.start, meteor.tangent).multiplyScalar(offset * LINE_SPREAD);
          this.a.add(this.side);
          this.b.add(this.side);
          const base = segment * 6;
          this.a.toArray(this.positions, base);
          this.b.toArray(this.positions, base + 3);
          const fade = (1 - i / TAIL_SEGMENTS) * envelope * (offset === 0 ? 1 : 0.55);
          this.colors.set([0.55 * fade, 0.7 * fade, 1 * fade, 0.55 * fade, 0.7 * fade, 1 * fade], base);
          segment++;
        }
      }
      meteorPosition(meteor, headAngle, this.a)
        .multiplyScalar(SKY_RADIUS)
        .toArray(this.headPositions, index * 3);
      this.headColors.set([envelope, envelope, envelope], index * 3);
    });
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, segment * 2);
    this.heads.geometry.attributes.position.needsUpdate = true;
    this.heads.geometry.attributes.color.needsUpdate = true;
    this.heads.geometry.setDrawRange(0, this.meteors.length);
  }
}

/**
 * 極大の夜の見ごろの日時(現地時刻)。year はその年の極大を使う。
 * @returns {{year:number, month:number, day:number, hour:number}}
 */
export function peakNight(shower, year) {
  const [month, day] = shower.peak;
  const date = new Date(Date.UTC(year, month - 1, day + (shower.bestHour < 12 ? 1 : 0)));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: shower.bestHour,
  };
}
