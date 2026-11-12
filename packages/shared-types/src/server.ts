import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  configurationContentSchema,
  configurationVersionSchema,
} from "./configuration";
import { terrainParametersSchema, terrainVersionSchema } from "./terrain";
import {
  deepFreeze,
  identifierSchema,
  sha256Schema,
  signatureSchema,
} from "./primitives";

/** Strict JSON canonicalization. Sorted object keys; array order and numbers kept. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map(canonicalJSON).join(",") + "]";
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonicalJSON((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  }
  throw new Error("Only finite plain JSON values can be hashed");
}
export const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export function terrainHash(input: unknown): string {
  const p = terrainParametersSchema.parse(input);
  // Relocation of identical stored bytes is not a design change.
  const { objectKey: _key, ...heightmap } = p.heightmap;
  void _key;
  return sha256(
    canonicalJSON({
      domain: "avie-terrain-v1",
      parameters: { ...p, heightmap },
    }),
  );
}
export function createTerrainVersion(input: unknown, bytes: Uint8Array) {
  const v = terrainVersionSchema
      .omit({ designHash: true, signature: true })
      .parse(input),
    m = v.parameters.heightmap;
  if (bytes.byteLength !== m.cols * m.rows * 4 || sha256(bytes) !== m.checksum)
    throw new Error("Heightmap bytes do not match the snapshot");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.byteLength; i += 4)
    if (!Number.isFinite(view.getFloat32(i, true)))
      throw new Error("Heightmap contains missing or non-finite elevations");
  return deepFreeze(
    terrainVersionSchema.parse({
      ...v,
      designHash: terrainHash(v.parameters),
      signature: null,
    }),
  );
}
export function verifyTerrainVersion(input: unknown) {
  const v = terrainVersionSchema.parse(input);
  if (v.designHash !== terrainHash(v.parameters))
    throw new Error("Terrain hash mismatch");
  return v;
}
export function configurationHash(input: unknown) {
  return sha256(
    canonicalJSON({
      domain: "avie-configuration-v1",
      content: configurationContentSchema.parse(input),
    }),
  );
}
export function createConfigurationVersion(input: unknown) {
  const v = configurationVersionSchema
    .omit({ configurationHash: true, signature: true })
    .parse(input);
  return deepFreeze(
    configurationVersionSchema.parse({
      ...v,
      configurationHash: configurationHash(v.content),
      signature: null,
    }),
  );
}
export const signingClaimSchema = z.strictObject({
  purpose: z.enum(["terrain", "configuration"]),
  shopId: z.uuid(),
  ownerSessionId: z.uuid(),
  entityId: z.uuid(),
  version: z.number().int().positive(),
  hash: sha256Schema,
});
export type SigningKey = { keyId: string; secret: Uint8Array };
export function signClaim(input: unknown, key: SigningKey) {
  const claim = signingClaimSchema.parse(input);
  identifierSchema.parse(key.keyId);
  if (key.secret.byteLength < 32)
    throw new Error("Signing keys must contain at least 32 bytes");
  const value = createHmac("sha256", key.secret)
    .update(
      canonicalJSON({
        domain: "avie-content-attestation-v1",
        claim,
        keyId: key.keyId,
      }),
    )
    .digest("hex");
  return signatureSchema.parse({
    algorithm: "HMAC-SHA256",
    keyId: key.keyId,
    value,
  });
}
export function verifyClaim(
  input: unknown,
  signature: unknown,
  keys: readonly SigningKey[],
): boolean {
  const parsed = signatureSchema.safeParse(signature);
  if (!parsed.success) return false;
  const key = keys.find((k) => k.keyId === parsed.data.keyId);
  if (!key) return false;
  try {
    const expected = signClaim(input, key);
    return timingSafeEqual(
      Buffer.from(expected.value, "hex"),
      Buffer.from(parsed.data.value, "hex"),
    );
  } catch {
    return false;
  }
}
