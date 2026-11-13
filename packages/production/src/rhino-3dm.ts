/**
 * Rhino-compatible 3DM written with McNeel's rhino3dm (no desktop Rhino needed).
 *
 * What this file IS: a 3DM container holding the final manufacturing triangle
 * mesh, in millimetres at 1:1, on a named layer, with provenance metadata.
 * What it is NOT: editable NURBS surfaces or a parametric Rhino model. The
 * metadata says so explicitly ("representation": "triangle mesh").
 */
import rhino3dmFactory from "rhino3dm";
import type { IndexedMesh } from "./mesh";

type Rhino = Awaited<ReturnType<typeof rhino3dmFactory>>;
let rhinoPromise: Promise<Rhino> | null = null;
const rhino = () => (rhinoPromise ??= rhino3dmFactory());

export const MESH_LAYER = "Terra final mesh";
export const REPRESENTATION_NOTE = "Triangle mesh (not NURBS, not parametric CAD)";

export async function write3dm(mesh: IndexedMesh, metadata: Record<string, string>): Promise<Uint8Array> {
  const r = await rhino();
  const doc = new r.File3dm();
  doc.settings().modelUnitSystem = r.UnitSystem.Millimeters;

  const layer = new r.Layer();
  layer.name = MESH_LAYER;
  const layerIndex = doc.layers().add(layer);

  const m = new r.Mesh();
  const P = mesh.positions, I = mesh.indices;
  for (let i = 0; i < P.length; i += 3) m.vertices().add(P[i]!, P[i + 1]!, P[i + 2]!);
  for (let t = 0; t < I.length; t += 3) m.faces().addTriFace(I[t]!, I[t + 1]!, I[t + 2]!);
  m.normals().computeNormals();

  const attributes = new r.ObjectAttributes();
  attributes.layerIndex = layerIndex;
  attributes.name = metadata.objectName ?? "Terra final mesh";
  const all = { representation: REPRESENTATION_NOTE, units: "mm", scale: "1:1", ...metadata };
  for (const [k, v] of Object.entries(all)) {
    attributes.setUserString(k, v);
    doc.strings().set(k, v);
  }
  doc.objects().add(m, attributes);
  return doc.toByteArray();
}

export type Reopened3dm = {
  units: string;
  objectCount: number;
  layerName: string;
  vertexCount: number;
  triangleCount: number;
  bbox: { min: number[]; max: number[] };
  userStrings: Record<string, string>;
};

/** Reopens a 3DM with rhino3dm and reports what a Rhino user would find in it. */
export async function read3dm(bytes: Uint8Array, keys: string[]): Promise<Reopened3dm> {
  const r = await rhino();
  const doc = r.File3dm.fromByteArray(bytes);
  if (!doc) throw new Error("3DM could not be parsed");
  const unitName = Object.entries(r.UnitSystem).find(([, v]) => v === doc.settings().modelUnitSystem)?.[0] ?? "unknown";
  const objects = doc.objects();
  const obj = objects.get(0);
  const geometry = obj.geometry() as InstanceType<Rhino["Mesh"]>;
  const attrs = obj.attributes();
  const verts = geometry.vertices();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.count; i++) {
    const v = verts.get(i);
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, v[k]!); max[k] = Math.max(max[k]!, v[k]!); }
  }
  const userStrings: Record<string, string> = {};
  for (const k of keys) userStrings[k] = attrs.getUserString(k);
  return {
    units: unitName,
    objectCount: objects.count,
    layerName: doc.layers().get(attrs.layerIndex).name,
    vertexCount: verts.count,
    triangleCount: geometry.faces().triangleCount,
    bbox: { min, max },
    userStrings
  };
}

/** One mesh object for a multi-component 3DM: its own layer, name and user strings. */
export type Component3dm = { mesh: IndexedMesh; layer: string; name: string; metadata: Record<string, string> };

/**
 * Several components in one millimetre 3DM, each a separate mesh object on its
 * own layer. Components are not merged or joined: a multi-part product keeps
 * its parts' identity. Document strings carry the shared metadata.
 */
export async function write3dmComponents(components: Component3dm[], documentMetadata: Record<string, string>): Promise<Uint8Array> {
  const r = await rhino();
  const doc = new r.File3dm();
  doc.settings().modelUnitSystem = r.UnitSystem.Millimeters;
  const shared = { representation: REPRESENTATION_NOTE, units: "mm", scale: "1:1", ...documentMetadata };
  for (const [k, v] of Object.entries(shared)) doc.strings().set(k, v);
  for (const c of components) {
    const layer = new r.Layer();
    layer.name = c.layer;
    const layerIndex = doc.layers().add(layer);
    const m = new r.Mesh();
    const P = c.mesh.positions, I = c.mesh.indices;
    for (let i = 0; i < P.length; i += 3) m.vertices().add(P[i]!, P[i + 1]!, P[i + 2]!);
    for (let t = 0; t < I.length; t += 3) m.faces().addTriFace(I[t]!, I[t + 1]!, I[t + 2]!);
    m.normals().computeNormals();
    const attributes = new r.ObjectAttributes();
    attributes.layerIndex = layerIndex;
    attributes.name = c.name;
    for (const [k, v] of Object.entries({ representation: REPRESENTATION_NOTE, units: "mm", ...c.metadata })) attributes.setUserString(k, v);
    doc.objects().add(m, attributes);
  }
  return doc.toByteArray();
}

export type Reopened3dmObject = {
  name: string;
  layerName: string;
  vertexCount: number;
  triangleCount: number;
  bbox: { min: number[]; max: number[] };
  userStrings: Record<string, string>;
};

/** Reopens a multi-component 3DM and reports every object, its layer and the document strings. */
export async function read3dmComponents(bytes: Uint8Array, objectKeys: string[], documentKeys: string[]) {
  const r = await rhino();
  const doc = r.File3dm.fromByteArray(bytes);
  if (!doc) throw new Error("3DM could not be parsed");
  const units = Object.entries(r.UnitSystem).find(([, v]) => v === doc.settings().modelUnitSystem)?.[0] ?? "unknown";
  const objects: Reopened3dmObject[] = [];
  for (let o = 0; o < doc.objects().count; o++) {
    const obj = doc.objects().get(o);
    const geometry = obj.geometry() as InstanceType<Rhino["Mesh"]>;
    const attrs = obj.attributes();
    const verts = geometry.vertices();
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < verts.count; i++) {
      const v = verts.get(i);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, v[k]!); max[k] = Math.max(max[k]!, v[k]!); }
    }
    const userStrings: Record<string, string> = {};
    for (const k of objectKeys) userStrings[k] = attrs.getUserString(k);
    objects.push({ name: attrs.name, layerName: doc.layers().get(attrs.layerIndex).name, vertexCount: verts.count, triangleCount: geometry.faces().triangleCount, bbox: { min, max }, userStrings });
  }
  // The string table is read by index; each entry is a [key, value] pair.
  const table: Record<string, string> = {};
  const strings = doc.strings();
  for (let i = 0; i < strings.count; i++) {
    const entry = strings.get(i) as unknown as [string, string];
    table[entry[0]] = entry[1];
  }
  const documentStrings: Record<string, string> = {};
  for (const k of documentKeys) documentStrings[k] = table[k] ?? "";
  return { units, objects, documentStrings };
}
