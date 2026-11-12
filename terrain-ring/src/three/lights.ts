import * as THREE from "three";

/** Soft studio rig. Most of the look comes from the environment map. */
export function createLights() {
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight(0xfff1de, 1.6); // warm key
  key.position.set(6, 12, 8);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-8, 4, -6);
  const rim = new THREE.DirectionalLight(0xe6eeff, 0.9); // cool rim
  rim.position.set(-4, 8, -10);
  group.add(key, fill, rim);
  return group;
}
