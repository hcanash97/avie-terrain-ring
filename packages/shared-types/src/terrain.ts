import { z } from "zod";
import {
  finiteSchema,
  identifierSchema,
  sha256Schema,
  signatureSchema,
  versionSchema,
} from "./primitives";
export const terrainParametersSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    locationName: z.string().trim().min(1).max(200),
    crs: z.literal("EPSG:4326"),
    bbox: z.strictObject({
      west: finiteSchema.min(-180).max(180),
      east: finiteSchema.min(-180).max(180),
      south: finiteSchema.min(-85).max(85),
      north: finiteSchema.min(-85).max(85),
    }),
    centre: z.strictObject({
      longitude: finiteSchema.min(-180).max(180),
      latitude: finiteSchema.min(-85).max(85),
    }),
    extentM: z.strictObject({
      width: finiteSchema.positive().max(1000000),
      height: finiteSchema.positive().max(1000000),
    }),
    rotationDeg: finiteSchema.min(0).lt(360),
    reliefIntent: finiteSchema.min(0).max(1),
    detail: z.enum(["low", "medium", "high"]),
    smoothingIntent: finiteSchema.min(0).max(1),
    terrainAlgorithmVersion: identifierSchema,
    heightmap: z.strictObject({
      objectKey: identifierSchema,
      checksum: sha256Schema,
      cols: z.number().int().min(2).max(4096),
      rows: z.number().int().min(2).max(4096),
      encoding: z.literal("float32-le"),
      units: z.literal("metres"),
      nodataPolicy: z.literal("reject"),
      source: z.string().min(1).max(200),
      attribution: z.string().min(1).max(1000),
    }),
  })
  .superRefine((p, ctx) => {
    const b = p.bbox;
    if (b.west >= b.east || b.south >= b.north)
      ctx.addIssue({
        code: "custom",
        path: ["bbox"],
        message:
          "Ordered bounds required; antimeridian areas are not supported",
      });
    if (
      p.centre.longitude < b.west ||
      p.centre.longitude > b.east ||
      p.centre.latitude < b.south ||
      p.centre.latitude > b.north
    )
      ctx.addIssue({
        code: "custom",
        path: ["centre"],
        message: "Centre must lie inside bounds",
      });
  });
export const terrainVersionSchema = z.strictObject({
  id: z.uuid(),
  designId: z.uuid(),
  version: versionSchema,
  parameters: terrainParametersSchema,
  designHash: sha256Schema,
  createdAt: z.iso.datetime(),
  signature: signatureSchema.nullable(),
});
export type TerrainParameters = z.infer<typeof terrainParametersSchema>;
export type TerrainVersion = z.infer<typeof terrainVersionSchema>;
