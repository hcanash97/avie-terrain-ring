import type * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function createControls(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.target.set(0, 2.5, 0);
  controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  // Page scrolling over the product must not silently zoom into the metal.
  // Deliberate zoom buttons are provided alongside the fixed camera views.
  controls.enableZoom = false;
  controls.minDistance = 16;
  controls.maxDistance = 90;
  controls.update();
  return controls;
}
