import * as THREE from "three";

export function createRenderer(container: HTMLElement, pixelRatioCap: number) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  return renderer;
}

let webglAvailable: boolean | undefined;
export function isWebGLAvailable(): boolean {
  if (webglAvailable !== undefined) return webglAvailable;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    webglAvailable = !!context;
    // Probing on every React render leaked disposable GPU contexts. Enough
    // option changes can evict the real preview's context on limited devices.
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return webglAvailable;
  } catch {
    return (webglAvailable = false);
  }
}
