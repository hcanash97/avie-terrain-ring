/**
 * Review-only manufacturer package for one ring configuration.
 *
 *   <ORDER>_<DESIGN>/
 *   ├─ 01_cad/terrain-ring.3dm, terrain-ring.stl
 *   ├─ 02_specification/production-spec.json, validation-report.json, checksum-manifest.json
 *   ├─ 03_visuals/render-front.png, render-side.png, render-three-quarter.png (when supplied)
 *   └─ 04_source/design-parameters.json, heightmap.bin, heightmap-metadata.json
 *
 * The package is staged, both CAD files are reopened and compared with the
 * canonical mesh, then every file is hashed. Status is "review_only" unless all
 * checks pass against an APPROVED manufacturer profile (none exists yet).
 * production-spec.pdf is not generated in this milestone (JSON first).
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { validation } from "@avie/geometry";
import { boundingBox, signedVolume, weld } from "./mesh";
import { buildProductionRing, loadSavedTerrain, PRODUCTION_RESOLUTION, type RingConfiguration } from "./ring-source";
import { read3dm, REPRESENTATION_NOTE, write3dm } from "./rhino-3dm";
import { readBinaryStl, writeBinaryStl } from "./stl";

export const PACKAGE_FORMAT_VERSION = "terra-package/v1";
export const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

/** Canonical JSON: sorted keys, so equal content always hashes equally. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

export type PackageOptions = {
  config: RingConfiguration;
  orderRef: string; // e.g. "SAMPLE-001"; never customer personal data
  outDir: string;
  geometryVersion: string; // e.g. git commit of the generator
  /** Minimum structural wall to judge against; null = measure and report only (no approved figure yet). */
  minWallMm: number | null;
  /** Minimum terrain feature size (sphere diameter) to judge against; null = report only. */
  minFeatureMm?: number | null;
  /** Minimum rim angle (terrain against the head wall) to judge against; null = report only. */
  minRimAngleDeg?: number | null;
  rendersDir?: string; // folder with front.png, side.png, three_quarter.png
};

export async function buildRingPackage(opts: PackageOptions) {
  const { config } = opts;
  const ring = buildProductionRing(config);
  const designParameters = {
    productType: "terrain_ring",
    terrain: {
      place: config.place, lengthM: ring.lengthM, widthM: ring.area.widthM, bearingDeg: config.bearingDeg,
      terrainHeight: config.terrainHeight, detail: config.detail
    },
    ring: {
      headShape: config.headShape, faceSize: config.weight, shoulder: config.shoulder, bandProfile: config.profile,
      ringSizeUk: config.ringSize, innerDiameterMm: +ring.innerDiameterMm.toFixed(4)
    },
    material: { metal: config.metal, finish: config.finish, densityGcm3: ring.densityGcm3 },
    resolution: PRODUCTION_RESOLUTION,
    geometryVersion: opts.geometryVersion
  };
  const saved = loadSavedTerrain(config.place);
  const heightmapBytes = new Uint8Array(ring.elevations.data.buffer.slice(0));
  const designHash = sha256(canonical(designParameters) + sha256(heightmapBytes));
  const designRef = `WR-${designHash.slice(0, 7).toUpperCase()}`;
  const root = join(opts.outDir, `ORDER-${opts.orderRef}_${designRef}`);
  if (existsSync(root)) rmSync(root, { recursive: true });
  const dir = (p: string) => { mkdirSync(join(root, p), { recursive: true }); return join(root, p); };
  const cad = dir("01_cad"), spec = dir("02_specification"), visuals = dir("03_visuals"), src = dir("04_source");

  // --- CAD ---------------------------------------------------------------
  const stlBytes = writeBinaryStl(ring.mesh, `Terra ring ${designRef} mm 1:1 ${opts.geometryVersion}`);
  const meshHash = sha256(stlBytes);
  const box = boundingBox(ring.mesh);
  const volume = signedVolume(ring.mesh);
  const meta: Record<string, string> = {
    objectName: `Terra ring ${designRef}`,
    designRef,
    designHash,
    orderRef: opts.orderRef,
    productType: "terrain_ring",
    geometryVersion: opts.geometryVersion,
    packageFormat: PACKAGE_FORMAT_VERSION,
    meshSha256OfStl: meshHash,
    status: "review_only"
  };
  const dmBytes = await write3dm(ring.mesh, meta);
  writeFileSync(join(cad, "terrain-ring.stl"), stlBytes);
  writeFileSync(join(cad, "terrain-ring.3dm"), dmBytes);

  // --- Reopen checks: files must reproduce the canonical mesh -------------
  const stlBack = weld(readBinaryStl(readFileSync(join(cad, "terrain-ring.stl"))).mesh);
  const stlBox = boundingBox(stlBack);
  const dmBack = await read3dm(readFileSync(join(cad, "terrain-ring.3dm")), Object.keys(meta));
  const near = (a: number[], b: number[], tol: number) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
  const reopen = {
    stl: {
      triangles: stlBack.indices.length / 3,
      matchesTriangleCount: stlBack.indices.length === ring.mesh.indices.length,
      matchesBoundingBox: near(stlBox.min, box.min, 1e-4) && near(stlBox.max, box.max, 1e-4),
      matchesVolume: Math.abs(signedVolume(stlBack) - volume) <= Math.abs(volume) * 1e-6
    },
    "3dm": {
      units: dmBack.units,
      layer: dmBack.layerName,
      vertices: dmBack.vertexCount,
      triangles: dmBack.triangleCount,
      unitsAreMillimetres: dmBack.units === "Millimeters",
      matchesTriangleCount: dmBack.triangleCount === ring.mesh.indices.length / 3,
      matchesVertexCount: dmBack.vertexCount === ring.mesh.positions.length / 3,
      matchesBoundingBox: near(dmBack.bbox.min, box.min, 1e-4) && near(dmBack.bbox.max, box.max, 1e-4),
      metadataIntact: Object.entries(meta).every(([k, v]) => dmBack.userStrings[k] === v)
    }
  };
  // Every yes/no comparison must be true (descriptive fields such as "units" are excluded).
  const reopenOk = Object.values(reopen).every((r) => Object.values(r).every((v) => typeof v !== "boolean" || v));

  // --- Validation ---------------------------------------------------------
  const minFeatureMm = opts.minFeatureMm ?? null;
  const minRimAngleDeg = opts.minRimAngleDeg ?? null;
  const thresholds = [
    opts.minWallMm === null ? "" : `wall-${opts.minWallMm}mm`,
    minFeatureMm === null ? "" : `feature-${minFeatureMm}mm`,
    minRimAngleDeg === null ? "" : `rim-${minRimAngleDeg}deg`
  ].filter(Boolean);
  const validated = validation.validateMesh(ring.mesh, {
    productType: "terrain_ring",
    profile: {
      // Thresholds passed on the command line are a reviewer's choice for this run, never an approval.
      id: thresholds.length ? `review-${thresholds.join("-")}` : "awaiting-manufacturer",
      approved: false,
      minWallMm: opts.minWallMm,
      minFeatureMm,
      maxReliefMm: ring.preset.maxReliefMm
    },
    densityGcm3: ring.densityGcm3,
    reliefMm: ring.reliefMm,
    surfaceLabels: ring.mesh.surfaceLabels
  });
  const rim = validation.rimAngleCheck(
    { ...ring.terrain, faceLengthMm: ring.preset.faceLengthMm, faceWidthMm: ring.preset.faceWidthMm, cornerRadiusMm: ring.preset.cornerRadiusMm },
    minRimAngleDeg
  );
  const report = validation.withCheck(validated, "minimumRimAngle", rim.check, rim.error);
  const { wall, feature, ...reportBody } = report;
  const below = (values: number[], mm: number) => +((100 * values.filter((v) => v < mm).length) / Math.max(1, values.length)).toFixed(2);
  const bands = (values: number[], mms: number[]) => Object.fromEntries(mms.map((mm) => [`${mm}mm`, below(values, mm)]));
  const validationReport = {
    ...reportBody,
    reopen,
    reopenPassed: reopenOk,
    distributions: {
      structuralWall: {
        percentBelow: bands(wall.values, [0.6, 0.8, 1.0, 1.2, 1.4, 1.8]),
        note: "Share of structural samples (metal between the outside and the finger) below each value. Reporting bands, not requirements."
      },
      ...(feature
        ? {
            terrainFeatureSize: {
              percentBelow: bands(feature.values, [0.2, 0.3, 0.5, 0.8]),
              note: "Share of sampled terrain whose sphere-method feature size is below each value. Small values mean sharp crests, narrow ridges or rim knife-edges; they do not mean missing metal behind the surface. Reporting bands, not requirements."
            }
          }
        : {})
    },
    limitations: [
      "Ray-cast thickness is sampled at triangle centroids; the structural figure counts only rays that start or end on the finger surface.",
      "The sphere method is capped at 2 mm and sampled on terrain triangles; it measures sharpness and narrowness, which polishing will also reduce.",
      "The rim angle is measured from the height data along both long sides, assuming the head wall is vertical there; the plan corners and face ends are not covered.",
      "No check here establishes casting suitability; that requires the manufacturer's approved minimums and a physical sample."
    ]
  };
  writeFileSync(join(spec, "validation-report.json"), JSON.stringify(validationReport, null, 2));

  // --- Source -------------------------------------------------------------
  writeFileSync(join(src, "design-parameters.json"), JSON.stringify({ ...designParameters, designHash, designRef }, null, 2));
  writeFileSync(join(src, "heightmap.bin"), heightmapBytes);
  writeFileSync(join(src, "heightmap-metadata.json"), JSON.stringify({
    format: "float32 little-endian, row-major, metres above sea level",
    cols: ring.elevations.cols, rows: ring.elevations.rows,
    rowOrder: "row 0 = top of the frame (bearing direction)", colOrder: "col 0 = left of the frame",
    groundLengthM: ring.lengthM, groundWidthM: ring.area.widthM, bearingDeg: config.bearingDeg,
    savedSource: { place: config.place, id: saved.meta.id, sha256: sha256(saved.png) },
    sha256: sha256(heightmapBytes)
  }, null, 2));

  // --- Visuals --------------------------------------------------------------
  const renders: Record<string, string> = { "render-front.png": "front.png", "render-side.png": "side.png", "render-three-quarter.png": "three_quarter.png" };
  const rendersIncluded: string[] = [];
  if (opts.rendersDir)
    for (const [to, from] of Object.entries(renders))
      if (existsSync(join(opts.rendersDir, from))) { copyFileSync(join(opts.rendersDir, from), join(visuals, to)); rendersIncluded.push(to); }

  // --- Specification --------------------------------------------------------
  const p = ring.preset;
  const productionSpec = {
    packageFormat: PACKAGE_FORMAT_VERSION,
    status: report.status === "pass" && reopenOk ? "ready_for_release" : "review_only",
    statusReason: "No approved manufacturer constraint profile exists yet; this package is for manufacturer review and sample approval only.",
    orderRef: opts.orderRef,
    designRef,
    designHash,
    product: "À Vie Terrain Ring",
    productType: "terrain_ring",
    units: "millimetres",
    scale: "1:1 finished nominal dimensions (no shrinkage compensation, supports or sprues added)",
    orientation: "Finger axis = Z. Ring circle in the XY plane. Head (terrain face) at +Y. Top of the map points to −Z.",
    dimensions: {
      ringSizeUk: config.ringSize,
      innerDiameterMm: +ring.innerDiameterMm.toFixed(3),
      faceMm: { length: p.faceLengthMm, width: p.faceWidthMm },
      bandMm: { width: p.bandWidthMm, thickness: p.bandThicknessMm },
      substrateUnderTerrainMm: Math.max(p.headHeightMm, 0.8),
      terrainReliefMm: +ring.reliefMm.toFixed(3),
      boundingBoxMm: box.size.map((v) => +v.toFixed(3))
    },
    material: { metal: config.metal, finish: config.finish, terrainFace: "textured relief (lightly matte)", body: config.finish },
    estimatedMassG: +((volume / 1000) * ring.densityGcm3).toFixed(2),
    volumeCm3: +(volume / 1000).toFixed(4),
    files: {
      "01_cad/terrain-ring.3dm": `Rhino-compatible 3DM. ${REPRESENTATION_NOTE}. Millimetres. Layer "Terra final mesh".`,
      "01_cad/terrain-ring.stl": "Binary STL, millimetres, 1:1, the same mesh as the 3DM.",
      "02_specification/validation-report.json": "Automated mesh checks with measured values.",
      "04_source/*": "Exact terrain samples and parameters to regenerate this mesh."
    },
    notGenerated: [
      "production-spec.pdf (planned next milestone; this JSON is authoritative)",
      ...Object.keys(renders).filter((r) => !rendersIncluded.includes(r)).map((r) => `03_visuals/${r}`)
    ],
    productionNotes: [
      "Terrain face: textured relief; do not polish into the valleys. Body and shoulders: polished.",
      "Hand finishing will soften the finest terrain detail; preserve main ridgelines.",
      "Verify the inner diameter against the UK size before casting."
    ],
    qcChecklist: [
      "Inner diameter matches UK size", "Face dimensions match", "Terrain matches the 3D preview",
      "No porosity, cracks or pits", "Edges smooth to the touch", "Correct metal and finish", "Hallmark where required"
    ],
    claims: {
      editableNurbs: false,
      castingReady: false,
      note: "Closed, manifold mesh only. Casting suitability requires the manufacturer's review and a physical sample."
    }
  };
  writeFileSync(join(spec, "production-spec.json"), JSON.stringify(productionSpec, null, 2));

  // --- Manifest (last, over every other file) ------------------------------
  const files: { path: string; bytes: number; sha256: string }[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d).sort()) {
      const full = join(d, f);
      if (statSync(full).isDirectory()) walk(full);
      else files.push({ path: relative(root, full), bytes: statSync(full).size, sha256: sha256(readFileSync(full)) });
    }
  };
  walk(root);
  writeFileSync(join(spec, "checksum-manifest.json"), JSON.stringify({ packageFormat: PACKAGE_FORMAT_VERSION, algorithm: "SHA-256", files }, null, 2));

  return { root, designRef, designHash, meshHash, report: validationReport, spec: productionSpec, reopenOk };
}
