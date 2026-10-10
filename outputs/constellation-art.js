import * as T from './three.module.js';
export const constellationArtIDs =
  'And Ant Aps Aqr Aql Ara Ari Aur Boo Cae Cam Cnc CVn CMa CMi Cap Car Cas Cen Cep Cet Cha Cir Col Com CrA CrB Crv Crt Cru Cyg Del Dor Dra Equ Eri For Gem Gru Her Hor Hya Hyi Ind Lac Leo LMi Lep Lib Lup Lyn Lyr Men Mic Mon Mus Nor Oct Oph Ori Pav Peg Per Phe Pic Psc PsA Pup Pyx Ret Sge Sgr Sco Scl Sct Ser Sex Tau Tel Tri TrA Tuc UMa UMi Vel Vir Vol Vul'.split(
    ' ',
  );
export function createConstellationArt(id, name) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  c.strokeStyle = '#ffffff';
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const path = points => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  if (id === 'Ser') {
    for (const shift of [0, 8]) {
      c.beginPath();
      c.moveTo(80, 360 + shift);
      c.bezierCurveTo(390, 470 + shift, 440, 270 + shift, 230, 275 + shift);
      c.bezierCurveTo(35, 245 + shift, 180, 80 + shift, 360, 145 + shift);
      c.bezierCurveTo(420, 175 + shift, 390, 210 + shift, 350, 190 + shift);
      c.stroke();
    }
    path([
      [392, 180],
      [440, 165],
      [450, 170],
    ]);
  } else if (['Pup', 'Vel'].includes(id)) {
    path([
      [65, 300],
      [120, 390],
      [380, 390],
      [450, 300],
      [65, 300],
    ]);
    path([
      [270, 300],
      [270, 80],
      [90, 280],
      [270, 280],
      [420, 280],
      [280, 100],
    ]);
    for (let y = 315; y < 385; y += 17)
      path([
        [100, y],
        [405, y],
      ]);
    if (id === 'Pup')
      path([
        [340, 300],
        [340, 240],
        [410, 240],
        [425, 300],
      ]);
  } else
    path([
      [256, 100],
      [80, 390],
      [435, 390],
      [256, 100],
    ]);
  return canvas;
}
export async function loadConstellationIllustration(id, name, metadata, catalog, identityMap) {
  if (!metadata) {
    const sprite = new T.Sprite(
      new T.SpriteMaterial({
        map: new T.CanvasTexture(createConstellationArt(id, name)),
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        opacity: 0.22,
      }),
    );
    return sprite;
  }
  const [width, height] = metadata.size;
  const points = metadata.anchors.map(a => {
    const star = catalog[identityMap.get(a.hip)];
    if (!star) throw Error('図柄の基準星がありません: ' + a.hip);
    const ra = (star[0] * Math.PI) / 180,
      dec = (star[1] * Math.PI) / 180;
    return {
      u: a.pos[0] / width,
      v: 1 - a.pos[1] / height,
      position: new T.Vector3(Math.cos(dec) * Math.cos(ra), Math.sin(dec), Math.cos(dec) * Math.sin(ra)),
    };
  });
  const matrix = new T.Matrix3()
    .set(points[0].u, points[0].v, 1, points[1].u, points[1].v, 1, points[2].u, points[2].v, 1)
    .invert();
  const coefficients = ['x', 'y', 'z'].map(axis =>
    new T.Vector3(...points.map(p => p.position[axis])).applyMatrix3(matrix),
  );
  const position = [],
    uv = [],
    indices = [],
    n = 24;
  for (let y = 0; y <= n; y++)
    for (let x = 0; x <= n; x++) {
      const u = x / n,
        v = y / n;
      const p = new T.Vector3(...coefficients.map(c => c.x * u + c.y * v + c.z))
        .normalize()
        .multiplyScalar(9600);
      position.push(...p.toArray());
      uv.push(u, v);
    }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x,
        b = a + 1,
        c = a + n + 1,
        d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const texture = await new T.TextureLoader().loadAsync('./' + metadata.file);
  texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
  });
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n diffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));',
    );
  };
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}
