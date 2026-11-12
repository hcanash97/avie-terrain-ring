import * as THREE from "three";

export function createCamera(container: HTMLElement) {
  const camera = new THREE.PerspectiveCamera(
    32,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.5,
    400
  );
  camera.position.set(-30, 34, 46);
  return camera;
}

/** Conservative sphere fit: fits portrait and landscape viewers equally. */
export function fitDistance(radius: number, aspect: number, verticalFovDeg: number): number {
  const vertical = verticalFovDeg * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  return Math.max(1, radius) / Math.sin(Math.min(vertical, horizontal)) * 1.08;
}

/** Fit actual projected box corners, avoiding the empty space of a sphere fit. */
export function fitBoxDistance(box: THREE.Box3, direction: THREE.Vector3, aspect: number, fov: number) {
  const centre = box.getCenter(new THREE.Vector3());
  const outward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
  if (right.lengthSq() < 0.001) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(outward, right).normalize();
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * Math.max(.1, aspect);
  let distance = 1;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(centre);
    distance = Math.max(distance, p.dot(outward) + Math.max(Math.abs(p.dot(right)) / tanH, Math.abs(p.dot(up)) / tanV));
  }
  return distance * 1.08;
}
