import * as THREE from "three";

/**
 * Jewellery-photography environment for reflections. Metal shows only what it
 * reflects, so the studio is the "lighting": softboxes give the highlights, the
 * walls and floor give the mid-tones and depth, and dark flags give the edge
 * definition that makes side walls and band curvature legible.
 *
 * All values are data (StudioSettings) so a look can be tuned and compared.
 */
export type Panel = { w: number; h: number; intensity: number; color: number; pos: [number, number, number]; note?: string };
export type StudioSettings = { wall: number; panels: Panel[] };

export const DEFAULT_STUDIO: StudioSettings = {
  wall: 0xa9a49d,
  panels: [
    { w: 80, h: 80, intensity: 0.9, color: 0x77736f, pos: [0, -34, 0], note: "neutral floor bounce" },
    { w: 40, h: 24, intensity: 2.2, color: 0xffffff, pos: [0, 30, 6], note: "overhead softbox" },
    { w: 12, h: 40, intensity: 2.6, color: 0xfff4e6, pos: [-30, 6, 14], note: "warm key strip" },
    { w: 12, h: 40, intensity: 2.4, color: 0xeef3ff, pos: [30, 8, -10], note: "cool rim strip" },
    { w: 30, h: 8, intensity: 1.2, color: 0xf3e6d2, pos: [0, -18, 24], note: "low bounce card" },
    { w: 20, h: 12, intensity: 1.6, color: 0xffffff, pos: [6, 10, 34], note: "front fill" },
    { w: 18, h: 34, intensity: 0.4, color: 0xffffff, pos: [30, -2, 20], note: "dark flag" },
    { w: 70, h: 6, intensity: 0.5, color: 0xffffff, pos: [0, 0, -42], note: "darker horizon" }
  ]
};

export function createEnvironment(renderer: THREE.WebGLRenderer, studio: StudioSettings = DEFAULT_STUDIO) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.MeshBasicMaterial({ color: studio.wall, side: THREE.BackSide })
  ));
  for (const p of studio.panels) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(p.w, p.h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(p.intensity), side: THREE.DoubleSide })
    );
    mesh.position.set(...p.pos);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.02);
  room.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();
  return target;
}
