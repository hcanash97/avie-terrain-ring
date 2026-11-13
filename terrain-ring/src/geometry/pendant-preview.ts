/**
 * Internal pendant prototype preview: builds a pendant from the same generator
 * and style parameters as the manufacturer package, at preview resolution, and
 * prepares a display copy for the shared scene.
 */
import { buildTerrain, frameFor, type Detail, type TerrainSource } from "@avie/terrain";
import { configureManifoldWasm, createPendant, type TerrainCoverage } from "@avie/geometry/terrain-pendant";
// The boolean engine's WASM, served (or, in the single-file review page, inlined) by Vite.
import manifoldWasmUrl from "manifold-3d/manifold.wasm?url";

// Only a browser needs the URL; under Node (tests) the engine finds its own file.
if (typeof document !== "undefined") configureManifoldWasm(manifoldWasmUrl);
import { CHARM_STYLES, CHARM_SIZE_TIERS, charmStyleParameters, PENDANT_STYLES, pendantStyleParameters, type CharmStyleId, type PendantStyleId } from "@avie/product-types";
import type { RingMesh } from "./ring-blank";

export const PREVIEW_RESOLUTION = { rings: 80, angular: 280, round: 5 } as const;
export const SIZE_TIERS = ["petite", "classic", "statement"] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

export const presetFor = (style: PendantStyleId, tier: SizeTier) => `pendant-${PENDANT_STYLES[style].shape}-${tier}`;

export { CHARM_SIZE_TIERS };
export type CharmSizeTier = (typeof CHARM_SIZE_TIERS)[number];
export const charmPresetFor = (style: CharmStyleId, tier: CharmSizeTier) => `charm-${CHARM_STYLES[style].shape}-${tier}`;

type TerrainInput = { source: TerrainSource; lengthM: number; bearingDeg: number; terrainHeight: number; detail: Detail };
type Params = ReturnType<typeof pendantStyleParameters>;

async function buildPiece(params: Params, input: TerrainInput) {
  const dims = { faceLengthMm: params.outline.widthMm, faceWidthMm: params.outline.heightMm, maxReliefMm: params.maximumReliefMm };
  const terrain = buildTerrain(input.source, frameFor(input.lengthM, input.bearingDeg, dims), dims, { terrainHeight: input.terrainHeight, detail: input.detail }, 300);
  const built = await createPendant({ ...params, terrain, resolution: PREVIEW_RESOLUTION, attachmentSegments: 48 });
  return { params, terrain, built };
}

/** A charm from the same body generator, with its own preview-only values and face-plane loop. */
export function buildCharmPreview(input: TerrainInput & { style: CharmStyleId; tier: CharmSizeTier; coverage?: TerrainCoverage }) {
  return buildPiece(charmStyleParameters(charmPresetFor(input.style, input.tier), input.style, input.coverage), input);
}

export async function buildPendantPreview(input: {
  style: PendantStyleId;
  tier: SizeTier;
  coverage?: TerrainCoverage;
  source: TerrainSource;
  lengthM: number;
  bearingDeg: number;
  terrainHeight: number;
  detail: Detail;
}) {
  return buildPiece(pendantStyleParameters(presetFor(input.style, input.tier), input.style, input.coverage), input);
}

/**
 * Display copy for the scene (Y up): stand the pendant up, top at the top, face
 * towards the camera. A proper rotation about X, (x, y, z) → (x, −z, y), so
 * winding and normals are preserved.
 */
export function pendantDisplayMesh(m: RingMesh): RingMesh {
  const positions = new Float32Array(m.positions.length);
  for (let i = 0; i < m.positions.length; i += 3) {
    positions[i] = m.positions[i]!;
    positions[i + 1] = -m.positions[i + 2]!;
    positions[i + 2] = m.positions[i + 1]!;
  }
  return { ...m, positions };
}
