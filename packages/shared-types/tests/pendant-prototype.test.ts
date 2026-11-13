import { expect, it } from "vitest";
import { configurationInputSchema, pendantPrototypeConfigurationSchema, unknownPendantChainSpecification } from "../src/index";

const config = { place: "Snowdon, GB", bearingDeg: 0, terrainHeight: 0.7, detail: "high", metal: "silver_925", finish: "polished" };

it("rejects non-finite/unsupported prototype choices instead of coercing them", () => {
  expect(pendantPrototypeConfigurationSchema.parse(config)).toMatchObject({ style: "round_slider", presetId: "pendant-round-classic", configurationVersion: 1 });
  for (const change of [{ bearingDeg: NaN }, { terrainHeight: Infinity }, { terrainHeight: 1.1 }, { lengthM: -1 }, { metal: "brass" }, { style: "oval" }, { presetId: "terrain_object" }, { coverage: { mode: "above_level", level: 1 } }, { configurationVersion: 0 }])
    expect(pendantPrototypeConfigurationSchema.safeParse({ ...config, ...change }).success).toBe(false);
});

it("keeps every unresolved chain fact null with its decision owner", () => {
  const chain = unknownPendantChainSpecification();
  for (const value of Object.values(chain)) {
    expect(value.value).toBeNull();
    expect(value.source).toBeNull();
    expect(value.approvedBy).toBeNull();
  }
  expect(chain.chainSku.owner).toBe("supplier_or_setter");
  expect(chain.clearanceAllowanceMm.owner).toBe("manufacturer");
});

it("retains the legacy saved pendant contract without promoting its choices to implemented", () => {
  const legacy = { selection: { productType: "terrain_pendant", options: { faceShape: "oval", widthMm: 16, heightMm: 20, chainLengthCm: 50, attachment: "fixed_bail" } }, material: "silver_925", finish: "polished", engraving: { enabled: false }, crop: { policy: "preserve_area" } };
  expect(configurationInputSchema.parse(legacy)).toEqual(legacy);
  expect(configurationInputSchema.safeParse({ ...legacy, selection: { productType: "terrain_object", options: {} } }).success).toBe(false);
});
