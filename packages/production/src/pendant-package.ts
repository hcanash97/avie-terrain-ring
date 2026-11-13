/**
 * Review-only manufacturer package for a pendant prototype (any style).
 *
 *   <ORDER>_<PD-hash>/
 *   ├─ 01_cad/terrain-pendant.3dm, terrain-pendant.stl   one solid: body with its attachment
 *   ├─ 02_specification/production-spec.json, validation-report.json, checksum-manifest.json
 *   ├─ 03_visuals/render-*.png (when supplied)
 *   └─ 04_source/design-parameters.json, heightmap.bin, heightmap-metadata.json
 *
 * The attachment is part of the solid (a channel cut by exact boolean, or a
 * loop or tab united with the body). Always review-only: the dimensions come
 * from a preview-only style profile, joint strength and chain fit are not
 * assessed, and no manufacturing requirement is approved.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { validation } from "@avie/geometry";
import { availabilityOf } from "@avie/product-types";
import { boundingBox, signedVolume, weld } from "./mesh";
import { canonical, PACKAGE_FORMAT_VERSION, sha256 } from "./package-builder";
import { buildProductionPendant, PENDANT_PRODUCTION_RESOLUTION, type PendantConfiguration } from "./pendant-source";
import { read3dmComponents, REPRESENTATION_NOTE, write3dmComponents } from "./rhino-3dm";
import { loadSavedTerrain } from "./ring-source";
import { readBinaryStl, writeBinaryStl } from "./stl";

export const PENDANT_LAYER = "Terra pendant";

export type PendantPackageOptions = {
  config: PendantConfiguration;
  orderRef: string; // never customer personal data
  outDir: string;
  geometryVersion: string;
  rendersDir?: string; // front.png, side.png, three_quarter.png
};

export async function buildPendantPackage(opts: PendantPackageOptions) {
  const { config } = opts;
  const pd = await buildProductionPendant(config);
  const designParameters = {
    productType: "terrain_pendant",
    presetId: pd.preset.id,
    style: pd.style.id,
    previewProfile: pd.params.profileId,
    terrain: { place: config.place, lengthM: pd.lengthM, widthM: pd.area.widthM, bearingDeg: config.bearingDeg, terrainHeight: config.terrainHeight, detail: config.detail },
    pendant: { outline: pd.params.outline, baseThicknessMm: pd.params.baseThicknessMm, edgeRoundMm: pd.params.edgeRoundMm, fadeMm: pd.params.fadeMm, coverage: pd.params.coverage, maximumReliefMm: pd.params.maximumReliefMm, attachment: pd.params.attachment },
    material: { metal: config.metal, finish: config.finish, densityGcm3: pd.densityGcm3 },
    resolution: PENDANT_PRODUCTION_RESOLUTION,
    geometryVersion: opts.geometryVersion,
  };
  const heightmapBytes = new Uint8Array(pd.elevations.data.buffer.slice(0));
  const designHash = sha256(canonical(designParameters) + sha256(heightmapBytes));
  const designRef = `PD-${designHash.slice(0, 7).toUpperCase()}`;
  const root = join(opts.outDir, `ORDER-${opts.orderRef}_${designRef}`);
  if (existsSync(root)) rmSync(root, { recursive: true });
  const dir = (p: string) => { mkdirSync(join(root, p), { recursive: true }); return join(root, p); };
  const cad = dir("01_cad"), spec = dir("02_specification"), visuals = dir("03_visuals"), src = dir("04_source");

  // --- CAD: one solid ---------------------------------------------------------
  const stlBytes = writeBinaryStl(pd.mesh, `Terra pendant ${designRef} mm 1:1`);
  const meshHash = sha256(stlBytes);
  const documentMeta: Record<string, string> = {
    designRef, designHash, orderRef: opts.orderRef, productType: "terrain_pendant", presetId: pd.preset.id, style: pd.style.id,
    previewProfile: pd.params.profileId, geometryVersion: opts.geometryVersion, packageFormat: PACKAGE_FORMAT_VERSION,
    status: "review_only", attachment: pd.params.attachment.kind, meshSha256OfStl: meshHash,
  };
  const dm = await write3dmComponents([{ mesh: pd.mesh, layer: PENDANT_LAYER, name: `Terra pendant ${designRef}`, metadata: { component: "pendant", attachment: pd.params.attachment.kind } }], documentMeta);
  writeFileSync(join(cad, "terrain-pendant.stl"), stlBytes);
  writeFileSync(join(cad, "terrain-pendant.3dm"), dm);

  // --- Reopen checks: both files must reproduce the solid ----------------------
  const near = (a: number[], b: number[], tol: number) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
  const box = boundingBox(pd.mesh), volume = signedVolume(pd.mesh);
  const back = weld(readBinaryStl(readFileSync(join(cad, "terrain-pendant.stl"))).mesh);
  const dmBack = await read3dmComponents(readFileSync(join(cad, "terrain-pendant.3dm")), ["component", "units"], Object.keys(documentMeta));
  const obj = dmBack.objects[0];
  const reopen = {
    stl: {
      triangles: back.indices.length / 3,
      matchesTriangleCount: back.indices.length === pd.mesh.indices.length,
      matchesBoundingBox: near(boundingBox(back).min, box.min, 1e-4) && near(boundingBox(back).max, box.max, 1e-4),
      matchesVolume: Math.abs(signedVolume(back) - volume) <= Math.abs(volume) * 1e-6,
    },
    "3dm": {
      units: dmBack.units,
      layer: obj?.layerName ?? null,
      unitsAreMillimetres: dmBack.units === "Millimeters",
      singleObject: dmBack.objects.length === 1,
      onExpectedLayer: obj?.layerName === PENDANT_LAYER,
      matchesTriangleCount: obj?.triangleCount === pd.mesh.indices.length / 3,
      matchesVertexCount: obj?.vertexCount === pd.mesh.positions.length / 3,
      matchesBoundingBox: obj ? near(obj.bbox.min, box.min, 1e-4) && near(obj.bbox.max, box.max, 1e-4) : false,
      metadataIntact: Object.entries(documentMeta).every(([k, v]) => dmBack.documentStrings[k] === v),
    },
  };
  const reopenOk = Object.values(reopen).every((r) => Object.values(r).every((v) => typeof v !== "boolean" || v));

  // --- Validation: the solid, plus what cannot be assessed ------------------------
  const profile = { id: "awaiting-manufacturer", approved: false, minWallMm: null, minFeatureMm: null, maxReliefMm: null };
  const reliefMm = Math.max(0, pd.built.dimensions.body.depthMm - pd.params.baseThicknessMm);
  const { wall, feature, ...solidReport } = validation.validateMesh(pd.mesh, {
    productType: "terrain_pendant", profile, densityGcm3: pd.densityGcm3, reliefMm, surfaceLabels: pd.mesh.surfaceLabels,
  });
  void wall;
  void feature;
  const attachmentChecks = Object.fromEntries(
    pd.built.checks.map((c) => [c.name, { status: c.ok ? ("pass" as const) : ("fail" as const), method: "geometric validity only (greater than zero); no manufacturing minimum applied", note: c.detail }]),
  );
  const extra = {
    ...attachmentChecks,
    genus: { status: pd.built.genus === (pd.params.attachment.kind === "none" ? 0 : 1) ? ("pass" as const) : ("fail" as const), method: "holes through the solid (manifold genus)", measured: pd.built.genus, note: "Expected 1: the chain channel, or the opening of the loop or tab." },
    attachmentStrength: { status: "not_run" as const, method: "none", note: "Joint strength, chain fit and wear are not assessed; they need the manufacturer and the chosen chain." },
    minimumRimAngle: { status: "not_run" as const, method: "not implemented for pendant outlines", note: "The ring's rim check covers straight long sides of a rectangular face; a perimeter-wide version for pendants is planned." },
  };
  const valid = solidReport.valid && Object.values(attachmentChecks).every((c) => c.status === "pass") && extra.genus.status === "pass";
  const availability = availabilityOf(pd.preset);
  const validationReport = {
    ...solidReport,
    valid,
    status: valid ? "held_for_review" : "fail",
    checks: { ...solidReport.checks, ...extra } as Record<string, validation.Check> & typeof extra,
    reopen,
    reopenPassed: reopenOk,
    limitations: [
      "Body and attachment are one solid, joined by exact mesh booleans (seams cleaned within 0.0001 mm). Joint strength is not assessed.",
      "Structural wall includes the metal around the chain channel, where present; it is reported, not judged.",
      "Dimensions come from a preview-only style profile; no manufacturing requirement is approved, so nothing is judged against a minimum.",
      "Feature size is measured by the sphere method on terrain triangles and reported only.",
      "No check here establishes casting suitability; that requires the manufacturer's approved requirements and a physical sample.",
    ],
  };
  writeFileSync(join(spec, "validation-report.json"), JSON.stringify(validationReport, null, 2));

  // --- Source ----------------------------------------------------------------
  const saved = loadSavedTerrain(config.place);
  writeFileSync(join(src, "design-parameters.json"), JSON.stringify({ ...designParameters, designHash, designRef }, null, 2));
  writeFileSync(join(src, "heightmap.bin"), heightmapBytes);
  writeFileSync(join(src, "heightmap-metadata.json"), JSON.stringify({
    format: "float32 little-endian, row-major, metres above sea level",
    cols: pd.elevations.cols, rows: pd.elevations.rows,
    rowOrder: "row 0 = north edge of the frame at bearing 0 (towards the top of the piece)", colOrder: "col 0 = west edge (left)",
    crop: "frame of the body's own width and height, masked to its outline (cropped, not stretched)",
    groundLengthM: pd.lengthM, groundWidthM: pd.area.widthM, bearingDeg: config.bearingDeg,
    savedSource: { place: config.place, id: saved.meta.id, sha256: sha256(saved.png) },
    sha256: sha256(heightmapBytes),
  }, null, 2));

  // --- Visuals -----------------------------------------------------------------
  const renders: Record<string, string> = { "render-front.png": "front.png", "render-side.png": "side.png", "render-three-quarter.png": "three_quarter.png" };
  const rendersIncluded: string[] = [];
  if (opts.rendersDir)
    for (const [to, from] of Object.entries(renders))
      if (existsSync(join(opts.rendersDir, from))) { copyFileSync(join(opts.rendersDir, from), join(visuals, to)); rendersIncluded.push(to); }

  // --- Specification -----------------------------------------------------------
  const d = pd.built.dimensions;
  const productionSpec = {
    packageFormat: PACKAGE_FORMAT_VERSION,
    status: "review_only",
    statusReason: "Prototype for manufacturer review. Dimensions come from a preview-only style profile, joint strength and chain fit are not assessed, and no manufacturing requirement is approved.",
    releaseBlockedBy: availability.blockedBy.manufacturingRelease,
    orderRef: opts.orderRef,
    designRef,
    designHash,
    product: `À Vie Terra Pendant, ${pd.style.label} (prototype)`,
    productType: "terrain_pendant",
    presetId: pd.preset.id,
    style: { id: pd.style.id, label: pd.style.label, attachment: pd.params.attachment, note: pd.style.attachmentNote },
    units: "millimetres",
    scale: "1:1 finished nominal dimensions (no shrinkage compensation, supports or sprues added)",
    coordinateSystem: "Right-handed, the piece lying face-up: origin at the body centre on the back plane; +Y relief; +X right seen from the front; top of the piece towards −Z. Terrain north towards the top. STL files carry no units: coordinates are millimetres.",
    dimensions: { body: { ...d.body, terrainReliefMm: +reliefMm.toFixed(3) }, overall: { ...d.overall, note: "Including the attachment." } },
    terrainCoverage: pd.params.coverage,
    estimatedMassG: { value: +((d.volumeMm3 / 1000) * pd.densityGcm3).toFixed(2), metal: config.metal },
    previewOnlyValues: Object.fromEntries(Object.entries(pd.style.values).map(([k, v]) => [k, { value: v.value, status: v.status, note: v.note }])),
    manufacturingRequirements: Object.fromEntries(Object.entries(pd.preset.manufacturing).map(([k, v]) => [k, { value: v.value, status: v.status, owner: v.owner, note: v.note }])),
    components: [
      { id: "pendant", generated: true, attachmentIncluded: pd.params.attachment.kind, files: ["01_cad/terrain-pendant.stl", `01_cad/terrain-pendant.3dm (layer "${PENDANT_LAYER}")`] },
      { id: "chain", generated: false, supplied: true, status: "awaiting an approved supplied chain; not part of the cast pendant" },
    ],
    files: {
      "01_cad/terrain-pendant.3dm": `Rhino 3DM, one mesh object (${REPRESENTATION_NOTE}), millimetres.`,
      "01_cad/terrain-pendant.stl": "Binary STL of the same solid.",
      "02_specification/validation-report.json": "Automated checks with methods and limitations.",
      "04_source/heightmap.bin": "Exact elevation samples the face was built from.",
    },
    notGenerated: ["production-spec.pdf (this JSON is authoritative)", ...Object.keys(renders).filter((r) => !rendersIncluded.includes(r)).map((r) => `03_visuals/${r}`)],
    questionsForManufacturer: [
      "Base thickness, maximum relief, minimum feature size and edge radius for this alloy.",
      pd.params.attachment.kind === "through_hole" ? "Chain channel: diameter, wall around it and position, for the chosen chain." : "Bail: section, opening and joint to the body, for the chosen chain.",
      "Which chain, and its end-fitting dimensions, the attachment must suit.",
      "Is a mesh 3DM acceptable, and in which Rhino version?",
      "Who adds shrinkage, supports and sprues?",
    ],
    qcChecklist: ["Body width, height and depth match", "Terrain matches the preview", "Edges even all round", "Chain passes freely through the attachment", "No porosity, cracks or pits", "Correct metal and finish", "Hallmark where required"],
    claims: { editableNurbs: false, castingReady: false, attachmentStrengthAssessed: false, note: "One closed mesh solid. Casting suitability requires the manufacturer's review and a physical sample." },
  };
  writeFileSync(join(spec, "production-spec.json"), JSON.stringify(productionSpec, null, 2));

  // --- Manifest (last, over every other file) ------------------------------------
  const files: { path: string; bytes: number; sha256: string }[] = [];
  const walk = (p: string) => {
    for (const f of readdirSync(p).sort()) {
      const full = join(p, f);
      if (statSync(full).isDirectory()) walk(full);
      else files.push({ path: relative(root, full), bytes: statSync(full).size, sha256: sha256(readFileSync(full)) });
    }
  };
  walk(root);
  writeFileSync(join(spec, "checksum-manifest.json"), JSON.stringify({ packageFormat: PACKAGE_FORMAT_VERSION, algorithm: "SHA-256", files }, null, 2));

  return { root, designRef, designHash, meshHash, report: validationReport, spec: productionSpec, reopenOk };
}

