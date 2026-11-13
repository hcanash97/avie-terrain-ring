import * as THREE from "three";

export type Metal = "silver_925" | "gold_9ct" | "gold_14ct" | "gold_18ct" | "platinum_950";
export type Finish = "polished" | "satin";

/** Base colours approximate each alloy's measured reflectance (paler, less orange than a "gold" swatch). */
export const METALS: Record<Metal, { label: string; short: string; color: number }> = {
  // "Recycled" stays out until the sourcing claim is confirmed (identifier unchanged).
  silver_925: { label: "Sterling silver", short: "925", color: 0xeeedea },
  gold_9ct: { label: "9ct yellow gold", short: "9ct", color: 0xe2cb9f },
  gold_14ct: { label: "14ct yellow gold", short: "14ct", color: 0xe7c58c },
  gold_18ct: { label: "18ct yellow gold", short: "18ct", color: 0xe9c27a },
  platinum_950: { label: "Platinum", short: "Pt", color: 0xdcdcdd } // cooler and greyer than silver
};

export const FINISH_ROUGHNESS: Record<Finish, number> = { polished: 0.17, satin: 0.32 };
/**
 * The terrain face is finished as a textured relief (lightly matte), as on cast
 * landscape rings: it contrasts with the polished body and keeps ridges and
 * valleys readable instead of becoming mirror-like blobs of reflection.
 */
export const TERRAIN_FACE_ROUGHNESS: Record<Finish, number> = { polished: 0.34, satin: 0.42 };

export function materialParameters(metal: Metal, finish: Finish) {
  return { color: METALS[metal].color, metalness: 1, roughness: FINISH_ROUGHNESS[finish], envMapIntensity: 0.95 };
}

export function createRingMaterial(metal: Metal, finish: Finish) {
  return blendFinish(new THREE.MeshStandardMaterial(materialParameters(metal, finish)), finish);
}

function blendFinish(material: THREE.MeshStandardMaterial, finish: Finish) {
  const body = { value: FINISH_ROUGHNESS[finish] };
  const terrain = { value: TERRAIN_FACE_ROUGHNESS[finish] };
  material.userData.terraFinish = { body, terrain };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.terraBodyRoughness = body;
    shader.uniforms.terraTerrainRoughness = terrain;
    shader.vertexShader = "attribute float terrainBlend; varying float vTerrainBlend;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvTerrainBlend = terrainBlend;");
    shader.fragmentShader = "uniform float terraBodyRoughness; uniform float terraTerrainRoughness; varying float vTerrainBlend;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(terraBodyRoughness, terraTerrainRoughness, clamp(vTerrainBlend, 0.0, 1.0));");
  };
  material.customProgramCacheKey = () => "terra-continuous-finish-v1";
  return material;
}

/** Material for the terrain face zone: same metal, textured finish. */
export function createTerrainMaterial(metal: Metal, finish: Finish) {
  return blendFinish(new THREE.MeshStandardMaterial({ ...materialParameters(metal, finish), roughness: TERRAIN_FACE_ROUGHNESS[finish] }), finish);
}

/** Update in place: switching metal never rebuilds geometry or shaders. */
export function applyRingMaterial(m: THREE.MeshStandardMaterial, metal: Metal, finish: Finish, zone: "body" | "terrain" = "body") {
  const p = materialParameters(metal, finish);
  m.color.setHex(p.color);
  m.metalness = p.metalness;
  m.envMapIntensity = p.envMapIntensity;
  m.roughness = zone === "terrain" ? TERRAIN_FACE_ROUGHNESS[finish] : p.roughness;
  const blend = m.userData.terraFinish;
  if (blend) {
    blend.body.value = FINISH_ROUGHNESS[finish];
    blend.terrain.value = TERRAIN_FACE_ROUGHNESS[finish];
  }
}
