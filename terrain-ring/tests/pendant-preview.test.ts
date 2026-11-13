import { describe, expect, it } from "vitest";
import { buildPendantPreview, pendantDisplayMesh } from "../src/geometry/pendant-preview";
import { meshVolume } from "../src/geometry/ring-blank";

const hill = { radiusM: 20000, elevationAt: (e: number, n: number) => 500 + 300 * Math.exp(-(e * e + n * n) / 2e6) };

describe("internal pendant preview", () => {
  const built = buildPendantPreview({ source: hill, lengthM: 6000, bearingDeg: 0, terrainHeight: 1, detail: "high", flat: false });

  it("uses the catalogue diameter and the preview-only profile", () => {
    expect(built.dimensions.body.diameterMm).toBeCloseTo(18, 6);
    expect(built.profileId).toBe("pendant-preview-dev-1");
  });

  it("stands the pendant up for display without mirroring it", () => {
    const m = pendantDisplayMesh(built.pendant);
    expect(meshVolume(m)).toBeGreaterThan(0); // a reflection would turn the volume negative
    let topY = -Infinity, bottomY = Infinity;
    for (let i = 1; i < m.positions.length; i += 3) { topY = Math.max(topY, m.positions[i]!); bottomY = Math.min(bottomY, m.positions[i]!); }
    expect(topY).toBeCloseTo(built.dimensions.overall.heightMm - 9, 3); // bail at the top
    expect(bottomY).toBeCloseTo(-9, 3);
  });
});
