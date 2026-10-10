import * as T from './three.module.js';
const $ = id => document.getElementById(id),
  A = globalThis.Astronomy,
  rad = Math.PI / 180;
export const planetData = [
  ['Mercury', '水星', 0x98908a, 3, 87.969],
  ['Venus', '金星', 0xd4bb85, 5, 224.701],
  ['Earth', '地球', 0x4b89b4, 5, 365.256],
  ['Mars', '火星', 0xbe674b, 4, 686.98],
  ['Jupiter', '木星', 0xb99b7b, 13, 4332.59],
  ['Saturn', '土星', 0xc4b68e, 11, 10759.22],
  ['Uranus', '天王星', 0x8bced1, 8, 30688.5],
  ['Neptune', '海王星', 0x5279c2, 8, 60182],
];
export function helioPosition(body, date) {
  const v = A.HelioVector(body, date);
  return new T.Vector3(v.x, v.z, v.y);
}
function label(text, scale = 70) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '64px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e4edf3';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 10;
  ctx.fillText(text, 256, 75);
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: false }),
  );
  sprite.scale.set(scale, scale / 4, 1);
  return sprite;
}
function surface(body, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#' + color.toString(16).padStart(6, '0');
  c.fillRect(0, 0, 512, 256);
  let seed = 913;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 100; i++) {
    if (body === 'Jupiter' || body === 'Saturn' || body === 'Venus') {
      c.fillStyle = i % 2 ? '#ffffff12' : '#30201320';
      c.fillRect(0, random() * 256, 512, 2 + random() * 12);
    } else if (body === 'Earth') {
      c.fillStyle = i % 3 ? '#669773' : '#e7edf440';
      c.beginPath();
      c.ellipse(
        random() * 512,
        30 + random() * 196,
        random() * 28 + 6,
        random() * 18 + 4,
        random() * Math.PI,
        0,
        Math.PI * 2,
      );
      c.fill();
    } else {
      c.fillStyle = i % 2 ? '#ffffff12' : '#090d1720';
      c.beginPath();
      c.ellipse(random() * 512, random() * 256, 3 + random() * 16, 3 + random() * 12, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (body === 'Earth') {
    c.fillStyle = '#eff3f1';
    c.fillRect(0, 0, 512, 10);
    c.fillRect(0, 244, 512, 12);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
export class PlanetariumPlanets {
  constructor(scene, observer, experience) {
    this.mode = 'off';
    this.observer = observer;
    this.experience = experience;
    this.sky = new T.Group();
    scene.add(this.sky);
    this.solarScene = new T.Scene();
    this.solarCamera = new T.PerspectiveCamera(55, 16 / 9, 0.1, 20000);
    this.solarScene.add(new T.AmbientLight(0xb5c5df, 0.55), new T.PointLight(0xfff2da, 16000, 0, 1));
    this.solarCamera.position.set(0, 1800, 2800);
    this.distance = 3300;
    this.theta = 0.5;
    this.phi = 0.55;
    this.target = new T.Vector3();
    this.objects = [];
    this.lastDate = NaN;
    this.orbitDate = null;
    this.sampleAge = 1;
    this.statusAge = 1;
    this.desiredTarget = new T.Vector3();
    this.desiredDistance = this.distance;
    this.axisUp = new T.Vector3(0, 1, 0);
    this.north = new T.Vector3();
    this.spin = new T.Quaternion();
    this.ephemerisKey = '';
    const loader = new T.TextureLoader();
    const textures = {
      Mercury: 'mercury',
      Venus: 'venus_atmosphere',
      Earth: 'earth_daymap',
      Mars: 'mars',
      Jupiter: 'jupiter',
      Saturn: 'saturn',
      Uranus: 'uranus',
      Neptune: 'neptune',
    };
    const applyMap = (material, file) =>
      loader.load(
        './planet-textures/' + file + '.jpg',
        texture => {
          texture.colorSpace = T.SRGBColorSpace;
          material.map?.dispose();
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
        },
        undefined,
        () => {},
      );
    const sun = new T.Mesh(new T.SphereGeometry(10, 40, 24), new T.MeshBasicMaterial({ color: 0xffd494 }));
    applyMap(sun.material, 'sun');
    this.solarScene.add(sun);
    const sunLabel = label('太陽', 50);
    sunLabel.position.y = 20;
    this.solarScene.add(sunLabel);
    for (const [body, name, color, radius, period] of planetData) {
      const mesh = new T.Mesh(
        new T.SphereGeometry(radius, 40, 24),
        new T.MeshStandardMaterial({ map: surface(body, color), roughness: 0.9 }),
      );
      applyMap(mesh.material, textures[body]);
      const text = label(name);
      text.position.y = radius + 12;
      const group = new T.Group();
      group.add(mesh, text);
      this.solarScene.add(group);
      if (body === 'Saturn') {
        const ring = new T.Mesh(
          new T.RingGeometry(radius * 1.3, radius * 2.3, 96),
          new T.MeshStandardMaterial({
            color: 0xc4b594,
            side: T.DoubleSide,
            transparent: true,
            opacity: 0.65,
          }),
        );
        const uv = ring.geometry.attributes.uv,
          pos = ring.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const r = Math.hypot(pos.getX(k), pos.getY(k));
          uv.setXY(k, (r - radius * 1.3) / radius, 0.5);
        }
        loader.load('./planet-textures/saturn_ring_alpha.png', texture => {
          texture.colorSpace = T.SRGBColorSpace;
          ring.material.map = texture;
          ring.material.color.set(0xffffff);
          ring.material.needsUpdate = true;
        });
        ring.rotation.x = Math.PI / 2;
        mesh.add(ring);
      }
      const point = new T.Mesh(new T.SphereGeometry(22, 16, 12), new T.MeshBasicMaterial({ color }));
      this.sky.add(point);
      const skyLabel = label(name, 480);
      this.sky.add(skyLabel);
      this.objects.push({ body, name, radius, period, mesh, group, point, skyLabel, text });
    }
    this.skySun = new T.Mesh(new T.SphereGeometry(45, 24, 16), new T.MeshBasicMaterial({ color: 0xffddb0 }));
    this.sky.add(this.skySun);
    this.sunSkyLabel = label('太陽', 480);
    this.sky.add(this.sunSkyLabel);
    $('planetMode').onchange = () => {
      experience.narrator?.stop();
      this.mode = $('planetMode').value;
      this.lastDate = NaN;
      experience.solarMode = this.mode === 'solar';
      this.sky.visible = this.mode === 'sky';
      if (this.mode === 'sky') {
        $('observe').checked = true;
        $('observe').dispatchEvent(new Event('change'));
      }
      if (this.mode === 'solar') {
        this.buildOrbits(observer.date);
        experience.notice('太陽系：惑星の大きさは見やすく拡大しています');
      }
      if (this.mode === 'solar')
        $('card').textContent = '太陽系の軌道と自転 — 惑星を選ぶと近くから眺められます。';
      this.update(0, new T.Quaternion());
    };
    $('planetTarget').onchange = () => {
      const selected = $('planetTarget').value;
      this.desiredDistance = selected === 'all' ? 3300 : 140;
    };
    this.sky.visible = false;
  }
  buildOrbits(date) {
    this.orbitDate = date.getTime();
    for (const o of this.objects) {
      if (o.orbit) {
        this.solarScene.remove(o.orbit);
        o.orbit.geometry.dispose();
        o.orbit.material.dispose();
      }
      const points = [];
      for (let i = 0; i <= 160; i++)
        points.push(
          helioPosition(o.body, new Date(date.getTime() + (o.period * 86400000 * i) / 160)).multiplyScalar(
            60,
          ),
        );
      o.orbit = new T.Line(
        new T.BufferGeometry().setFromPoints(points),
        new T.LineBasicMaterial({ color: 0x667589, transparent: true, opacity: 0.38 }),
      );
      this.solarScene.add(o.orbit);
    }
  }
  drag(dx, dy) {
    this.theta -= dx * 0.005;
    this.phi = T.MathUtils.clamp(this.phi + dy * 0.005, -1.4, 1.4);
  }
  zoom(delta) {
    this.desiredDistance = T.MathUtils.clamp(
      this.desiredDistance * Math.exp(T.MathUtils.clamp(delta, -100, 100) * 0.006),
      35,
      7000,
    );
  }
  update(dt, head) {
    if (this.mode === 'off') return;
    this.sampleAge += dt;
    this.statusAge += dt;
    const date = this.observer.date;
    if (this.mode === 'solar' && Math.abs(+date - this.orbitDate) > 20 * 365.25 * 86400000)
      this.buildOrbits(date);
    if (!Number.isFinite(date.getTime())) return;
    const key = +date + ':' + $('latitude').value + ':' + $('longitude').value + ':' + this.mode;
    if (
      (key !== this.ephemerisKey || !Number.isFinite(this.lastDate)) &&
      (this.mode === 'solar' || this.sampleAge >= 0.1)
    ) {
      this.ephemerisKey = key;
      this.sampleAge = 0;
      this.lastDate = date.getTime();
      if (this.mode === 'solar') {
        for (const o of this.objects) {
          o.group.position.copy(helioPosition(o.body, date).multiplyScalar(60));
          const axis = A.RotationAxis(o.body, date),
            north = this.north.set(axis.north.x, axis.north.z, axis.north.y).normalize();
          o.mesh.quaternion
            .setFromUnitVectors(this.axisUp, north)
            .multiply(this.spin.setFromAxisAngle(this.axisUp, -axis.spin * rad));
        }
      } else {
        const observer = new A.Observer(
          T.MathUtils.clamp(Number($('latitude').value), -90, 90),
          T.MathUtils.clamp(Number($('longitude').value), -180, 180),
          0,
        );
        for (const o of this.objects) {
          if (o.body === 'Earth') {
            o.point.visible = o.skyLabel.visible = false;
            continue;
          }
          const eq = A.Equator(o.body, date, observer, false, true),
            ra = eq.ra * 15 * rad,
            dec = eq.dec * rad;
          o.point.position.set(
            9900 * Math.cos(dec) * Math.cos(ra),
            9900 * Math.sin(dec),
            9900 * Math.cos(dec) * Math.sin(ra),
          );
          o.skyLabel.position.copy(o.point.position);
          o.skyLabel.position.y += 90;
          const above = this.observer.vector(o.point.position).y >= 0;
          o.skyLabel.visible = o.point.visible = above;
        }
        const eq = A.Equator('Sun', date, observer, false, true),
          ra = eq.ra * 15 * rad,
          dec = eq.dec * rad;
        this.skySun.position.set(
          9900 * Math.cos(dec) * Math.cos(ra),
          9900 * Math.sin(dec),
          9900 * Math.cos(dec) * Math.sin(ra),
        );
        this.sunSkyLabel.position.copy(this.skySun.position);
        this.sunSkyLabel.position.y += 110;
        this.sunSkyLabel.visible = this.skySun.visible = this.observer.vector(this.skySun.position).y >= 0;
      }
    }
    if (this.mode === 'solar') {
      const selected = this.objects.find(o => o.body === $('planetTarget').value);
      this.desiredTarget
        .copy(selected ? selected.group.position : this.axisUp)
        .multiplyScalar(selected ? 1 : 0);
      const easing = 1 - Math.exp(-Math.max(0, dt) * 4);
      this.target.lerp(this.desiredTarget, easing);
      this.distance = T.MathUtils.lerp(this.distance, this.desiredDistance, easing);
      for (const o of this.objects) {
        const size = T.MathUtils.clamp(this.distance * 0.22, 20, 800);
        o.text.scale.set(size, size / 4, 1);
        o.text.position.y = o.radius + size * 0.14;
      }
      this.solarCamera.position
        .set(
          this.distance * Math.cos(this.phi) * Math.sin(this.theta),
          this.distance * Math.sin(this.phi),
          this.distance * Math.cos(this.phi) * Math.cos(this.theta),
        )
        .add(this.target);
      this.solarCamera.lookAt(this.target);
      this.solarCamera.quaternion.multiply(head);
      this.solarCamera.updateMatrixWorld();
      if (this.statusAge > 0.2) {
        this.statusAge = 0;
        const obj = selected
          ? `${selected.name} · 太陽から ${(selected.group.position.length() / 60).toFixed(2)} AU`
          : '水・金・地・火・木・土・天・海';
        $('planetStatus').textContent =
          obj + ' / ' + $('date').value.replace('T', ' ') + ' / 惑星の大きさは見やすく拡大';
      }
    }
  }
}
