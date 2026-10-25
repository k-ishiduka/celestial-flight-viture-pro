import * as T from './three.module.js';

// Coordinates are CSS pixels, including each half of a Full SBS canvas.
export function pickingViewport(x, y, bounds, camera, stereo = null) {
  if (
    !bounds.width ||
    !bounds.height ||
    x < bounds.left ||
    y < bounds.top ||
    x > bounds.left + bounds.width ||
    y > bounds.top + bounds.height
  )
    return null;
  const width = bounds.width / (stereo ? 2 : 1);
  const right = stereo && x - bounds.left >= width;
  return {
    clientX: x,
    clientY: y,
    x: x - bounds.left - (right ? width : 0),
    y: y - bounds.top,
    width,
    height: bounds.height,
    camera: stereo ? (right ? stereo.cameraR : stereo.cameraL) : camera,
  };
}

export class SkyGesture {
  constructor() {
    this.pointers = new Set();
  }
  down(event) {
    if (event.button !== 0) {
      this.tap = null;
      return;
    }
    this.pointers.add(event.pointerId);
    if (this.pointers.size !== 1) {
      this.tap = null;
      return;
    }
    this.tap = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp, distance: 0 };
  }
  move(event) {
    if (this.tap?.id !== event.pointerId) return;
    this.tap.distance = Math.max(
      this.tap.distance,
      Math.hypot(event.clientX - this.tap.x, event.clientY - this.tap.y),
    );
  }
  up(event) {
    this.move(event);
    const tap = this.tap;
    this.pointers.delete(event.pointerId);
    this.tap = null;
    return !!tap && tap.id === event.pointerId && tap.distance <= 7 && event.timeStamp - tap.at < 600;
  }
  cancel(event) {
    this.pointers.delete(event.pointerId);
    this.tap = null;
  }
}

export function pickingRay(view) {
  view.camera.updateMatrixWorld();
  view.camera.projectionMatrixInverse.copy(view.camera.projectionMatrix).invert();
  const ray = new T.Raycaster();
  ray.setFromCamera(
    new T.Vector2((view.x / view.width) * 2 - 1, 1 - (view.y / view.height) * 2),
    view.camera,
  );
  return ray;
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = T.MathUtils.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function pickConstellation(view, experience, tolerance = 20) {
  const { observer, camera, constellationCenters: centers, constellationAtlas: atlas } = experience;
  const ray = pickingRay(view);
  if (observer?.active && ray.ray.direction.y < 0) return null;
  // The actual label sprites remain clickable even when the star lines are hidden.
  const labels = experience.constellationNames;
  if (labels?.visible) {
    labels.updateWorldMatrix(true, true);
    const hit = ray.intersectObjects(
      labels.children.filter(s => s.visible),
      false,
    )[0];
    if (hit) {
      const item = centers.find(c => c.id === hit.object.userData.constellationID);
      if (item) return item;
    }
  }
  const world = v => (observer ? observer.vector(v) : v.clone());
  const project = v => {
    const p = v.clone().add(camera.position).project(view.camera);
    return { x: ((p.x + 1) * view.width) / 2, y: ((1 - p.y) * view.height) / 2 };
  };
  const clip = (a, b, distance) => {
    const da = distance(a),
      db = distance(b);
    if (da < 0 && db < 0) return false;
    if (da < 0) a.lerp(b, da / (da - db));
    else if (db < 0) b.lerp(a, db / (db - da));
    return true;
  };
  const near = v =>
    -v.clone().add(camera.position).applyMatrix4(view.camera.matrixWorldInverse).z - view.camera.near;
  let best = null,
    closest = tolerance;
  for (const item of centers) {
    const positions = atlas[item.id]?.geometry?.attributes.position;
    if (!positions) continue;
    for (let i = 0; i < positions.count; i += 2) {
      const a = world(new T.Vector3().fromBufferAttribute(positions, i));
      const b = world(new T.Vector3().fromBufferAttribute(positions, i + 1));
      if (observer?.active && !clip(a, b, v => v.y)) continue;
      if (!clip(a, b, near)) continue;
      const distance = distanceToSegment(view, project(a), project(b));
      if (distance < closest) {
        closest = distance;
        best = item;
      }
    }
  }
  return best;
}

export function pickPlanet(view, planets) {
  planets.solarScene.updateMatrixWorld(true);
  const ray = pickingRay(view);
  const hits = ray.intersectObjects(
    planets.objects.flatMap(o => [o.mesh, o.text]),
    true,
  );
  for (const hit of hits) {
    const planet = planets.objects.find(
      o => o.text === hit.object || o.mesh === hit.object || hit.object.parent === o.mesh,
    );
    if (planet) return planet;
  }
  return null;
}
