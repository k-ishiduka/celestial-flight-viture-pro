import { GuidedView } from './guided-view.js?v=29';
import { starReadings } from './star-readings.js';
import { ConstellationFocus } from './constellation-focus.js?v=29';
import { createConstellationArt, loadConstellationIllustration } from './constellation-art.js?v=29';
import * as T from './three.module.js';
const $ = id => document.getElementById(id),
  r = Math.PI / 180;
const eq = (ra, dec, radius = 10000) =>
  new T.Vector3(
    radius * Math.cos(dec * r) * Math.cos(ra * r),
    radius * Math.sin(dec * r),
    radius * Math.cos(dec * r) * Math.sin(ra * r),
  );
const routes = {
  core: [266.4, -28.9, '天の川の中心 / いて座', '銀河面に沿って、光と暗黒帯が重なる方向へ。'],
  cygnus: [305, 40, 'はくちょう座 / 夏の天の川', 'デネブの周りから、天の川を見渡す。'],
  orion: [83.8, -5.4, 'オリオン座', '三つ星と、赤いベテルギウス・青いリゲル。'],
  pleiades: [56.75, 24.12, 'プレアデス / すばる', 'おうし座の中に集まる、小さな星の群れ。'],
  andromeda: [10.68, 41.27, 'アンドロメダの方向', '秋の星々が広がる、北の空の方向へ。'],
};
const jp = {
  Sirius: 'シリウス',
  Canopus: 'カノープス',
  Arcturus: 'アークトゥルス',
  Vega: 'ベガ',
  Capella: 'カペラ',
  Rigel: 'リゲル',
  Procyon: 'プロキオン',
  Betelgeuse: 'ベテルギウス',
  Altair: 'アルタイル',
  Aldebaran: 'アルデバラン',
  Antares: 'アンタレス',
  Spica: 'スピカ',
  Pollux: 'ポルックス',
  Fomalhaut: 'フォーマルハウト',
  Deneb: 'デネブ',
  Regulus: 'レグルス',
  Polaris: '北極星',
  Alcyone: 'アルキオネ',
  Castor: 'カストル',
  Sadr: 'サドル',
  Albireo: 'アルビレオ',
  Alpheratz: 'アルフェラッツ',
  Caph: 'カフ',
  Algenib: 'アルゲニブ',
  Mirach: 'ミラク',
  Algol: 'アルゴル',
  Mirfak: 'ミルファク',
  Hamal: 'ハマル',
  Elnath: 'エルナト',
  Bellatrix: 'ベラトリックス',
  Mintaka: 'ミンタカ',
  Alnilam: 'アルニラム',
  Alnitak: 'アルニタク',
  Saiph: 'サイフ',
  Menkalinan: 'メンカリナン',
  Alhena: 'アルヘナ',
  Adhara: 'アダーラ',
  Gomeisa: 'ゴメイサ',
  Alphard: 'アルファルド',
  Algieba: 'アルギエバ',
  Merak: 'メラク',
  Dubhe: 'ドゥーベ',
  Denebola: 'デネボラ',
  Phecda: 'フェクダ',
  Megrez: 'メグレズ',
  Alioth: 'アリオト',
  Mizar: 'ミザール',
  Alkaid: 'アルカイド',
  'Cor Caroli': 'コル・カロリ',
  Acrux: 'アクルックス',
  Gacrux: 'ガクルックス',
  Mimosa: 'ミモザ',
  Hadar: 'ハダル',
  Izar: 'イザル',
  Kochab: 'コカブ',
  Pherkad: 'フェルカド',
  Alphecca: 'アルフェッカ',
  Rasalgethi: 'ラス・アルゲティ',
  Rasalhague: 'ラス・アルハゲ',
  Shaula: 'シャウラ',
  Sargas: 'サルガス',
  Nunki: 'ヌンキ',
  Tarazed: 'タラゼド',
  Enif: 'エニフ',
  Scheat: 'シェアト',
  Markab: 'マルカブ',
  Errai: 'エライ',
};
function angle(v) {
  v = v.clone().normalize();
  return { yaw: Math.atan2(-v.x, -v.z), pitch: Math.asin(v.y) };
}
export class Experience {
  constructor(scene, camera, renderer) {
    this.routes = { ...routes };
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.keys = new Set();
    this.velocity = 0;
    this.distance = 0;
    this.tourTime = 0;
    this.tourIndex = -1;
    this.target = null;
    this.direction = new T.Vector3();
    this.motion = new T.Vector3();
    this.sky = new T.Group();
    scene.add(this.sky);
    this.names = new T.Group();
    this.sky.add(this.names);
    this.labels = [];
    this.constellationAtlas = {};
    this.constellationCenters = [];
    this.focus = new ConstellationFocus(this);
    this.guide = new GuidedView(this);
    this.meteorFrom = new T.Vector3();
    this.meteorTo = new T.Vector3();
    this.createFlight();
    this.createMeteor();
    this.atlasReady = this.loadAtlas();
    this.go($('destination').value);
    $('destination').onchange = () => {
      this.tourTime = 0;
      this.go($('destination').value);
    };
    $('journey').onchange = () => {
      this.tourTime = 0;
      this.tourIndex = -1;
      if (['tour', 'cruise'].includes($('journey').value)) this.nextTour();
      this.forwardDirection = this.camera.getWorldDirection(new T.Vector3());
      this.notice($('journey').selectedOptions[0].textContent);
    };
    $('tourKind').onchange = () => {
      this.tourTime = 0;
      this.tourIndex = -1;
      if (['tour', 'cruise'].includes($('journey').value)) this.nextTour();
    };
    $('settingsButton').onclick = () => {
      $('settings').style.display = $('settings').style.display === 'block' ? 'none' : 'block';
    };
    $('photo').onclick = () => this.photo();
    $('fov').oninput = () => {
      this.cancelTurn();
      this.guide.interrupt();
      camera.fov = +$('fov').value;
      camera.updateProjectionMatrix();
    };
    this.art = new T.Group();
    this.sky.add(this.art);
    const setArt = () => {
      const mode = $('artDisplay').value;
      $('art').checked = mode !== 'off';
      this.art.visible = mode === 'always';
      $('artMode').setAttribute('aria-pressed', String(mode !== 'off'));
      $('artMode').textContent =
        mode === 'always'
          ? '白黒の星座図：常時'
          : mode === 'guide'
            ? '白黒の星座図：解説中'
            : '白黒の星座図：OFF';
    };
    $('artDisplay').onchange = setArt;
    $('artMode').onclick = () => {
      const modes = ['off', 'guide', 'always'];
      $('artDisplay').value = modes[(modes.indexOf($('artDisplay').value) + 1) % 3];
      $('artDisplay').dispatchEvent(new Event('change', { bubbles: true }));
    };
    $('artOpacity').oninput = () => {
      for (const item of this.art.children) item.material.opacity = +$('artOpacity').value;
    };
    setArt();
    this.constellationNames = new T.Group();
    this.sky.add(this.constellationNames);
    const setConstellations = () => {
      const enabled = $('lines').checked;
      if (this.lines) this.lines.visible = enabled;
      this.constellationNames.visible = $('constellationLabels').checked;
      $('constellationMode').setAttribute('aria-pressed', String(enabled));
      $('constellationMode').textContent = enabled ? '星座モード：ON' : '星座モード';
    };
    $('lines').onchange = setConstellations;
    $('constellationLabels').onchange = setConstellations;
    $('constellationMode').onclick = () => {
      $('lines').checked = !$('lines').checked;
      $('lines').dispatchEvent(new Event('change', { bubbles: true }));
    };
    setConstellations();
    $('names').onchange = () => (this.names.visible = $('names').checked);
    addEventListener('keydown', e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'KeyI') $('inspect').click();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.names.visible = $('names').checked;
  }
  notice(text) {
    $('toast').textContent = text;
    $('toast').style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => ($('toast').style.opacity = '0'), 3500);
  }
  go(key) {
    if (key === 'random') {
      this.routes.random = [
        Math.random() * 360,
        Math.asin(Math.random() * 2 - 1) / r,
        'ランダムな星空',
        '偶然出会う、新しい星の景色。',
      ];
    }
    let d = this.routes[key];
    if (!d) return;
    this.target = angle(this.observer ? this.observer.vector(eq(d[0], d[1])) : eq(d[0], d[1]));
    this.target.fov = key === 'pleiades' ? 38 : 65;
    $('card').textContent = d[2] + ' — ' + d[3];
    $('destination').value = key;
    this.notice(d[2]);
    this.currentDestination = key;
    this.narrator?.say(key, d);
  }
  nextTour() {
    const kind = $('tourKind').value;
    let pools = {
      galactic: ['core', 'cygnus', 'orion', 'pleiades', 'andromeda'],
      summer: ['SummerTriangle', 'Cyg', 'Lyr', 'Aql', 'Sco', 'Sgr', 'Her', 'Oph', 'Del', 'Vul', 'Sge'],
      winter: ['Ori', 'CMa', 'CMi', 'Tau', 'Gem', 'Aur', 'Lep', 'Mon', 'Per'],
      zodiac: ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'],
    };
    let keys = pools[kind]
      ? pools[kind].map(k => (this.routes[k] ? k : 'c_' + k)).filter(k => this.routes[k])
      : Object.keys(this.routes).filter(k => k.startsWith(kind === 'stars' ? 's_' : 'c_'));
    if (this.observer?.active)
      keys = keys.filter(k => {
        const d = this.routes[k];
        return d && this.observer.vector(eq(d[0], d[1])).y > 900;
      });
    if (!keys.length) {
      this.notice('この地点で見える候補がありません。ツアーを88星座に変更してください。');
      return;
    }
    let key;
    if (kind === 'random') {
      let choices = keys.filter(k => k !== this.currentDestination);
      key = choices[Math.floor(Math.random() * choices.length)];
      if (Math.random() < 0.15) key = 'random';
    } else {
      this.tourIndex = (this.tourIndex + 1) % keys.length;
      key = keys[this.tourIndex];
    }
    this.go(key);
  }
  cancelTurn() {
    this.target = null;
  }
  steer(dt, yaw, pitch, active) {
    let mode = $('journey').value;
    if (this.solarMode) return [yaw, pitch];
    if (
      (['tour', 'cruise'].includes(mode) || this.narrator?.enabled) &&
      active &&
      !this.focus.enabled &&
      !this.narrator?.speaking
    ) {
      this.tourTime += dt;
      if (
        this.tourTime > (this.narrator?.enabled ? Number($('narrationGap').value) : +$('tourInterval').value)
      ) {
        this.tourTime = 0;
        this.nextTour();
      }
    }
    if (this.target && active) {
      let delta = T.MathUtils.euclideanModulo(this.target.yaw - yaw + Math.PI, Math.PI * 2) - Math.PI;
      let k = 1 - Math.exp(-dt * 0.7);
      yaw += delta * k;
      pitch += (this.target.pitch - pitch) * k;
      if (!this.guide.active) this.camera.fov += (this.target.fov - this.camera.fov) * k;
      this.camera.updateProjectionMatrix();
      $('fov').value = this.camera.fov;
      if (Math.abs(delta) < 0.001 && Math.abs(pitch - this.target.pitch) < 0.001) this.target = null;
    }
    let h = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0),
      v = (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0);
    if (h || v) this.cancelTurn();
    return [yaw + h * dt * 0.5, T.MathUtils.clamp(pitch + v * dt * 0.5, -1.48, 1.48)];
  }
  createFlight() {
    const n = 9000;
    this.field = new Float32Array(n * 3);
    this.previous = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3),
      sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < 3; a++) this.field[i * 3 + a] = (Math.random() - 0.5) * 700;
      let c = new T.Color().setHSL(
        0.52 + Math.random() * 0.16,
        0.25 + Math.random() * 0.3,
        0.45 + Math.random() * 0.3,
      );
      colors.set([c.r, c.g, c.b], i * 3);
      sizes[i] = 1 + Math.random() * 2.5;
    }
    let g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.field, 3));
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    g.setAttribute('size', new T.BufferAttribute(sizes, 1));
    this.flight = new T.Points(
      g,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: { pixel: { value: 1 }, strength: { value: 1 } },
        vertexShader: `attribute vec3 color;attribute float size;varying vec3 c;varying float fade;uniform float pixel;void main(){vec4 p=modelViewMatrix*vec4(position,1.);c=color;fade=smoothstep(0.,10.,-p.z)*(1.-smoothstep(180.,340.,-p.z));gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pixel*100./max(8.,-p.z),1.,15.);}`,
        fragmentShader: `varying vec3 c;varying float fade;uniform float strength;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(c*strength,exp(-d*d*5.)*(1.-d)*fade);}`,
      }),
    );
    this.flight.frustumCulled = false;
    this.scene.add(this.flight);
    this.trailArray = new Float32Array(1600 * 6);
    let lines = new T.BufferGeometry();
    lines.setAttribute('position', new T.BufferAttribute(this.trailArray, 3));
    this.trails = new T.LineSegments(
      lines,
      new T.LineBasicMaterial({
        color: 0x9ccfff,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.trails.frustumCulled = false;
    this.scene.add(this.trails);
  }
  createMeteor() {
    this.meteorPoints = new Float32Array(60 * 6);
    this.meteor = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: 0xc7ddff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.meteor.geometry.setAttribute('position', new T.BufferAttribute(this.meteorPoints, 3));
    this.meteor.frustumCulled = false;
    this.sky.add(this.meteor);
    this.meteorAge = 0;
    this.meteorWait = 7;
  }
  async loadAtlas() {
    try {
      const [data, named, constellations, members, identities, artMetadata] = await Promise.all(
        [
          'constellations.json',
          'named-stars.json',
          'constellation-names.json',
          'constellation-members.json',
          'star-identities.json',
          'constellation-art.json',
        ].map(file =>
          fetch('./' + file).then(response => {
            if (!response.ok) throw Error(file);
            return response.json();
          }),
        ),
      );
      this.members = members;
      this.named = named;
      this.identities = identities;
      for (const star of named) star.vector = eq(star.ra, star.dec);
      const positions = [];
      for (const f of data.features) {
        const vertices = [];
        for (const line of f.geometry.coordinates)
          for (let i = 1; i < line.length; i++)
            vertices.push(...eq(...line[i - 1]).toArray(), ...eq(...line[i]).toArray());
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        if (this.constellationAtlas[f.id]?.geometry) {
          const earlier = this.constellationAtlas[f.id].geometry.attributes.position.array;
          const joined = new Float32Array(earlier.length + vertices.length);
          joined.set(earlier);
          joined.set(vertices, earlier.length);
          geometry.setAttribute('position', new T.BufferAttribute(joined, 3));
        }
        this.constellationAtlas[f.id] = { geometry };
      }
      for (const f of data.features)
        for (const line of f.geometry.coordinates)
          for (let i = 1; i < line.length; i++)
            positions.push(...eq(...line[i - 1]).toArray(), ...eq(...line[i]).toArray());
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      this.lines = new T.LineSegments(
        geometry,
        new T.LineBasicMaterial({ color: 0x76c9f5, transparent: true, opacity: 0.62, depthWrite: false }),
      );
      this.lines.visible = $('lines').checked;
      this.sky.add(this.lines);
      this.identities = identities;
      const identityMap = new Map(identities.ids.map((id, i) => [id, i]));
      const illustrationJobs = [];
      const group = document.createElement('optgroup');
      group.label = '88星座';
      const seen = new Set();
      for (const f of constellations.features) {
        const name = f.properties.ja || f.properties.name;
        const key = 'c_' + f.id;
        const [ra, dec] = f.geometry.coordinates;
        if (!seen.has(key)) {
          seen.add(key);
          this.routes[key] = [ra, dec, name, '主な星を結んだ形とともに眺める。'];
          group.appendChild(new Option(name, key));
        }
        this.constellationCenters.push({ id: f.id, name, ra, dec, vector: eq(ra, dec) });
        illustrationJobs.push(() =>
          loadConstellationIllustration(f.id, name, artMetadata[f.id], this.catalog, identityMap)
            .then(image => {
              image.material.opacity = +$('artOpacity').value;
              if (image.isSprite) {
                image.position.copy(eq(ra, dec, 9600));
                image.scale.set(2900, 2900, 1);
              }
              this.art.add(image);
              this.constellationAtlas[f.id] ??= {};
              this.constellationAtlas[f.id].art = image;
            })
            .catch(() => {}),
        );
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = '60px system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9edafa';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.fillText(name, 256, 75);
        const sprite = new T.Sprite(
          new T.SpriteMaterial({
            map: new T.CanvasTexture(canvas),
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: false,
          }),
        );
        sprite.position.copy(eq(ra, dec, 9700));
        sprite.scale.set(0.18, 0.045, 1);
        sprite.userData.constellationID = f.id;
        this.constellationNames.add(sprite);
      }
      $('destination').appendChild(group);
      const tri = [
        [279.2347, 38.7837],
        [310.3579, 45.2803],
        [297.6958, 8.8683],
      ];
      const vertices = [];
      for (let i = 0; i < 3; i++)
        vertices.push(...eq(...tri[i]).toArray(), ...eq(...tri[(i + 1) % 3]).toArray());
      const tg = new T.BufferGeometry();
      tg.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      const summerLines = new T.LineSegments(tg, this.lines.material);
      this.lines.add(summerLines);
      const center = eq(295, 31);
      this.constellationCenters.push({
        id: 'SummerTriangle',
        name: '夏の大三角',
        ra: 295,
        dec: 31,
        vector: center,
      });
      const art = new T.Sprite(
        new T.SpriteMaterial({
          map: new T.CanvasTexture(createConstellationArt('Tri', '夏の大三角')),
          transparent: true,
          depthTest: false,
          depthWrite: false,
          opacity: +$('artOpacity').value,
        }),
      );
      art.position.copy(center);
      art.scale.set(3000, 3000, 1);
      this.art.add(art);
      this.constellationAtlas.SummerTriangle = { geometry: tg, art };
      this.routes.c_SummerTriangle = [295, 31, '夏の大三角', 'ベガ、デネブ、アルタイルを結ぶ星の並び。'];
      const patterns = document.createElement('optgroup');
      patterns.label = '星空の目印';
      patterns.appendChild(new Option('夏の大三角', 'c_SummerTriangle'));
      $('destination').appendChild(patterns);
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 512;
      labelCanvas.height = 128;
      const lc = labelCanvas.getContext('2d');
      lc.font = '60px system-ui';
      lc.fillStyle = '#9edafa';
      lc.textAlign = 'center';
      lc.fillText('夏の大三角', 256, 75);
      const label = new T.Sprite(
        new T.SpriteMaterial({
          map: new T.CanvasTexture(labelCanvas),
          transparent: true,
          depthTest: false,
          depthWrite: false,
          sizeAttenuation: false,
        }),
      );
      label.position.copy(eq(295, 31, 9700));
      label.scale.set(0.18, 0.045, 1);
      label.userData.constellationID = 'SummerTriangle';
      this.constellationNames.add(label);

      this.identities = identities;
      this.members = members;
      this.named = named;
      const starOptions = document.createElement('optgroup');
      starOptions.label = '名前のある星';
      for (const star of named) {
        this.routes['s_' + star.name] = [star.ra, star.dec, this.starName(star), ''];
        starOptions.appendChild(new Option(this.starName(star), 's_' + star.name));
      }
      $('destination').appendChild(starOptions);
      try {
        const saved = JSON.parse(localStorage.getItem('celestial-preferences') || '{}');
        if (this.routes[saved.destination]) this.go(saved.destination);
      } catch {}
      this.constellationNames.visible = $('constellationLabels').checked;
      for (const star of named) {
        star.vector = eq(star.ra, star.dec);
        if (star.mag > 2.3 && !jp[star.name]) continue;
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 96;
        const ctx = c.getContext('2d');
        ctx.font = '34px system-ui';
        ctx.fillStyle = '#c0d5e8';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(this.starName(star), 18, 52);
        const sprite = new T.Sprite(
          new T.SpriteMaterial({
            map: new T.CanvasTexture(c),
            transparent: true,
            opacity: 0.8,
            depthTest: false,
          }),
        );
        sprite.position.copy(star.vector.clone().multiplyScalar(0.98));
        sprite.scale.set(950, 178, 1);
        sprite.position.y -= 80;
        this.names.add(sprite);
        this.labels.push(sprite);
      }
      Promise.allSettled(illustrationJobs.map(load => load()));
    } catch (e) {
      this.atlasError = e;
      $('card').textContent = '星図データを読み込めませんでした: ' + e.message;
      this.notice('星図を読み込めませんでした。再読み込みで再試行できます。');
    }
  }

  inspect() {
    if (!this.named) return;
    this.camera.getWorldDirection(this.direction);
    let best = null,
      dot = -1;
    for (let s of this.named) {
      let d = this.direction.dot(
        (this.observer ? this.observer.vector(s.vector) : s.vector.clone()).normalize(),
      );
      if (d > dot) {
        dot = d;
        best = s;
      }
    }
    if (!best) return;
    this.target = angle(this.observer ? this.observer.vector(best.vector) : best.vector);
    this.target.fov = 40;
    $('card').textContent =
      `${jp[best.name] || best.name} / ${best.name} · ${best.mag.toFixed(2)}等星\n赤経 ${T.MathUtils.euclideanModulo(best.ra, 360).toFixed(3)}° · 赤緯 ${best.dec.toFixed(3)}° · B−V ${best.bv.toFixed(3)}\n正面に最も近い名前付きの星へ焦点を合わせています。`;
    $('ui').classList.remove('hidden');
    this.notice(jp[best.name] || best.name);
  }
  update(dt, t, active) {
    this.focus.update(dt);
    let mode = $('journey').value,
      base = +$('speed').value;
    let target = active
      ? base *
        (mode === 'warp'
          ? 160
          : ['flight', 'forward', 'cruise'].includes(mode)
            ? 32
            : mode === 'tour'
              ? 4
              : 1.5) *
        (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 3 : 1)
      : 0;
    if (this.observer?.active || this.solarMode || this.narrator?.speaking) target = 0;
    this.velocity = active ? T.MathUtils.lerp(this.velocity, target, 1 - Math.exp(-dt * 1.7)) : 0;
    this.camera.getWorldDirection(this.direction);
    if (mode === 'forward' && this.forwardDirection) this.direction.copy(this.forwardDirection);
    if (mode === 'cruise')
      this.direction.set(
        -Math.sin(this.pilotYaw) * Math.cos(this.pilotPitch),
        Math.sin(this.pilotPitch),
        -Math.cos(this.pilotYaw) * Math.cos(this.pilotPitch),
      );
    this.motion.copy(this.direction).multiplyScalar(this.velocity * dt);
    this.camera.position.add(this.motion);
    this.distance += this.motion.length();
    this.sky.position.copy(this.camera.position);
    this.flight.material.uniforms.pixel.value = this.renderer.getPixelRatio();
    this.flight.material.uniforms.strength.value = mode === 'walk' ? 0.18 : 0.65;
    this.flight.visible = base > 0 && !this.observer?.active && !this.solarMode;
    this.trails.visible =
      !this.observer?.active && !this.solarMode && (mode === 'warp' || this.velocity > 25);
    const c = this.camera.position;
    if ((this.flight.visible || this.trails.visible) && this.motion.lengthSq() > 0) {
      for (let i = 0; i < this.field.length; i += 3) {
        let wrapped = false;
        for (let a = 0; a < 3; a++) {
          let v = this.field[i + a] - c.getComponent(a);
          if (v > 350) {
            this.field[i + a] -= 700;
            wrapped = true;
          }
          if (v < -350) {
            this.field[i + a] += 700;
            wrapped = true;
          }
        }
        if (this.trails.visible && i < 4800) {
          let j = i * 2;
          this.trailArray[j] = this.field[i];
          this.trailArray[j + 1] = this.field[i + 1];
          this.trailArray[j + 2] = this.field[i + 2];
          let length = wrapped ? 0 : Math.min(25, this.velocity * 0.1);
          this.trailArray[j + 3] = this.field[i] - this.direction.x * length;
          this.trailArray[j + 4] = this.field[i + 1] - this.direction.y * length;
          this.trailArray[j + 5] = this.field[i + 2] - this.direction.z * length;
        }
      }
      this.flight.geometry.attributes.position.needsUpdate = true;
      if (this.trails.visible) this.trails.geometry.attributes.position.needsUpdate = true;
    }
    this.trails.material.opacity = mode === 'warp' ? 0.33 : 0.15;
    if (active && $('meteors').checked && !this.observer?.active && !this.solarMode) {
      this.meteorWait -= dt;
      if (this.meteorWait <= 0) {
        this.meteorAge += dt;
        let f = this.meteorAge;
        if (f < 1.5) {
          const rotation = this.camera.quaternion;
          for (let i = 0; i < 60; i++) {
            let u = i / 60,
              alpha = f - u * 0.22,
              from = this.meteorFrom
                .set(-120 + alpha * 180, 100 - alpha * 75, -500)
                .applyQuaternion(rotation);
            let to = this.meteorTo
              .set(-120 + (alpha - 0.015) * 180, 100 - (alpha - 0.015) * 75, -500)
              .applyQuaternion(rotation);
            from.toArray(this.meteorPoints, i * 6);
            to.toArray(this.meteorPoints, i * 6 + 3);
          }
          this.meteor.geometry.attributes.position.needsUpdate = true;
          this.meteor.material.opacity = Math.sin((f / 1.5) * Math.PI) * 0.65;
        } else {
          this.meteor.material.opacity = 0;
          this.meteorAge = 0;
          this.meteorWait = 12 + Math.random() * 20;
        }
      }
    }
    this.meteor.visible = $('meteors').checked && !this.observer?.active;
    const matrix = this.observer?.matrix.elements;
    for (const group of [this.names, this.constellationNames, this.art])
      for (const sprite of group.children)
        if (sprite.isSprite)
          sprite.visible =
            !this.observer?.active ||
            matrix[1] * sprite.position.x + matrix[5] * sprite.position.y + matrix[9] * sprite.position.z > 0;
  }
  nearestCatalogStar(direction) {
    if (!this.catalog) return null;
    const target = this.observer?.active
      ? direction.clone().transformDirection(this.observer.matrix.clone().invert())
      : direction.clone();
    let best = -1,
      score = -2;
    const pos = this.catalogPositions;
    for (let i = 0; i < this.catalog.length; i++) {
      const j = i * 3,
        d = (target.x * pos[j] + target.y * pos[j + 1] + target.z * pos[j + 2]) / 10000;
      if (d > score) {
        score = d;
        best = i;
      }
    }
    if (best < 0) return null;
    const [ra, dec, mag, bv] = this.catalog[best];
    const selected = new T.Vector3(pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2]).normalize();
    let matched = null,
      closest = 1e-8;
    for (const star of this.named || []) {
      const d = 1 - selected.dot(star.vector.clone().normalize());
      if (d < closest) {
        closest = d;
        matched = star;
      }
    }
    return {
      ra,
      dec,
      mag,
      bv,
      name: matched?.name || '',
      display: matched ? this.starName(matched) : 'この方向の星',
      index: best + 1,
      catalogID: this.identities?.ids[best],
      designation: this.identities?.designations[this.identities?.ids[best]],
    };
  }
  starName(star) {
    return starReadings[star.name] || jp[star.name] || star.name;
  }
  description() {
    return `${$('journey').selectedOptions[0].textContent} · ${this.velocity.toFixed(1)}（演出速度）`;
  }
  photo() {
    this.capture = true;
  }
  afterRender() {
    if (!this.capture) return;
    this.capture = false;
    this.renderer.domElement.toBlob(blob => {
      if (!blob) return;
      let a = document.createElement('a'),
        url = URL.createObjectURL(blob);
      a.href = url;
      a.download = '夜の航路-' + new Date().toISOString().replaceAll(':', '-') + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      this.notice('星空を画像として保存しました');
    });
  }
}
