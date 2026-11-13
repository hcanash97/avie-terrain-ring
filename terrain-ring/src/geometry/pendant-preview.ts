/**
 * Internal pendant prototype preview: builds the round pendant from the same
 * generator as any later export, using the preview-only profile, and prepares
 * a display copy for the shared scene.
 */
import { buildTerrain, frameFor, type Detail, type TerrainSource } from "@avie/terrain";
import { createRoundPendant, pendantDimensions, type RoundPendant } from "@avie/geometry/terrain-pendant";
import { getPreset, pendantPreviewNumbers } from "@avie/product-types";
import type { RingMesh } from "./ring-blank";

export const PENDANT_PRESET_ID = "pendant-round-classic";
export const PREVIEW_RESOLUTION = { radial: 96, angular: 360, round: 6, bail: 48 } as const;

export function pendantDiameterMm(): number {
  const o = getPreset(PENDANT_PRESET_ID).outline;
  if (o.shape !== "round" || o.diameterMm.value === null) throw new Error("The preview pendant must be round with a diameter");
  return o.diameterMm.value;
}

export function buildPendantPreview(input: { source: TerrainSource; lengthM: number; bearingDeg: number; terrainHeight: number; detail: Detail; flat: boolean }) {
  const n = pendantPreviewNumbers();
  const D = pendantDiameterMm();
  const dims = { faceLengthMm: D, faceWidthMm: D, maxReliefMm: n.maximumReliefMm };
  const terrain = buildTerrain(input.source, frameFor(input.lengthM, input.bearingDeg, dims), dims, { terrainHeight: input.terrainHeight, detail: input.detail }, 360);
  const pendant = createRoundPendant({
    diameterMm: D,
    baseThicknessMm: n.baseThicknessMm,
    edgeRoundMm: n.edgeRoundMm,
    terrainFadeMm: n.terrainFadeMm,
    terrain: input.flat ? null : terrain,
    bail: n.bail,
    resolution: PREVIEW_RESOLUTION,
  });
  return { terrain, pendant, dimensions: pendantDimensions(pendant), profileId: n.profileId };
}

/**
 * Display copy for the scene (Y up): stand the pendant up, bail at the top, face
 * towards the camera. A proper rotation about X, (x, y, z) → (x, −z, y), so
 * winding and normals are preserved. Body and bail are drawn together, but
 * remain separate components in the data.
 */
export function pendantDisplayMesh(p: RoundPendant): RingMesh {
  const parts = p.bail ? [p.body, p.bail] : [p.body];
  const count = parts.reduce((s, m) => s + m.positions.length, 0);
  const positions = new Float32Array(count);
  const indices: number[] = [];
  let offset = 0;
  for (const m of parts) {
    for (let i = 0; i < m.positions.length; i += 3) {
      positions[offset + i] = m.positions[i]!;
      positions[offset + i + 1] = -m.positions[i + 2]!;
      positions[offset + i + 2] = m.positions[i + 1]!;
    }
    const base = offset / 3;
    for (const v of m.indices) indices.push(v + base);
    offset += m.positions.length;
  }
  const blend = new Float32Array(count / 3);
  blend.set(p.body.terrainBlend);
  return {
    positions,
    indices: new Uint32Array(indices),
    shade: new Float32Array(count / 3).fill(1),
    terrainBlend: blend,
    faceTriangleCount: p.body.faceTriangleCount,
    triangleCount: indices.length / 3,
    terrainAdapted: false,
  };
}
