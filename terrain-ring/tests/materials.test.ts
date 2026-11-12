import { describe, expect, it } from "vitest";
import { applyRingMaterial, createRingMaterial, FINISH_ROUGHNESS, METALS, materialParameters } from "../src/three/materials";

describe("materials", () => {
  it("has five distinct metals (925, 9ct, 14ct, 18ct, platinum)", () => {
    const colours = new Set(Object.values(METALS).map((m) => m.color));
    expect(colours.size).toBe(5);
    expect(materialParameters("gold_18ct", "satin").metalness).toBe(1);
  });
  it("polished is smoother than satin", () => {
    expect(FINISH_ROUGHNESS.polished).toBeLessThan(FINISH_ROUGHNESS.satin);
  });
  it("updates in place and disposes", () => {
    const m = createRingMaterial("silver_925", "polished");
    applyRingMaterial(m, "gold_9ct", "satin");
    expect(m.roughness).toBe(FINISH_ROUGHNESS.satin);
    let disposed = false;
    m.addEventListener("dispose", () => (disposed = true));
    m.dispose();
    expect(disposed).toBe(true);
  });
  it("reapplying the selected alloy restores physical material settings", () => {
    const m = createRingMaterial("silver_925", "polished");
    m.metalness = 0;
    m.envMapIntensity = 0;
    applyRingMaterial(m, "gold_18ct", "satin");
    expect(m.metalness).toBe(1);
    expect(m.envMapIntensity).toBe(0.95);
    expect(m.color.getHex()).toBe(METALS.gold_18ct.color);
    expect(m.userData.terraFinish.body.value).toBe(FINISH_ROUGHNESS.satin);
    m.dispose();
  });
});
