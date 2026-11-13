import { describe, expect, it } from "vitest";
import { buildPendantPreview, pendantDisplayMesh, presetFor } from "../src/geometry/pendant-preview";
import { meshVolume } from "../src/geometry/ring-blank";

const hill = { radiusM: 20000, elevationAt: (e: number, n: number) => 500 + 300 * Math.exp(-(e * e + n * n) / 2e6) };

describe("internal pendant preview", () => {
  it.each([["round_slider", "pendant-round-classic", 18, 18], ["tablet_slider", "pendant-tablet-classic", 12, 20], ["cushion_tab", "pendant-cushion-classic", 16, 16]] as const)(
    "%s uses the catalogue size and its style's preview-only profile",
    async (style, presetId, w, h) => {
      expect(presetFor(style, "classic")).toBe(presetId);
      const b = await buildPendantPreview({ style, tier: "classic", source: hill, lengthM: 6000, bearingDeg: 0, terrainHeight: 1, detail: "high" });
      expect(b.built.dimensions.body).toMatchObject({ widthMm: w, heightMm: h });
      expect(b.params.profileId).toMatch(/preview-dev-1$/);
      expect(b.built.genus).toBe(1);
    },
    60000,
  );

  it("stands the pendant up for display without mirroring it", async () => {
    const b = await buildPendantPreview({ style: "round_loop", tier: "classic", source: hill, lengthM: 6000, bearingDeg: 0, terrainHeight: 1, detail: "high" });
    const m = pendantDisplayMesh(b.built.mesh);
    expect(meshVolume(m)).toBeGreaterThan(0); // a reflection would turn the volume negative
    let topY = -Infinity, bottomY = Infinity;
    for (let i = 1; i < m.positions.length; i += 3) { topY = Math.max(topY, m.positions[i]!); bottomY = Math.min(bottomY, m.positions[i]!); }
    expect(topY).toBeCloseTo(b.built.dimensions.overall.heightMm - 9, 2); // loop at the top
    expect(bottomY).toBeCloseTo(-9, 3);
  }, 60000);
});
