import { configurationInputSchema, mountSchema } from "@avie/shared-types";
/** Resolves data only: this does not create geometry or validate global thickness. */
export function resolveMount(input: unknown) {
  const c = configurationInputSchema.parse(input),
    s = c.selection;
  if (s.productType === "terrain_ring") {
    const i = { slim: 0, standard: 1, bold: 2 }[s.options.weight];
    const dimensions =
      s.options.headShape === "bar"
        ? [
            [12, 5.5],
            [13, 7.5],
            [14, 10],
          ]
        : [
            [10.5, 9.5],
            [12, 11],
            [14, 13],
          ];
    return mountSchema.parse({
      policyId: "legacy-integrated-ring",
      version: 1,
      faceShape: s.options.headShape,
      heightMm: dimensions[i]![0],
      widthMm: dimensions[i]![1],
      substrateMm: 1.2,
      reliefLimitMm: [2, 2.4, 2.8][i],
      crop: c.crop,
      units: "mm",
      axes: "X-right_Y-relief_Z-face",
      edgeTreatment: "integrated",
      attachment: "none",
    });
  }
  const o = s.options;
  return mountSchema.parse({
    policyId:
      s.productType === "terrain_pendant"
        ? "pendant-contained-candidate"
        : "distinct-signet-candidate",
    version: 1,
    faceShape: o.faceShape,
    widthMm: o.widthMm,
    heightMm: o.heightMm,
    substrateMm: s.productType === "terrain_pendant" ? 1.4 : 1.8,
    reliefLimitMm: s.productType === "terrain_pendant" ? 2.5 : 3,
    crop: c.crop,
    units: "mm",
    axes: "X-right_Y-relief_Z-face",
    edgeTreatment:
      s.productType === "terrain_pendant" ? "bordered" : "signet_head",
    attachment:
      s.productType === "terrain_pendant" ? s.options.attachment : "none",
  });
}
