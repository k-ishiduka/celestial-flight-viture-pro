import * as T from './three.module.js';
const $ = id => document.getElementById(id),
  A = globalThis.Astronomy,
  r = Math.PI / 180;
const smooth = (a, b, x) => {
  const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function equatorialPosition(eq, radius = 9900) {
  const a = eq.ra * 15 * r,
    b = eq.dec * r;
  return new T.Vector3(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)).multiplyScalar(
    radius,
  );
}
export class SkyEnvironment {
  constructor(scene, camera, observer) {
    this.camera = camera;
    this.observer = observer;
    this.starVisibility = 1;
    this.sunAltitude = -90;
    this.moonFraction = 0;
    this.description = '';
    this.age = 1;
    this.lastKey = '';
    this.eqGroup = new T.Group();
    scene.add(this.eqGroup);
    this.uniforms = {
      sunDirection: { value: new T.Vector3(0, -1, 0) },
      sunAltitude: { value: -90 },
      enabled: { value: 0 },
    };
    this.dome = new T.Mesh(
      new T.SphereGeometry(24000, 48, 24),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: this.uniforms,
        vertexShader:
          'varying vec3 ray;void main(){ray=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec3 ray;uniform vec3 sunDirection;uniform float sunAltitude;void main(){vec3 d=normalize(ray);float y=max(d.y,0.);float day=smoothstep(-9.,4.,sunAltitude);float twilight=smoothstep(-18.,-4.,sunAltitude)*(1.-smoothstep(0.,14.,sunAltitude));float rim=exp(-y*8.);float toward=pow(max(0.,dot(normalize(vec3(d.x,.01,d.z)),normalize(vec3(sunDirection.x,.01,sunDirection.z)))),6.);vec3 night=vec3(.0008,.002,.004);vec3 blue=mix(vec3(.12,.23,.34),vec3(.019,.082,.19),pow(y,.3));vec3 dusk=vec3(.22,.085,.035)*toward*rim+vec3(.013,.028,.064)*rim;vec3 color=night+day*blue+twilight*dusk;gl_FragColor=vec4(d.y<-.008?vec3(.0015,.003,.005):color,1.);
#include <colorspace_fragment>
}`,
      }),
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);
    const moonUniforms = {
      map: { value: new T.Texture() },
      lightDirection: { value: new T.Vector3(1, 0, 0) },
    };
    this.moon = new T.Mesh(
      new T.SphereGeometry(1, 48, 32),
      new T.ShaderMaterial({
        uniforms: moonUniforms,
        vertexShader:
          'varying vec2 vUv;varying vec3 n;void main(){vUv=uv;n=normalize((modelMatrix*vec4(normal,0.)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'uniform sampler2D map;uniform vec3 lightDirection;varying vec2 vUv;varying vec3 n;void main(){vec3 albedo=texture2D(map,vUv).rgb;float lit=max(0.,dot(normalize(n),normalize(lightDirection)));gl_FragColor=vec4(albedo*(.024+.95*sqrt(lit)),1.);\n#include <colorspace_fragment>\n}',
      }),
    );
    new T.TextureLoader().load('./planet-textures/moon.jpg', t => {
      t.colorSpace = T.SRGBColorSpace;
      moonUniforms.map.value = t;
    });
    this.eqGroup.add(this.moon);
    this.sun = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshBasicMaterial({ color: 0xffecd0 }));
    this.eqGroup.add(this.sun);
    this.horizon = new T.Group();
    scene.add(this.horizon);
    const ring = [];
    for (let i = 0; i <= 256; i++)
      ring.push(
        new T.Vector3(Math.sin((i / 256) * Math.PI * 2) * 9000, 0, -Math.cos((i / 256) * Math.PI * 2) * 9000),
      );
    this.horizon.add(
      new T.Line(
        new T.BufferGeometry().setFromPoints(ring),
        new T.LineBasicMaterial({ color: 0x6a879b, transparent: true, opacity: 0.18, depthWrite: false }),
      ),
    );
    for (const [i, name] of ['北', '東', '南', '西'].entries()) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 64;
      const ctx = c.getContext('2d');
      ctx.font = '30px system-ui';
      ctx.fillStyle = '#97aebb';
      ctx.textAlign = 'center';
      ctx.fillText(name, 64, 43);
      const s = new T.Sprite(
        new T.SpriteMaterial({
          map: new T.CanvasTexture(c),
          transparent: true,
          depthWrite: false,
          depthTest: false,
        }),
      );
      s.position.set(Math.sin((i * Math.PI) / 2) * 8800, 140, -Math.cos((i * Math.PI) / 2) * 8800);
      s.scale.set(550, 275, 1);
      this.horizon.add(s);
    }
  }
  update(dt, solar = false) {
    const active = this.observer.active && !solar;
    this.eqGroup.visible = active;
    this.dome.visible = active && $('atmosphere').checked;
    this.horizon.visible = active && $('horizonGuides').checked;
    this.starVisibility = 1;
    if (!active) return;
    this.dome.position.copy(this.camera.position);
    this.horizon.position.copy(this.camera.position);
    this.observer.apply(this.eqGroup);
    this.age += dt;
    const date = this.observer.date,
      lat = T.MathUtils.clamp(Number($('latitude').value), -90, 90),
      lon = T.MathUtils.clamp(Number($('longitude').value), -180, 180),
      key = +date + ':' + lat + ':' + lon;
    if (key !== this.lastKey && (this.age > 0.08 || this.lastKey === '')) {
      this.lastKey = key;
      this.age = 0;
      const location = new A.Observer(lat, lon, 0),
        sun = A.Equator('Sun', date, location, false, true),
        moon = A.Equator('Moon', date, location, false, true);
      this.sun.position.copy(equatorialPosition(sun));
      this.sun.scale.setScalar((9900 * 695700) / (sun.dist * 149597870.7));
      this.moon.position.copy(equatorialPosition(moon, 9700));
      this.moon.scale.setScalar((9700 * 1737.4) / (moon.dist * 149597870.7));
      const sunWorld = this.observer.vector(this.sun.position).normalize();
      this.sunAltitude = Math.asin(sunWorld.y) / r;
      this.uniforms.sunDirection.value.copy(sunWorld);
      this.uniforms.sunAltitude.value = this.sunAltitude;
      this.sun.visible = sunWorld.y > -0.012;
      this.moon.visible = this.observer.vector(this.moon.position).y > -0.012;
      const sunVector = equatorialPosition(sun, sun.dist),
        moonVector = equatorialPosition(moon, moon.dist);
      this.moon.material.uniforms.lightDirection.value
        .copy(this.observer.vector(sunVector.sub(moonVector)))
        .normalize();
      const axis = A.RotationAxis('Moon', date),
        north = new T.Vector3(axis.north.x, axis.north.z, axis.north.y).normalize();
      this.moon.quaternion
        .setFromUnitVectors(new T.Vector3(0, 1, 0), north)
        .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -axis.spin * r));
      this.moonFraction = A.Illumination('Moon', date).phase_fraction;
      const mood =
        this.sunAltitude > 0
          ? '日中の空'
          : this.sunAltitude > -6
            ? '夕朝の空'
            : this.sunAltitude > -18
              ? '薄明の空'
              : '夜の空';
      this.description = `${mood} · 月の照らされる割合 ${Math.round(this.moonFraction * 100)}％`;
    }
    const realistic = $('atmosphere').checked;
    if (realistic) this.starVisibility = 1 - smooth(-16, -2, this.sunAltitude);
    const mood =
      this.sunAltitude > 0
        ? '日中の空'
        : this.sunAltitude > -6
          ? '夕朝の空'
          : this.sunAltitude > -18
            ? '薄明の空'
            : '夜の空';
    this.description = `${realistic ? mood : '星空表示（昼夜の明るさOFF）'} · 月の照らされる割合 ${Math.round(this.moonFraction * 100)}％`;
  }
}
