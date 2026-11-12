import { sha256, createTerrainVersion } from "../src/server";
export const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const bytes = new Uint8Array(16);
[200, 300, 400, 500].forEach((v, i) =>
  new DataView(bytes.buffer).setFloat32(i * 4, v, true),
);
export const terrainInput = {
  id: id(1),
  designId: id(2),
  version: 1,
  createdAt: "2026-11-12T12:00:00Z",
  parameters: {
    schemaVersion: 1 as const,
    locationName: "Snowdon",
    crs: "EPSG:4326" as const,
    bbox: { west: -4.1, east: -4, south: 53, north: 53.1 },
    centre: { longitude: -4.05, latitude: 53.05 },
    extentM: { width: 6000, height: 6000 },
    rotationDeg: 0,
    reliefIntent: 0.7,
    detail: "high" as const,
    smoothingIntent: 0.5,
    terrainAlgorithmVersion: "terrain/v1",
    heightmap: {
      objectKey: "terrain/source.bin",
      checksum: sha256(bytes),
      cols: 2,
      rows: 2,
      encoding: "float32-le" as const,
      units: "metres" as const,
      nodataPolicy: "reject" as const,
      source: "saved-fixture",
      attribution: "Test data, not live elevation",
    },
  },
};
export const terrain = () => createTerrainVersion(terrainInput, bytes);
export const identity = {
  id: id(10),
  configurationId: id(11),
  version: 1,
  shopId: id(12),
  ownerSessionId: id(13),
  createdAt: "2026-11-12T12:00:00Z",
};
export const ring = {
  selection: {
    productType: "terrain_ring",
    options: {
      weight: "slim",
      headShape: "bar",
      innerDiameterMm: 17.2,
      shoulder: "classic",
      profile: "classic",
    },
  },
  material: "silver_925",
  finish: "polished",
  engraving: { enabled: false },
  crop: { policy: "preserve_area" },
};
export const pendant = {
  ...ring,
  selection: {
    productType: "terrain_pendant",
    options: {
      faceShape: "cushion",
      widthMm: 18,
      heightMm: 18,
      chainLengthCm: 50,
      attachment: "integrated_loop",
    },
  },
};
export const signet = {
  ...ring,
  selection: {
    productType: "terrain_signet",
    options: {
      faceShape: "cushion",
      widthMm: 16,
      heightMm: 16,
      innerDiameterMm: 17.2,
      bandWidthMm: 3,
    },
  },
};
