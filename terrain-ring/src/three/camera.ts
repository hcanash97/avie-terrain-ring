import * as THREE from "three";

export function createCamera(container: HTMLElement) {
  const camera = new THREE.PerspectiveCamera(
    32,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.5,
    400
  );
  camera.position.set(-30, 22, 46);
  return camera;
}
