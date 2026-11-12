import { expect, it } from "vitest";
import { validation } from "@avie/geometry";
import { buildProductionRing } from "../src/ring-source";

const places = [
  "Snowdon, GB",
  "Ben Nevis, GB",
  "Matterhorn, CH",
  "Table Mountain, ZA",
  "Mount Fuji, JP",
  "Grand Canyon, US",
  "Lake District, GB",
  "Mont Blanc, FR",
  "Mount Everest, NP",
  "Dolomites, IT",
  "Old Man of Storr, GB",
  "Yosemite, US",
  "Uluru, AU",
  "Milford Sound, NZ",
  "Mount Etna, IT",
];
// Full-resolution real-terrain check; closure alone cannot catch corner folds.
for (const place of places)
  for (const headShape of ["bar", "cushion"] as const)
    for (const shoulder of ["straight", "classic", "curved"] as const)
      it(`${place}/${headShape}/${shoulder}: full-width shoulder does not fold at maximum terrain height`, () => {
        const { mesh } = buildProductionRing({
          place,
          headShape,
          shoulder,
          weight: "standard",
          profile: "classic",
          ringSize: "N",
          metal: "silver_925",
          finish: "polished",
          bearingDeg: 0,
          terrainHeight: 1,
          detail: "high",
        });
        expect(
          validation.selfIntersections(
            mesh,
            new validation.TriangleBVH(mesh),
            1,
          ),
        ).toBe(0);
        expect(validation.edgeTopology(mesh)).toMatchObject({
          boundary: 0,
          nonManifold: 0,
          misoriented: 0,
        });
        expect(validation.signedVolumeMm3(mesh)).toBeGreaterThan(0);
      }, 30000);
