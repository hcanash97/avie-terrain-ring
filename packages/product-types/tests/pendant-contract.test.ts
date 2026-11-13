import { expect, it } from "vitest";
import { PENDANT_STYLES, styleAppliesTo, resolvePendantPrototype, pendantStyleParameters, getProductType } from "../src/index";

it("resolves all twelve implemented style/size combinations without enabling release", () => {
  for (const style of Object.values(PENDANT_STYLES)) for (const presetId of styleAppliesTo(style.id)) {
    const resolved = resolvePendantPrototype({ productType: "terrain_pendant", contractVersion: 1, configurationVersion: 2, style: style.id, presetId });
    expect(resolved.selection.configurationVersion).toBe(2);
    expect(resolved.manufacturingRelease).toBe(false);
    expect(pendantStyleParameters(presetId, style.id).profileId).toBe(style.profileId);
  }
});

it("rejects mismatched, future and retired generation choices while keeping historical IDs readable", () => {
  for (const presetId of ["pendant-round-classic", "pendant-oval-classic", "terrain_object"])
    expect(() => resolvePendantPrototype({ productType: "terrain_pendant", contractVersion: 1, configurationVersion: 1, style: "tablet_slider", presetId })).toThrow();
  expect(getProductType("terrain_object").id).toBe("terrain_object");
});
