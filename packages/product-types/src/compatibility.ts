import {
  configurationInputSchema,
  type ValidationCheck,
} from "@avie/shared-types";
import { constraints, constraintProfileSchema } from "./constraints";
import { resolveMount } from "./mounts";
import { getProductType } from "./product-types";
export function assessCompatibility(input: unknown, override?: unknown) {
  const c = configurationInputSchema.parse(input),
    type = c.selection.productType,
    product = getProductType(type),
    mount = resolveMount(c);
  const profile = constraintProfileSchema.parse(
    override ??
      (type === "terrain_ring" ? constraints.legacyRing : constraints[type]),
  );
  if (profile.productType !== type)
    throw new Error("Constraint profile belongs to another product");
  const checks: ValidationCheck[] = [];
  const check = (code: string, pass: boolean, message: string) =>
    checks.push({
      code,
      outcome: pass ? "pass" : "fail",
      message,
      measured: null,
      required: null,
      method: "configuration-rules-v1",
    });
  check(
    "MATERIAL",
    profile.materials.includes(c.material),
    "Material must be in the provisional compatibility list",
  );
  check(
    "FINISH",
    profile.finishes.includes(c.finish),
    "Finish must be supported",
  );
  check(
    "FACE",
    profile.shapes.includes(mount.faceShape),
    "Face must match the selected mount profile",
  );
  check(
    "ATTACHMENT",
    profile.attachments.includes(mount.attachment),
    "Attachment must be in the selected profile",
  );
  check(
    "DIMENSIONS",
    (profile.minWidthMm === null || mount.widthMm >= profile.minWidthMm) &&
      (profile.maxWidthMm === null || mount.widthMm <= profile.maxWidthMm) &&
      (profile.minHeightMm === null || mount.heightMm >= profile.minHeightMm) &&
      (profile.maxHeightMm === null || mount.heightMm <= profile.maxHeightMm),
    "Dimensions must lie inside candidate limits",
  );
  check(
    "ENGRAVING",
    !c.engraving.enabled,
    "Engraving geometry is not implemented; requested engraving blocks generation",
  );
  const candidateCompatible = checks.every((c) => c.outcome === "pass");
  checks.push({
    code: "MANUFACTURER_APPROVAL",
    outcome: "not_run",
    message: "All current profiles are provisional",
    measured: null,
    required: null,
    method: null,
  });
  for (const code of product.qc)
    checks.push({
      code: `GEOMETRY_${code}`,
      outcome: "not_run",
      message: "No generated mesh has been validated in this milestone",
      measured: null,
      required: null,
      method: null,
    });
  return {
    productType: type,
    candidateCompatible,
    previewAvailable: candidateCompatible && product.previewAvailable,
    productionReady: false as const,
    status: candidateCompatible
      ? ("held_for_review" as const)
      : ("rejected" as const),
    profile,
    mount,
    checks,
  };
}
