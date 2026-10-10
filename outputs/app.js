import { SkyInterface } from './interface.js';
import { SkyEnvironment } from './sky-environment.js';
import { PlanetariumPlanets } from './planets.js';
import { Observer } from './observer.js';
import { Narrator } from './narrator.js';
import * as T from './three.module.js';
import { Experience } from './experience.js';
import { sensorView } from './heading.js';
import { NightMusic } from './music.js';
import { adaptSpeechEngine } from './server-features.js';
const $ = id => document.getElementById(id),
  canvas = $('sky');
const previewMode = new URLSearchParams(location.search).has('preview');
const preferenceIDs = [
  'journey',
  'destination',
  'mode',
  'light',
  'speed',
  'lines',
  'constellationLabels',
  'names',
  'nebula',
  'meteors',
  'fov',
  'depth',
  'trackingAxes',
  'headInvert',
  'headRoll',
  'tourKind',
  'tourInterval',
  'volume',
  'musicTrack',
  'musicOrder',
  'art',
  'artDisplay',
  'artOpacity',
  'speechEngine',
  'neuralVoice',
  'speechRate',
  'guideZoom',
  'starStyle',
  'renderQuality',
  'atmosphere',
  'horizonGuides',
  'latitude',
  'longitude',
];
try {
  let saved = JSON.parse(localStorage.getItem('celestial-preferences') || '{}');
  if (!saved.version || saved.version < 3) {
    saved.trackingAxes = 'nwu';
    saved.headInvert = false;
    saved.headRoll = false;
  }
  if (!saved.version || saved.version < 4) saved.lines = true;
  if (!saved.version || saved.version < 5) {
    saved.trackingAxes = 'nwu';
    saved.headInvert = false;
    saved.headRoll = false;
  }
  if (!saved.version || saved.version < 6) saved.tourKind = 'all';
  if (!saved.version || saved.version < 7) {
    saved.lines = true;
    saved.art = false;
  }
  if (!saved.version || saved.version < 8) saved.artDisplay = saved.art ? 'always' : 'off';
  if (!saved.version || saved.version < 9) saved.constellationLabels = true;
  if (!saved.version || saved.version < 11) saved.atmosphere = false;
  for (let id of preferenceIDs) {
    if (saved[id] !== undefined) {
      let e = $(id);
      if (e.type === 'checkbox') e.checked = saved[id];
      else if (e.tagName !== 'SELECT' || Array.from(e.options).some(o => o.value === saved[id]))
        e.value = saved[id];
    }
  }
} catch {}
document.addEventListener('change', e => {
  if (previewMode || !preferenceIDs.includes(e.target.id)) return;
  try {
    localStorage.setItem(
      'celestial-preferences',
      JSON.stringify({
        version: 11,
        ...Object.fromEntries(
          preferenceIDs.map(id => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value]),
        ),
      }),
    );
  } catch {}
});
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setClearColor(0x010207);
const scene = new T.Scene(),
  camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 30000),
  stereo = new T.StereoCamera();
stereo.eyeSep = 0.12;
let yaw = 0.1,
  pitch = -0.25,
  walk = true,
  elapsed = 0,
  last = 0,
  frames = 0,
  fps = 0,
  sensorAt = 0,
  raw = null,
  zero = null,
  devices = [],
  sound = null;
let seed = 719;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const rad = Math.PI / 180;
function points(pos, colors, sizes, magnitudes = null) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new T.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute(
    'magnitude',
    new T.Float32BufferAttribute(magnitudes || new Float32Array(sizes.length).fill(5), 1),
  );
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: {
      brightness: { value: 1.2 },
      pixel: { value: 1 },
      visibility: { value: 1 },
      ground: { value: 0 },
      natural: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: `attribute vec3 color;attribute float size;attribute float magnitude;varying vec3 c;varying float altitude;varying float shimmer;uniform float pixel;uniform float ground;uniform float natural;uniform float time;void main(){vec3 direction=normalize((modelMatrix*vec4(position,0.)).xyz);altitude=direction.y;c=color*(1.-natural*smoothstep(5.4,7.,magnitude));shimmer=1.+ground*.045*sin(time*(1.7+size*.1)+position.x*.2)*sin(time*2.1+position.z*.1);vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=max(1.,size*pixel);}`,
    fragmentShader: `varying vec3 c;varying float altitude;varying float shimmer;uniform float brightness;uniform float visibility;uniform float ground;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float core=exp(-r*r*8.5);float wing=exp(-r*r*2.5)*.12;float a=(core+wing)*(1.-smoothstep(.78,1.,r));float extinction=mix(1.,smoothstep(-.006,.025,altitude)*(.45+.55*smoothstep(0.,.4,altitude)),ground);gl_FragColor=vec4(c*brightness*shimmer,a*visibility*extinction);
#include <colorspace_fragment>
}`,
  });
  const result = new T.Points(geometry, material);
  result.frustumCulled = false;
  scene.add(result);
  return result;
}
function equatorial(ra, dec, r) {
  ra *= rad;
  dec *= rad;
  return [r * Math.cos(dec) * Math.cos(ra), r * Math.sin(dec), r * Math.cos(dec) * Math.sin(ra)];
}
const catalog = await fetch('./stars.json').then(r => {
  if (!r.ok) throw Error('星データが開けません');
  return r.json();
});
// 恒星の4色(B-V指数で選択)。毎回の文字列解析を避けるため先に作る。
const starPalette = ['#b5d3ff', '#e6edff', '#fff0cf', '#ffc694'].map(hex => new T.Color(hex));
let pos = new Float32Array(catalog.length * 3),
  col = new Float32Array(catalog.length * 3),
  size = new Float32Array(catalog.length),
  magnitudes = new Float32Array(catalog.length);
for (let i = 0; i < catalog.length; i++) {
  const [ra, dec, mag, bv] = catalog[i];
  pos.set(equatorial(ra, dec, 10000), i * 3);
  const k = Math.max(0.075, Math.min(3, Math.pow(2.512, -mag * 0.25)));
  const c = starPalette[bv < 0.1 ? 0 : bv < 0.6 ? 1 : bv < 1.2 ? 2 : 3];
  col[i * 3] = c.r * k;
  col[i * 3 + 1] = c.g * k;
  col[i * 3 + 2] = c.b * k;
  size[i] = Math.max(1.05, 6.8 - mag * 0.6);
  magnitudes[i] = mag;
}
const stars = points(pos, col, size, magnitudes);
// Fine points form the Milky Way; no diffuse cloud or nebula layer.
const milkyWayCount = 145000;
pos = new Float32Array(milkyWayCount * 3);
col = new Float32Array(milkyWayCount * 3);
size = new Float32Array(milkyWayCount);
let milkyWayUsed = 0;
function gaussian() {
  return Math.sqrt(-2 * Math.log(Math.max(0.00001, rnd()))) * Math.cos(2 * Math.PI * rnd());
}
for (let i = 0; i < milkyWayCount; i++) {
  const l = rnd() < 0.3 ? gaussian() * 0.55 : rnd() * Math.PI * 2;
  const b = gaussian() * (rnd() < 0.8 ? 0.065 : 0.16);
  // The dark galactic lane is expressed through fewer stars, never through fog.
  if (Math.abs(b + 0.012 * Math.sin(l * 3)) < 0.013 && rnd() < 0.7) continue;
  const x = Math.cos(b) * Math.cos(l),
    y = Math.cos(b) * Math.sin(l),
    z = Math.sin(b);
  const ex = -0.05487556 * x + 0.49410943 * y - 0.86766615 * z,
    ey = -0.87343709 * x - 0.44482963 * y - 0.19807637 * z,
    ez = -0.48383502 * x + 0.74698224 * y + 0.45598378 * z;
  const at = milkyWayUsed++;
  pos[at * 3] = ex * 11000;
  pos[at * 3 + 1] = ez * 11000;
  pos[at * 3 + 2] = ey * 11000;
  const strength = 0.08 + Math.pow(rnd(), 2) * 0.32,
    temperature = rnd();
  col[at * 3] = strength * (temperature < 0.25 ? 1 : 0.8);
  col[at * 3 + 1] = strength * 0.9;
  col[at * 3 + 2] = strength * (temperature > 0.65 ? 1.15 : 0.85);
  size[at] = 0.9 + rnd() * 0.8;
}
pos = pos.slice(0, milkyWayUsed * 3);
col = col.slice(0, milkyWayUsed * 3);
size = size.slice(0, milkyWayUsed);
const milkyWay = points(pos, col, size);
milkyWay.visible = $('nebula').checked;
$('nebula').onchange = () => (milkyWay.visible = $('nebula').checked);
pos = [];
col = [];
size = [];
for (let i = 0; i < 1000; i++) {
  pos.push((rnd() - 0.5) * 180, (rnd() - 0.5) * 100, -rnd() * 400);
  col.push(0.04, 0.075, 0.095);
  size.push(1 + rnd() * 2);
}
const dust = points(pos, col, size);
dust.visible = false;
const experience = new Experience(scene, camera, renderer);
const observer = new Observer(scene, camera, message => experience.notice(message));
experience.observer = observer;
experience.catalog = catalog;
experience.catalogPositions = stars.geometry.attributes.position.array;
camera.fov = +$('fov').value;
camera.updateProjectionMatrix();
const planets = new PlanetariumPlanets(scene, observer, experience);
const solarStars = stars.clone(),
  solarMilkyWay = milkyWay.clone();
planets.solarScene.add(solarStars, solarMilkyWay);
const environment = new SkyEnvironment(scene, camera, observer);
experience.environment = environment;
const interfaceView = new SkyInterface(experience, observer, planets);
const headEuler = new T.Euler(0, 0, 0, 'YXZ'),
  headOrientation = new T.Quaternion();
// 軽量モード: 暗い星(7等より暗い星)を描画から外し、天の川の点を間引く。
// 肉眼で見える星は約5,000個(6等まで)なので、見た目への影響は小さい。
const LIGHT_STAR_LIMIT_MAGNITUDE = 7;
const LIGHT_MILKY_WAY_RATIO = 0.3;
const lightStarIndex = (() => {
  const keep = [];
  for (let i = 0; i < catalog.length; i++) if (catalog[i][2] <= LIGHT_STAR_LIMIT_MAGNITUDE) keep.push(i);
  return new T.Uint32BufferAttribute(keep, 1);
})();
const milkyWayPointCount = milkyWay.geometry.attributes.position.count;
function applyQuality() {
  const light = $('renderQuality').value === 'light';
  stars.geometry.setIndex(light ? lightStarIndex : null);
  milkyWay.geometry.setDrawRange(
    0,
    light ? Math.floor(milkyWayPointCount * LIGHT_MILKY_WAY_RATIO) : Infinity,
  );
}
$('renderQuality').addEventListener('change', applyQuality);
applyQuality();
function resize() {
  let s = $('mode').value === 'sbs';
  renderer.setPixelRatio(s ? 1 : $('renderQuality').value === 'fine' ? Math.min(devicePixelRatio, 2) : 1);
  renderer.setSize(s ? 3840 : innerWidth, s ? 1080 : innerHeight, false);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  camera.aspect = s ? 16 / 9 : innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  planets.solarCamera.aspect = camera.aspect;
  planets.solarCamera.updateProjectionMatrix();
  for (let p of [stars, milkyWay, dust]) p.material.uniforms.pixel.value = renderer.getPixelRatio();
}
resize();
addEventListener('resize', resize);
$('mode').onchange = resize;
$('renderQuality').onchange = resize;
// 低fpsが続く場合に1回だけ軽量モードへ切り替える(非表示タブでは判定しない)。
let slowSeconds = 0,
  autoLightTried = false;
function watchPerformance(currentFps) {
  if (autoLightTried || previewMode || document.visibilityState !== 'visible') {
    slowSeconds = 0;
    return;
  }
  const quality = $('renderQuality');
  slowSeconds = currentFps < 24 ? slowSeconds + 1 : 0;
  if (slowSeconds < 5 || quality.value === 'light') return;
  autoLightTried = true;
  quality.value = 'light';
  quality.dispatchEvent(new Event('change', { bubbles: true }));
  experience.notice('動作が重いため「軽量」描画に切り替えました。設定の「描画品質」で戻せます。');
}
function frame(t) {
  let clockDelta = last ? Math.max(0, (t - last) / 1000) : 0;
  let dt = Math.min(0.05, clockDelta);
  last = t;
  if (walk) elapsed += dt;
  observer.update(clockDelta);
  [yaw, pitch] = experience.steer(dt, yaw, pitch, walk);
  let live = raw && t - sensorAt < 1500;
  let sy = 0,
    sp = 0,
    sr = 0;
  if (live && zero) {
    const view = sensorView(raw, zero, {
      format: $('trackingAxes').value,
      invertYaw: $('headInvert').checked,
      allowRoll: $('headRoll').checked,
    });
    sy = view.yaw;
    sp = view.pitch;
    sr = view.roll;
  }
  camera.rotation.order = 'YXZ';
  camera.rotation.set(pitch + sp * rad, yaw + sy * rad, -sr * rad);
  headOrientation.setFromEuler(headEuler.set(sp * rad, sy * rad, -sr * rad));
  experience.guide.update(camera, dt, headOrientation);
  experience.pilotYaw = yaw;
  experience.pilotPitch = pitch;
  experience.update(dt, t, walk);
  observer.apply(stars);
  observer.apply(milkyWay);
  observer.apply(experience.sky);
  planets.update(dt, headOrientation);
  observer.apply(planets.sky);
  environment.update(dt, planets.mode === 'solar');
  if (observer.active) {
    planets.skySun.visible = false;
    planets.sunSkyLabel.visible = false;
  }
  interfaceView.update(dt, t, live);
  const renderScene = planets.mode === 'solar' ? planets.solarScene : scene,
    renderCamera = planets.mode === 'solar' ? planets.solarCamera : camera;
  stereo.eyeSep = +$('depth').value;

  const lightMode = $('renderQuality').value === 'light';
  for (const p of [stars, milkyWay, dust]) {
    const u = p.material.uniforms;
    u.brightness.value =
      +$('light').value * (p === milkyWay ? (lightMode ? 1.6 : 0.8) : p === stars ? 2.2 : 1);
    u.visibility.value = environment.starVisibility;
    u.ground.value = observer.active && planets.mode !== 'solar' ? 1 : 0;
    u.natural.value = $('starStyle').value === 'natural' ? 1 : 0;
    u.time.value = t / 1000;
  }
  milkyWay.visible = solarMilkyWay.visible = $('nebula').checked && $('starStyle').value !== 'natural';
  renderer.setScissorTest(false);
  renderer.clear();
  if ($('mode').value === 'sbs') {
    renderCamera.updateMatrixWorld();
    stereo.aspect = 1;
    stereo.update(renderCamera);
    stereo.cameraL.projectionMatrix.elements[9] = renderCamera.projectionMatrix.elements[9];
    stereo.cameraR.projectionMatrix.elements[9] = renderCamera.projectionMatrix.elements[9];
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, 1920, 1080);
    renderer.setScissor(0, 0, 1920, 1080);
    renderer.render(renderScene, stereo.cameraL);
    renderer.setViewport(1920, 0, 1920, 1080);
    renderer.setScissor(1920, 0, 1920, 1080);
    renderer.render(renderScene, stereo.cameraR);
  } else {
    renderer.setViewport(
      0,
      0,
      canvas.width / renderer.getPixelRatio(),
      canvas.height / renderer.getPixelRatio(),
    );
    renderer.render(renderScene, renderCamera);
  }
  experience.afterRender();
  frames++;
  if (t - fps > 1000) {
    $('status').textContent =
      `${catalog.length.toLocaleString()} stars · ${Math.round((frames * 1000) / (t - fps))} fps\n${canvas.width} × ${canvas.height} · ${planets.mode === 'solar' ? '太陽系の軌道と自転' : experience.description()}${Number($('timeFlow').value) || planets.mode !== 'off' ? ' · ' + $('date').value.replace('T', ' ') : ''}\n${live ? '頭の動きに追従中' : devices.length ? 'センサー信号を待機中' : 'ドラッグで見渡せます'}`;
    watchPerformance(Math.round((frames * 1000) / (t - fps)));
    fps = t;
    frames = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
let dragging = false,
  x = 0,
  y = 0,
  dragDistance = 0;
canvas.onpointerdown = e => {
  dragging = true;
  dragDistance = 0;
  x = e.clientX;
  y = e.clientY;
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = e => {
  if (!dragging) return;
  dragDistance += Math.abs(e.clientX - x) + Math.abs(e.clientY - y);
  if (planets.mode === 'solar') {
    planets.drag(e.clientX - x, e.clientY - y);
    x = e.clientX;
    y = e.clientY;
    return;
  }
  experience.cancelTurn();
  if (!experience.narrator.speaking) experience.guide.interrupt();
  yaw += (e.clientX - x) * 0.003;
  pitch = T.MathUtils.clamp(pitch + (e.clientY - y) * 0.003, -1.4, 1.4);
  x = e.clientX;
  y = e.clientY;
};
canvas.onpointerup = () => {
  dragging = false;
  if (dragDistance < 4) $('ui').classList.remove('hidden');
};
canvas.onpointercancel = () => (dragging = false);
canvas.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    experience.cancelTurn();
    if (!experience.narrator.speaking) experience.guide.interrupt();
    const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (planets.mode === 'solar') {
      planets.zoom(pixels);
      return;
    }
    const step = T.MathUtils.clamp(pixels, -45, 45);
    camera.fov = T.MathUtils.clamp(camera.fov * Math.exp(step * 0.012), 8, 100);
    camera.updateProjectionMatrix();
    $('fov').value = camera.fov;
  },
  { passive: false },
);
function recenter() {
  zero = raw?.slice() || null;
  experience.go($('destination').value);
}
function togglePause() {
  walk = !walk;
  $('pause').textContent = walk ? '航行を止める' : '航行を再開';
}
async function full() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (e) {
    $('status').textContent = '全画面はブラウザの表示メニューから選べます';
  }
}
$('start').onclick = async () => {
  await full();
  if (document.fullscreenElement) $('ui').classList.add('hidden');
};
$('hide').onclick = () => $('ui').classList.add('hidden');
$('center').onclick = recenter;
$('pause').onclick = togglePause;
$('info').onclick = () => ($('help').style.display = 'block');
$('close').onclick = () => ($('help').style.display = 'none');
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
  if (e.code === 'KeyH') $('ui').classList.toggle('hidden');
  if (e.code === 'KeyR') recenter();
  if (e.code === 'KeyF') full();
  if (e.code === 'Space') {
    e.preventDefault();
    togglePause();
  }
});
const music = new NightMusic(message => experience.notice(message));
experience.narrator = new Narrator(experience, music);
adaptSpeechEngine();
// Pro-only WebHID transport, retaining the already-granted Chrome permission.
let reportCount = 0,
  validCount = 0,
  lastPacket = '',
  hidError = '';
function command(enabled) {
  let b = new Uint8Array(20);
  b.set([255, 254, 0, 0, 14, 0]);
  b[14] = 21;
  b[16] = 1;
  b[18] = enabled ? 1 : 0;
  b[19] = 3;
  let crc = 65535;
  for (let i = 4; i < b.length; i++) {
    crc ^= b[i] << 8;
    for (let j = 0; j < 8; j++) crc = ((crc << 1) ^ (crc & 32768 ? 0x1021 : 0)) & 65535;
  }
  b[2] = crc >> 8;
  b[3] = crc & 255;
  return b;
}
function receive(e) {
  reportCount++;
  let v = e.data;
  lastPacket =
    `report ${e.reportId} / ${v.byteLength} bytes / ` +
    Array.from(new Uint8Array(v.buffer, v.byteOffset, Math.min(6, v.byteLength)))
      .map(n => n.toString(16).padStart(2, '0'))
      .join(' ');
  let shift = 0;
  if (v.byteLength >= 30 && v.getUint8(0) === 255 && v.getUint8(1) === 252) shift = 18;
  else if (e.reportId === 255 && v.byteLength >= 29 && v.getUint8(0) === 252) shift = 17;
  else return;
  let a = [shift, shift + 4, shift + 8].map(i => v.getFloat32(i, false));
  if (a.some(n => !Number.isFinite(n) || Math.abs(n) > 180)) return;
  raw = a;
  if (!zero) zero = a.slice();
  validCount++;
  sensorAt = performance.now();
}
function outputReports(collections) {
  return collections.flatMap(c => [...(c.outputReports || []), ...outputReports(c.children || [])]);
}
async function sendIMU(d, enabled) {
  let reports = outputReports(d.collections);
  let packet = command(enabled);
  if (!reports.length) {
    await d.sendReport(0, packet);
    return;
  }
  let successes = 0;
  for (let report of reports) {
    let bits = (report.items || []).reduce((n, i) => n + i.reportSize * i.reportCount, 0);
    let len = Math.ceil(bits / 8) || 64;
    if (len < 20) continue;
    let data = new Uint8Array(len);
    data.set(packet);
    try {
      await d.sendReport(report.reportId, data);
      successes++;
    } catch (e) {
      hidError = e.message;
    }
  }
  if (!successes) throw Error('IMUコマンドを送信できません: ' + hidError);
}
let openingAuthorized = null;
async function openAuthorized() {
  if (openingAuthorized) return openingAuthorized;
  openingAuthorized = (async () => {
    let authorized = await navigator.hid.getDevices();
    for (let d of authorized.filter(d => d.vendorId === 0x35ca && [0x1019, 0x101d].includes(d.productId))) {
      if (devices.includes(d)) continue;
      try {
        if (!d.opened) await d.open();
        d.removeEventListener('inputreport', receive);
        d.addEventListener('inputreport', receive);
        devices.push(d);
        await sendIMU(d, true);
      } catch (e) {
        hidError = e.message;
      }
    }
    $('track').textContent = devices.length ? '追従を切断' : '頭の動きに接続';
  })();
  try {
    await openingAuthorized;
  } finally {
    openingAuthorized = null;
  }
}
$('track').onclick = async () => {
  try {
    if (!navigator.hid) throw Error('Chromeで開くと接続できます');
    if (devices.length) {
      for (let d of devices) {
        try {
          await sendIMU(d, false);
          d.removeEventListener('inputreport', receive);
          await d.close();
        } catch {}
      }
      devices = [];
      raw = zero = null;
      $('track').textContent = '頭の動きに接続';
      return;
    }
    let picked = await navigator.hid.requestDevice({
      filters: [
        { vendorId: 0x35ca, productId: 0x1019 },
        { vendorId: 0x35ca, productId: 0x101d },
      ],
    });
    if (!picked.length) return;
    await openAuthorized();
    if (!devices.length) throw Error('センサーを開けませんでした。SpaceWalkerを終了して再試行してください');
  } catch (e) {
    hidError = e.message;
    experience.notice(e.message);
  }
};
navigator.hid?.addEventListener('disconnect', e => {
  devices = devices.filter(d => d !== e.device);
  if (!devices.length) {
    raw = zero = null;
    $('track').textContent = '頭の動きに接続';
  }
});
if (navigator.hid && !previewMode)
  openAuthorized().catch(e => {
    hidError = e.message;
  });
setInterval(() => {
  $('diagnostics').textContent =
    `接続 ${devices.length} / 受信 ${reportCount} / 有効角度 ${validCount}\n${lastPacket}${hidError ? '\n' + hidError : ''}`;
}, 1000);
window.addEventListener('error', e => {
  experience.notice('表示エラー: ' + e.message);
});

let hidBusy = false,
  lastRecovery = 0,
  wantsTracking = true;
async function recoverTracking() {
  if (previewMode || hidBusy || !wantsTracking || !navigator.hid) return;
  hidBusy = true;
  try {
    if (!devices.length) await openAuthorized();
    else if (performance.now() - sensorAt > 2500) {
      for (const d of devices) {
        if (!d.opened) await d.open();
        d.removeEventListener('inputreport', receive);
        d.addEventListener('inputreport', receive);
        await sendIMU(d, true);
      }
    }
  } catch (e) {
    hidError = e.message;
  } finally {
    hidBusy = false;
    lastRecovery = performance.now();
  }
}
navigator.hid?.addEventListener('connect', () => recoverTracking());
window.addEventListener('pageshow', () => recoverTracking());
setInterval(() => {
  if (performance.now() - lastRecovery > 4000 && performance.now() - sensorAt > 2500) recoverTracking();
}, 1500);
const originalTrackingClick = $('track').onclick;
$('track').onclick = async () => {
  wantsTracking = !devices.length;
  await originalTrackingClick();
};
function zoomTarget() {
  if (planets.mode === 'solar') {
    planets.zoom(-150);
    return;
  }
  experience.narrator.stop();
  experience.focus.enabled = false;
  const kind = $('inspectTarget').value;
  if (kind === 'star') {
    const star = experience.nearestCatalogStar(camera.getWorldDirection(new T.Vector3()));
    if (star) {
      experience.guide.lock('star', [star.ra, star.dec]);
      experience.notice((star.display || '星') + 'を拡大');
    }
  } else {
    experience.focus.pick(false);
    const item = experience.focus.active;
    if (item) {
      experience.guide.lock(item.id, [item.ra, item.dec]);
      experience.notice(item.name + 'を拡大');
    }
  }
}
let lastTap = 0;
canvas.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse' || dragDistance > 8) return;
  const now = performance.now();
  if (now - lastTap < 350) zoomTarget();
  lastTap = now;
});
canvas.addEventListener('dblclick', e => {
  e.preventDefault();
  zoomTarget();
});
canvas.addEventListener('pointerdown', () => {
  if (!experience.narrator.speaking) experience.guide.release();
});
canvas.addEventListener('wheel', () => {
  if (!experience.narrator.speaking) experience.guide.release();
});
