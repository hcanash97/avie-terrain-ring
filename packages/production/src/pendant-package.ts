/**
 * Review-only manufacturer package for the round pendant prototype.
 *
 *   <ORDER>_<PD-hash>/
 *   ├─ 01_cad/terrain-pendant.3dm               body and bail as separate objects on separate layers
 *   │         terrain-pendant-body.stl, terrain-pendant-bail.stl   one STL per component
 *   ├─ 02_specification/production-spec.json, validation-report.json, checksum-manifest.json
 *   ├─ 03_visuals/render-*.png (when supplied)
 *   └─ 04_source/design-parameters.json, heightmap.bin, heightmap-metadata.json
 *
 * Always review-only: the dimensions come from a preview-only profile, the bail
 * is an unjoined visual placeholder, and no manufacturing requirement is
 * approved. Components are never merged into one STL, because overlapping
 * shells are not a joined solid.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { validation } from "@avie/geometry";
import { availabilityOf, PENDANT_PREVIEW_PROFILE } from "@avie/product-types";
import { boundingBox, signedVolume, weld } from "./mesh";
import { canonical, PACKAGE_FORMAT_VERSION, sha256 } from "./package-builder";
import { buildProductionPendant, PENDANT_PRODUCTION_RESOLUTION, type PendantConfiguration } from "./pendant-source";
import { read3dmComponents, REPRESENTATION_NOTE, write3dmComponents } from "./rhino-3dm";
import { loadSavedTerrain } from "./ring-source";
import { readBinaryStl, writeBinaryStl } from "./stl";

export const BODY_LAYER = "Terra pendant body";
export const BAIL_LAYER = "Terra pendant bail (placeholder, not joined)";

export type PendantPackageOptions = {
  config: PendantConfiguration;
  orderRef: string; // never customer personal data
  outDir: string;
  geometryVersion: string;
  rendersDir?: string; // front.png, side.png, three_quarter.png
};

export async function buildPendantPackage(opts: PendantPackageOptions) {
  const { config } = opts;
  const pd = buildProductionPendant(config);
  const designParameters = {
    productType: "terrain_pendant",
    presetId: pd.preset.id,
    previewProfile: PENDANT_PREVIEW_PROFILE.id,
    terrain: { place: config.place, lengthM: pd.lengthM, widthM: pd.area.widthM, bearingDeg: config.bearingDeg, terrainHeight: config.terrainHeight, detail: config.detail },
    pendant: { shape: "round", diameterMm: pd.diameterMm, ...pd.preview },
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

  // --- CAD: each component separately --------------------------------------
  const components = [
    { id: "body", mesh: pd.body, file: "terrain-pendant-body.stl", layer: BODY_LAYER, role: "generated body" },
    { id: "bail", mesh: pd.bail, file: "terrain-pendant-bail.stl", layer: BAIL_LAYER, role: "visual placeholder bail, not joined to the body" },
  ];
  const stl = components.map((c) => writeBinaryStl(c.mesh, `Terra pendant ${c.id} ${designRef} mm 1:1`));
  const meshHashes = Object.fromEntries(components.map((c, i) => [c.id, sha256(stl[i]!)]));
  const documentMeta: Record<string, string> = {
    designRef, designHash, orderRef: opts.orderRef, productType: "terrain_pendant", presetId: pd.preset.id,
    previewProfile: PENDANT_PREVIEW_PROFILE.id, geometryVersion: opts.geometryVersion, packageFormat: PACKAGE_FORMAT_VERSION,
    status: "review_only", componentCount: String(components.length), assembly: pd.assembly.relationship,
  };
  const dm = await write3dmComponents(
    components.map((c) => ({ mesh: c.mesh, layer: c.layer, name: `Terra pendant ${c.id} ${designRef}`, metadata: { component: c.id, role: c.role, meshSha256OfStl: meshHashes[c.id]! } })),
    documentMeta,
  );
  components.forEach((c, i) => writeFileSync(join(cad, c.file), stl[i]!));
  writeFileSync(join(cad, "terrain-pendant.3dm"), dm);

  // --- Reopen checks: each file must reproduce its component -----------------
  const near = (a: number[], b: number[], tol: number) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
  const dmBack = await read3dmComponents(readFileSync(join(cad, "terrain-pendant.3dm")), ["component", "role", "units"], Object.keys(documentMeta));
  const reopen: Record<string, Record<string, unknown>> = {};
  components.forEach((c) => {
    const back = weld(readBinaryStl(readFileSync(join(cad, c.file))).mesh);
    const box = boundingBox(c.mesh), volume = signedVolume(c.mesh);
    const obj = dmBack.objects.find((o) => o.userStrings.component === c.id);
    reopen[`stl_${c.id}`] = {
      triangles: back.indices.length / 3,
      matchesTriangleCount: back.indices.length === c.mesh.indices.length,
      matchesBoundingBox: near(boundingBox(back).min, box.min, 1e-4) && near(boundingBox(back).max, box.max, 1e-4),
      matchesVolume: Math.abs(signedVolume(back) - volume) <= Math.abs(volume) * 1e-6,
    };
    reopen[`3dm_${c.id}`] = {
      layer: obj?.layerName ?? null,
      present: obj !== undefined,
      onExpectedLayer: obj?.layerName === c.layer,
      matchesTriangleCount: obj?.triangleCount === c.mesh.indices.length / 3,
      matchesVertexCount: obj?.vertexCount === c.mesh.positions.length / 3,
      matchesBoundingBox: obj ? near(obj.bbox.min, box.min, 1e-4) && near(obj.bbox.max, box.max, 1e-4) : false,
    };
  });
  reopen["3dm_document"] = {
    units: dmBack.units,
    unitsAreMillimetres: dmBack.units === "Millimeters",
    objectCountMatches: dmBack.objects.length === components.length,
    metadataIntact: Object.entries(documentMeta).every(([k, v]) => dmBack.documentStrings[k] === v),
  };
  const reopenOk = Object.values(reopen).every((r) => Object.values(r).every((v) => typeof v !== "boolean" || v));

  // --- Validation: per component, plus what cannot be assessed -----------------
  const profile = { id: "awaiting-manufacturer", approved: false, minWallMm: null, minFeatureMm: null, maxReliefMm: null };
  const reliefMm = pd.dimensions.body.depthMm - pd.preview.baseThicknessMm;
  /** The report as written: raw per-sample readings are left out of the JSON. */
  const summary = (r: ReturnType<typeof validation.validateMesh>) => {
    const { wall, feature, ...rest } = r;
    void wall;
    void feature;
    return rest;
  };
  const bodyReport = summary(validation.validateMesh(pd.body, {
    productType: "terrain_pendant", profile, densityGcm3: pd.densityGcm3, reliefMm, surfaceLabels: pd.body.surfaceLabels,
  }));
  const bailReport = summary(validation.validateMesh(pd.bail, { productType: "terrain_pendant", profile, densityGcm3: pd.densityGcm3 }));
  const assemblyCheck = {
    status: "not_run" as const,
    method: "none: no join between components is modelled",
    note: pd.assembly.relationship,
  };
  const rimCheck = {
    status: "not_run" as const,
    method: "not applicable as built: the terrain fades to a plain rim before the edge round",
    note: "The ring's rim-angle check measures terrain meeting a vertical wall; this pendant has no such junction.",
  };
  const valid = bodyReport.valid && bailReport.valid;
  const availability = availabilityOf(pd.preset);
  const validationReport = {
    productType: "terrain_pendant",
    validatorVersion: bodyReport.validatorVersion,
    valid,
    status: valid ? "held_for_review" : "fail",
    constraintProfile: { id: profile.id, approved: false },
    components: { body: bodyReport, bail: bailReport },
    checks: { componentJoin: assemblyCheck, minimumRimAngle: rimCheck },
    reopen,
    reopenPassed: reopenOk,
    limitations: [
      "Body and bail are validated separately. Overlapping shells are not a joined solid; the join is not assessed.",
      "Dimensions come from the preview-only profile; no manufacturing requirement is approved, so nothing is judged against a minimum.",
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
    rowOrder: "row 0 = north edge of the frame at bearing 0 (towards the bail)", colOrder: "col 0 = west edge (left)",
    crop: "square frame of side = body diameter, masked to the circle (cropped, not stretched)",
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
  const d = pd.dimensions;
  const massG = (mm3: number) => +((mm3 / 1000) * pd.densityGcm3).toFixed(2);
  const productionSpec = {
    packageFormat: PACKAGE_FORMAT_VERSION,
    status: "review_only",
    statusReason: "Prototype for manufacturer review. Dimensions come from a preview-only profile, the bail is an unjoined placeholder and no manufacturing requirement is approved.",
    releaseBlockedBy: availability.blockedBy.manufacturingRelease,
    orderRef: opts.orderRef,
    designRef,
    designHash,
    product: "À Vie Terra Pendant (prototype)",
    productType: "terrain_pendant",
    presetId: pd.preset.id,
    units: "millimetres",
    scale: "1:1 finished nominal dimensions (no shrinkage compensation, supports or sprues added)",
    coordinateSystem: "Right-handed, the piece lying face-up: origin at the body centre on the back plane; +Y relief; +X right seen from the front; bail towards −Z. Terrain north towards the bail. STL files carry no units: coordinates are millimetres.",
    dimensions: {
      body: { diameterMm: d.body.diameterMm, depthMm: d.body.depthMm, baseThicknessMm: pd.preview.baseThicknessMm, terrainReliefMm: +reliefMm.toFixed(3), note: "Body excludes the bail." },
      overall: { ...d.overall, note: "Including the bail." },
    },
    estimatedMassG: { body: massG(d.body.volumeMm3), bail: massG(d.bail!.volumeMm3), metal: config.metal, note: "Per component; the overlap between bail and body is not subtracted." },
    previewOnlyValues: Object.fromEntries(Object.entries(PENDANT_PREVIEW_PROFILE.values).map(([k, v]) => [k, { value: v.value, status: v.status, note: v.note }])),
    manufacturingRequirements: Object.fromEntries(Object.entries(pd.preset.manufacturing).map(([k, v]) => [k, { value: v.value, status: v.status, owner: v.owner, note: v.note }])),
    components: [
      { id: "body", generated: true, files: ["01_cad/terrain-pendant-body.stl", `01_cad/terrain-pendant.3dm (layer "${BODY_LAYER}")`] },
      { id: "bail", generated: true, visualPlaceholder: true, joinedToBody: false, files: ["01_cad/terrain-pendant-bail.stl", `01_cad/terrain-pendant.3dm (layer "${BAIL_LAYER}")`] },
      { id: "chain", generated: false, supplied: true, status: "awaiting an approved supplied chain; not part of the cast pendant" },
    ],
    assembly: pd.assembly.relationship,
    files: {
      "01_cad/terrain-pendant.3dm": `Rhino 3DM, two separate mesh objects (${REPRESENTATION_NOTE}), millimetres.`,
      "01_cad/terrain-pendant-body.stl": "Binary STL of the body only.",
      "01_cad/terrain-pendant-bail.stl": "Binary STL of the placeholder bail only.",
      "02_specification/validation-report.json": "Automated checks per component, with methods and limitations.",
      "04_source/heightmap.bin": "Exact elevation samples the face was built from.",
    },
    notGenerated: [
      "production-spec.pdf (this JSON is authoritative)",
      "a joined body-and-bail solid (the join is a manufacturer decision)",
      ...Object.keys(renders).filter((r) => !rendersIncluded.includes(r)).map((r) => `03_visuals/${r}`),
    ],
    questionsForManufacturer: [
      "Base thickness, maximum relief, minimum feature size and edge radius for this alloy.",
      "Bail design: integrated loop or separate bail, its section, opening and how it joins the body.",
      "Which chain, and its end-fitting dimensions, the bail must suit.",
      "Is a mesh 3DM with separate components acceptable, and in which Rhino version?",
      "Who adds shrinkage, supports and sprues?",
    ],
    qcChecklist: ["Body diameter and depth match", "Terrain matches the preview", "Plain rim even all round", "Bail opening suits the chosen chain", "No porosity, cracks or pits", "Correct metal and finish", "Hallmark where required"],
    claims: { editableNurbs: false, castingReady: false, joinedBail: false, note: "Separate closed meshes only. Casting suitability requires the manufacturer's review and a physical sample." },
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

  return { root, designRef, designHash, meshHashes, report: validationReport, spec: productionSpec, reopenOk };
}

