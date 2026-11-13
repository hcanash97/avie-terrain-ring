import * as THREE from "three";
import { createCamera, fitBoxDistance } from "./camera";
import { createControls } from "./controls";
import { createEnvironment, type StudioSettings } from "./environment";
import { createLights } from "./lights";
import { applyRingMaterial, createRingMaterial, createTerrainMaterial, type Finish, type Metal } from "./materials";
import { createRenderer } from "./renderer";
import { createFpsProbe } from "./performance";
import { weldedNormals, type RingMesh } from "../geometry/ring-blank";

export type ViewName = "three_quarter" | "front" | "side" | "top" | "detail";

/** Fixed camera presets (position; all look at the ring centre). Shared by the UI and comparison captures. */
export const VIEWS: Record<ViewName, [number, number, number]> = {
  three_quarter: [-30, 34, 46],
  front: [0, 10, 52],
  side: [52, 6, 0],
  top: [0, 54, 6],
  detail: [-22, 42, 35]
};
const TARGET = new THREE.Vector3(0, 2.5, 0);

export type SceneContext = {
  setRing: (mesh: RingMesh) => void;
  setMaterial: (metal: Metal, finish: Finish) => void;
  /** Neutral clay material for judging shape without reflections. */
  setClay: (on: boolean) => void;
  setView: (view: ViewName) => void;
  zoom: (factor: number) => void;
  setInteraction: (enabled: boolean) => void;
  simulateContextRecovery: () => void;
  dispose: () => void;
};

/** Soft radial contact shadow — far cheaper than real-time shadow maps. */
function createContactShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(37,37,37,0.32)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, texture };
}

export function createScene(
  container: HTMLElement,
  options: { pixelRatioCap: number; onFps?: (fps: number) => void; onContextLost?: () => void; onContextRestored?: () => void }
): SceneContext {
  const scene = new THREE.Scene();
  const renderer = createRenderer(container, options.pixelRatioCap);
  const camera = createCamera(container);
  const controls = createControls(camera, renderer.domElement);
  let envTarget = createEnvironment(renderer);
  scene.environment = envTarget.texture;
  scene.add(createLights());

  const material = createRingMaterial("gold_18ct", "polished");
  const terrainMaterial = createTerrainMaterial("gold_18ct", "polished");
  const metalZones = [material, terrainMaterial];
  const clay = new THREE.MeshStandardMaterial({ color: 0x80868d, roughness: 0.75, metalness: 0, envMapIntensity: 0.25 });
  const ring = new THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>(new THREE.BufferGeometry(), metalZones);
  scene.add(ring);

  const shadow = createContactShadow();
  scene.add(shadow.mesh);
  let bounds: THREE.Sphere | null = null;
  let headBox: THREE.Box3 | null = null;
  let activeView: ViewName = "three_quarter";
  const fit = (direction = camera.position.clone().sub(controls.target)) => {
    if (!bounds) return;
    const box = activeView === "detail" && headBox ? headBox : ring.geometry.boundingBox!;
    const centre = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    controls.target.copy(centre);
    camera.position.copy(direction.normalize().multiplyScalar(fitBoxDistance(box, direction, camera.aspect, camera.fov)).add(centre));
    controls.minDistance = radius * 1.25;
    controls.maxDistance = bounds.radius * 8;
    controls.update();
  };
  let contextLost = false;
  let restoreTimer: number | undefined;
  const lost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    options.onContextLost?.();
  };
  // Recreate the entire scene, including its PMREM target and materials, after
  // restoration. A restored canvas alone does not guarantee live GPU textures.
  const restored = () => options.onContextRestored?.();
  renderer.domElement.addEventListener("webglcontextlost", lost);
  renderer.domElement.addEventListener("webglcontextrestored", restored);

  const resize = () => {
    const width = container.clientWidth;
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    fit();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const probe = options.onFps ? createFpsProbe(options.onFps) : null;
  let frame = 0;
  const animate = (now: number) => {
    frame = requestAnimationFrame(animate);
    probe?.(now);
    if (!contextLost) {
      controls.update();
      renderer.render(scene, camera);
    }
  };
  frame = requestAnimationFrame(animate);

  if (import.meta.env.DEV) {
    // Dev-only look tuning: swap studio, exposure and material values live.
    (window as unknown as { __look: unknown }).__look = {
      setStudio(studio: StudioSettings) {
        envTarget.dispose();
        envTarget = createEnvironment(renderer, studio);
        scene.environment = envTarget.texture;
      },
      setExposure(v: number) { renderer.toneMappingExposure = v; },
      setMaterial(patch: { roughness?: number; envMapIntensity?: number; color?: number }) {
        if (patch.roughness !== undefined) material.roughness = patch.roughness;
        for (const m of metalZones) {
          if (patch.envMapIntensity !== undefined) m.envMapIntensity = patch.envMapIntensity;
          if (patch.color !== undefined) m.color.setHex(patch.color);
        }
      }
    };
    // Dev-only: render fixed camera views at a fixed size for before/after comparisons.
    (window as unknown as { __ringCapture: (v: ViewName) => string }).__ringCapture = (view) => {
      const saved = { pos: camera.position.clone(), aspect: camera.aspect, w: container.clientWidth, h: container.clientHeight };
      const [x, y, z] = VIEWS[view] ?? VIEWS.three_quarter;
      renderer.setPixelRatio(1);
      renderer.setSize(1200, 900, false);
      camera.aspect = 1200 / 900;
      camera.position.set(x, y, z);
      camera.lookAt(TARGET);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL("image/png");
      camera.position.copy(saved.pos);
      camera.aspect = saved.aspect;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.pixelRatioCap));
      renderer.setSize(saved.w, saved.h);
      return url;
    };
  }

  return {
    setRing(mesh) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
      geometry.setAttribute("terrainBlend", new THREE.BufferAttribute(mesh.terrainBlend, 1));
      geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
      // Group 0: terrain face (textured finish); group 1: body (customer's finish).
      geometry.addGroup(0, mesh.faceTriangleCount * 3, 1);
      geometry.addGroup(mesh.faceTriangleCount * 3, (mesh.triangleCount - mesh.faceTriangleCount) * 3, 0);
      // Normals averaged across strips that meet, so joins shade continuously.
      geometry.setAttribute("normal", new THREE.BufferAttribute(weldedNormals(mesh), 3));
      geometry.computeBoundingBox();
      bounds = geometry.boundingBox!.getBoundingSphere(new THREE.Sphere());
      headBox = new THREE.Box3();
      const vertex = new THREE.Vector3();
      for (let i = 0; i < mesh.faceTriangleCount * 3; i++) {
        vertex.fromArray(mesh.positions, mesh.indices[i]! * 3);
        headBox.expandByPoint(vertex);
      }
      if (headBox.isEmpty()) headBox.copy(geometry.boundingBox!);
      ring.geometry.dispose(); // never leak the previous build
      ring.geometry = geometry;
      fit();
      // Rest the ring on the shadow plane.
      shadow.mesh.position.y = geometry.boundingBox!.min.y - 0.01;
    },
    setMaterial(metal, finish) {
      applyRingMaterial(material, metal, finish);
      applyRingMaterial(terrainMaterial, metal, finish, "terrain");
    },
    setClay(on) {
      ring.material = on ? clay : metalZones;
    },
    setView(view) {
      activeView = view;
      const [x, y, z] = VIEWS[view];
      camera.position.set(x, y, z);
      fit(new THREE.Vector3(x, y, z).sub(TARGET));
    },
    setInteraction(enabled) {
      controls.enabled = enabled;
      renderer.domElement.style.touchAction = enabled ? "none" : "pan-y";
    },
    zoom(factor) {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    simulateContextRecovery() {
      renderer.forceContextLoss();
      restoreTimer = window.setTimeout(() => renderer.forceContextRestore(), 250);
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.clearTimeout(restoreTimer);
      observer.disconnect();
      controls.dispose();
      ring.geometry.dispose();
      material.dispose();
      terrainMaterial.dispose();
      clay.dispose();
      shadow.mesh.geometry.dispose();
      (shadow.mesh.material as THREE.Material).dispose();
      shadow.texture.dispose();
      envTarget.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  };
}
