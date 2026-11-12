import { z } from "zod";
import { configurationInputSchema, versionSchema } from "@avie/shared-types";
import {
  canonicalJSON,
  createConfigurationVersion,
  sha256,
  verifyTerrainVersion,
} from "@avie/shared-types/server";
import { assessCompatibility } from "./compatibility";
import { getProductType } from "./product-types";
const identity = z.strictObject({
  id: z.uuid(),
  configurationId: z.uuid(),
  version: versionSchema,
  shopId: z.uuid(),
  ownerSessionId: z.uuid(),
  createdAt: z.iso.datetime(),
});
/** Caller supplies an authorised terrain snapshot; this function is not authorization. */
export function configureProduct(
  input: unknown,
  terrainInput: unknown,
  identityInput: unknown,
) {
  const selected = configurationInputSchema.parse(input),
    terrain = verifyTerrainVersion(terrainInput),
    who = identity.parse(identityInput),
    assessment = assessCompatibility(selected);
  if (!assessment.candidateCompatible)
    throw new Error(
      "Unsupported product configuration: " +
        assessment.checks
          .filter((c) => c.outcome === "fail")
          .map((c) => c.code)
          .join(", "),
    );
  const p = getProductType(selected.selection.productType);
  return createConfigurationVersion({
    id: who.id,
    configurationId: who.configurationId,
    version: who.version,
    createdAt: who.createdAt,
    content: {
      schemaVersion: 1,
      shopId: who.shopId,
      ownerSessionId: who.ownerSessionId,
      terrainDesignId: terrain.designId,
      terrainVersionId: terrain.id,
      terrainVersion: terrain.version,
      terrainHash: terrain.designHash,
      input: selected,
      mount: assessment.mount,
      constraintProfileId: assessment.profile.id,
      constraintVersion: assessment.profile.version,
      constraintHash: sha256(canonicalJSON(assessment.profile)),
      geometryVersion: p.geometryImplemented
        ? "terra-ring/a7c4afe"
        : "unimplemented/v1",
      geometryImplemented: p.geometryImplemented,
    },
  });
}
