/**
 * Pendant attachments, combined with the body into ONE solid by exact mesh
 * booleans (manifold-3d): a through-hole is subtracted, a loop or tab bail is
 * united. The result is geometrically joined; how strong the joint is, and how
 * a chain sits in it, remain for the manufacturer to assess.
 *
 *   through_hole  hidden channel along X for the chain (a "slider")
 *   loop          round-section ring above the top edge, opening along X
 *   tab           flat folded strap above the top edge, opening along X
 *   eye           round-section ring above the top edge lying in the plane of
 *                 the face, opening front to back (a charm's fixed loop, for a
 *                 jump ring or clasp)
 */
import Module from "manifold-3d";
import type { TerrainProductMesh } from "../shared/types";
import { SURFACE_LABEL, signedVolume } from "./body";
import type { PendantOutline } from "./outline";

export type PendantAttachment =
  | { kind: "none" }
  | { kind: "through_hole"; diameterMm: number; centreFromTopMm: number; centreHeightMm: number }
  | { kind: "loop"; openingHeightMm: number; openingDepthMm: number; wallMm: number; embedMm: number }
  | { kind: "tab"; widthMm: number; thicknessMm: number; openingHeightMm: number; openingDepthMm: number; embedMm: number }
  | { kind: "eye"; openingHeightMm: number; openingWidthMm: number; wallMm: number; embedMm: number };

/** Largest surface movement allowed when cleaning boolean seams. */
export const SEAM_TOLERANCE_MM = 1e-4;
/** Longest triangle edge kept after the boolean (split without moving any surface). */
export const MAX_EDGE_MM = 0.5;

type Wasm = Awaited<ReturnType<typeof Module>>;
let wasmPromise: Promise<Wasm> | null = null;
let wasmUrl: string | null = null;

/**
 * Where the boolean engine's WASM file lives. Node finds it next to the
 * package; a bundled browser app must pass the file's URL (for example Vite's
 * `manifold-3d/manifold.wasm?url`) before the first pendant is built.
 */
export function configureManifoldWasm(url: string) {
  if (wasmPromise && url !== wasmUrl) throw new Error("The boolean engine is already loaded");
  wasmUrl = url;
}

const manifold = () => {
  if (!wasmPromise) {
    // Single-file review hosts may block fetch(data:). Decode the bundled bytes
    // directly instead of asking Emscripten to fetch its inline asset.
    const inline = wasmUrl?.startsWith("data:application/wasm;base64,")
      ? Uint8Array.from(atob(wasmUrl.split(",")[1]!), (c) => c.charCodeAt(0))
      : undefined;
    // The package’s declaration omits Emscripten’s supported wasmBinary option.
    const options = { locateFile: () => wasmUrl!, ...(inline ? { wasmBinary: inline } : {}) };
    wasmPromise = (wasmUrl ? Module(options) : Module())
      .then((w) => { w.setup(); return w; })
      .catch((error: unknown) => { wasmPromise = null; throw error; });
  }
  return wasmPromise;
};

/**
 * Closed ring: a section swept round an ellipse. In the Y–Z plane (opening along
 * X) the ellipse's first semi-axis runs along Y; in the X–Z plane (opening along
 * Y, the face plane) it runs along X. The section's first coordinate lies along
 * the opening axis, its second along the ellipse normal.
 */
function sweptLoop(centre: { y: number; z: number }, a1: number, az: number, section: [number, number][], segments: number, plane: "yz" | "xz" = "yz") {
  const positions: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const p1 = a1 * Math.cos(t), pz = centre.z + az * Math.sin(t);
    let n1 = Math.cos(t) / a1, nz = Math.sin(t) / az;
    const l = Math.hypot(n1, nz);
    n1 /= l; nz /= l;
    for (const [sa, sn] of section)
      if (plane === "yz") positions.push(sa, centre.y + p1 + n1 * sn, pz + nz * sn);
      else positions.push(p1 + n1 * sn, centre.y + sa, pz + nz * sn);
  }
  const n = section.length, indices: number[] = [];
  for (let i = 0; i < segments; i++)
    for (let k = 0; k < n; k++) {
      const a = i * n + k, b = i * n + ((k + 1) % n), c = ((i + 1) % segments) * n + k, d = ((i + 1) % segments) * n + ((k + 1) % n);
      indices.push(a, c, b, b, c, d);
    }
  const m = { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  if (signedVolume(m) < 0) for (let t = 0; t < m.indices.length; t += 3) [m.indices[t + 1], m.indices[t + 2]] = [m.indices[t + 2]!, m.indices[t + 1]!];
  return m;
}

const roundSection = (diameter: number, n: number): [number, number][] =>
  Array.from({ length: n }, (_, k) => [Math.sin((2 * Math.PI * k) / n) * diameter / 2, Math.cos((2 * Math.PI * k) / n) * diameter / 2]);
/** A flat strap section with softened corners: wide along X, thin through the loop wall. */
function strapSection(width: number, thickness: number): [number, number][] {
  const r = Math.min(thickness / 2, width / 2) * 0.9, hw = width / 2 - r, ht = thickness / 2 - r, pts: [number, number][] = [];
  const corners: [number, number, number][] = [[hw, ht, 0], [-hw, ht, Math.PI / 2], [-hw, -ht, Math.PI], [hw, -ht, (3 * Math.PI) / 2]];
  for (const [cx, cn, a0] of corners) for (let k = 0; k <= 3; k++) { const a = a0 + (Math.PI / 2) * (k / 3); pts.push([cx + r * Math.cos(a), cn + r * Math.sin(a)]); }
  return pts;
}

export type FinishedPendant = {
  mesh: TerrainProductMesh;
  attachment: PendantAttachment;
  genus: number;
  joined: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
};

/** Combines body and attachment into one solid and carries surface labels and terrain blend across. */
export async function finishPendant(body: TerrainProductMesh, outline: PendantOutline, baseThicknessMm: number, attachment: PendantAttachment, segments = 64): Promise<FinishedPendant> {
  const w = await manifold();
  const labels = body.surfaceLabels;
  if (!labels) throw new Error("Body must carry surface labels");
  const props = new Float32Array((body.positions.length / 3) * 4);
  for (let i = 0; i < body.positions.length / 3; i++) {
    props[i * 4] = body.positions[i * 3]!; props[i * 4 + 1] = body.positions[i * 3 + 1]!; props[i * 4 + 2] = body.positions[i * 3 + 2]!;
    props[i * 4 + 3] = body.terrainBlend[i]!;
  }
  // A reserved original ID plus face IDs survive the boolean, so every output
  // triangle can be traced to the body and its label. The face ID IS the label:
  // simplification never merges across face IDs, so unique per-triangle IDs
  // would stop seam slivers from being cleaned.
  const bodyId = w.Manifold.reserveIDs(1);
  const nt0 = body.indices.length / 3;
  const bodyMesh = new w.Mesh({
    numProp: 4,
    vertProperties: props,
    triVerts: new Uint32Array(body.indices),
    runIndex: new Uint32Array([0, nt0 * 3]),
    runOriginalID: new Uint32Array([bodyId]),
    faceID: Uint32Array.from(labels),
  });
  bodyMesh.merge();
  const solidBody = new w.Manifold(bodyMesh);
  const checks: FinishedPendant["checks"] = [];
  const top = -outline.heightMm / 2;
  let result = solidBody;

  if (attachment.kind === "through_hole") {
    const r = attachment.diameterMm / 2, zc = top + attachment.centreFromTopMm, yc = attachment.centreHeightMm;
    checks.push({ name: "holeBelowTopEdge", ok: attachment.centreFromTopMm - r > 0, detail: `${(attachment.centreFromTopMm - r).toFixed(2)} mm of metal above the hole` });
    checks.push({ name: "holeInsideBase", ok: yc - r > 0 && yc + r < baseThicknessMm, detail: `back wall ${(yc - r).toFixed(2)} mm, front wall ${(baseThicknessMm - yc - r).toFixed(2)} mm (under the terrain baseline)` });
    const hole = w.Manifold.cylinder(outline.widthMm + 4, r, r, segments, true).rotate([0, 90, 0]).translate([0, yc, zc]);
    result = solidBody.subtract(hole);
  } else if (attachment.kind === "loop" || attachment.kind === "tab") {
    const sectionDepth = attachment.kind === "loop" ? attachment.wallMm : attachment.thicknessMm;
    const ay = attachment.openingDepthMm / 2 + sectionDepth / 2, az = attachment.openingHeightMm / 2 + sectionDepth / 2;
    const centre = { y: baseThicknessMm / 2, z: top - az - sectionDepth / 2 + attachment.embedMm };
    const section = attachment.kind === "loop" ? roundSection(attachment.wallMm, 24) : strapSection(attachment.widthMm, attachment.thicknessMm);
    const ring = sweptLoop(centre, ay, az, section, segments * 2);
    const ringMesh = new w.Mesh({ numProp: 3, vertProperties: ring.positions, triVerts: ring.indices });
    ringMesh.merge();
    result = solidBody.add(new w.Manifold(ringMesh));
    checks.push({ name: "attachmentOverlapsBody", ok: attachment.embedMm > 0, detail: `reaches ${attachment.embedMm} mm into the top edge` });
  } else if (attachment.kind === "eye") {
    const wire = attachment.wallMm;
    const ax = attachment.openingWidthMm / 2 + wire / 2, az = attachment.openingHeightMm / 2 + wire / 2;
    const centre = { y: baseThicknessMm / 2, z: top - az - wire / 2 + attachment.embedMm };
    const ring = sweptLoop(centre, ax, az, roundSection(wire, 24), segments * 2, "xz");
    const ringMesh = new w.Mesh({ numProp: 3, vertProperties: ring.positions, triVerts: ring.indices });
    ringMesh.merge();
    result = solidBody.add(new w.Manifold(ringMesh));
    checks.push({ name: "attachmentOverlapsBody", ok: attachment.embedMm > 0, detail: `reaches ${attachment.embedMm} mm into the top edge` });
    checks.push({ name: "eyeWithinBodyDepth", ok: wire <= baseThicknessMm, detail: `wire ${wire} mm against ${baseThicknessMm} mm of base under the terrain` });
  }

  // Booleans can leave slivers at the seam; simplify removes triangles that are
  // degenerate within 0.0001 mm and moves no surface by more than that.
  // Simplifying merges flat faces into long, thin coplanar triangles; splitting
  // edges longer than MAX_EDGE_MM moves no surface but keeps triangles well
  // shaped for shading and for slicing software.
  if (result !== solidBody) {
    const cleaned = result.simplify(SEAM_TOLERANCE_MM);
    result.delete();
    const refined = cleaned.refineToLength(MAX_EDGE_MM);
    cleaned.delete();
    result = refined;
  }
  const status = result.status();
  const out = result.getMesh();
  const numProp = out.numProp;
  // The output splits vertices where properties differ; the merge lists say which
  // copies are the same point. Weld them, then keep only vertices in use.
  const nvRaw = out.vertProperties.length / numProp;
  const to = Uint32Array.from({ length: nvRaw }, (_, i) => i);
  for (let k = 0; k < out.mergeFromVert.length; k++) to[out.mergeFromVert[k]!] = out.mergeToVert[k]!;
  const used = new Int32Array(nvRaw).fill(-1);
  let nv = 0;
  for (const v of out.triVerts) if (used[to[v]!] === -1) used[to[v]!] = nv++;
  const positions = new Float32Array(nv * 3), blend = new Float32Array(nv);
  for (let i = 0; i < nvRaw; i++) {
    const k = used[i]!;
    if (k < 0) continue;
    positions[k * 3] = out.vertProperties[i * numProp]!; positions[k * 3 + 1] = out.vertProperties[i * numProp + 1]!; positions[k * 3 + 2] = out.vertProperties[i * numProp + 2]!;
    blend[k] = numProp > 3 ? out.vertProperties[i * numProp + 3]! : 0;
  }
  const vert = (v: number) => used[to[v]!]!;
  // Label each output triangle from its source: body triangles keep their label;
  // surfaces from the cutter are channel walls, from a loop or tab attachment.
  const fromAttachment = attachment.kind === "through_hole" ? SURFACE_LABEL.channel : SURFACE_LABEL.attachment;
  const nt = out.triVerts.length / 3, triLabel = new Uint8Array(nt);
  const runs = out.runIndex, ids = out.runOriginalID;
  for (let r = 0; r < ids.length; r++)
    for (let t = runs[r]! / 3; t < runs[r + 1]! / 3; t++) triLabel[t] = ids[r] === bodyId ? out.faceID[t]! : fromAttachment;
  const order = Array.from({ length: nt }, (_, t) => t).sort((a, b) => (triLabel[a] === SURFACE_LABEL.terrain ? 0 : 1) - (triLabel[b] === SURFACE_LABEL.terrain ? 0 : 1));
  const indices = new Uint32Array(nt * 3);
  order.forEach((t, k) => { indices[k * 3] = vert(out.triVerts[t * 3]!); indices[k * 3 + 1] = vert(out.triVerts[t * 3 + 1]!); indices[k * 3 + 2] = vert(out.triVerts[t * 3 + 2]!); });
  const genus = result.genus();
  // Free WASM memory held by intermediate solids.
  result.delete();
  if (result !== solidBody) solidBody.delete();
  return {
    mesh: {
      positions,
      indices,
      shade: new Float32Array(nv).fill(1),
      terrainBlend: blend,
      faceTriangleCount: order.filter((t) => triLabel[t] === SURFACE_LABEL.terrain).length,
      triangleCount: nt,
      terrainAdapted: false,
      surfaceLabels: Uint8Array.from(order, (t) => triLabel[t]!),
    },
    attachment,
    genus,
    joined: attachment.kind === "loop" || attachment.kind === "tab" || attachment.kind === "eye",
    checks: [{ name: "booleanStatus", ok: status === "NoError", detail: String(status) }, ...checks],
  };
}
