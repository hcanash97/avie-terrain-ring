import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as after from "../src/geometry/ring-blank";
import { buildTerrain, frameFor } from "../src/three/terrain-surface";
import { createDemoSource, type TerrainSource } from "../src/geometry/heightmap";
const res = { faceSegments: 120, backSegments: 140, widthSegments: 60 };
it("records comparable old/new preview volumes", () => {
 const rows=[];
 const baseline: {shape:string;weight:string;fixture:string;volumeMm3:number}[] = JSON.parse(readFileSync("tests/fixtures/volume-before-terra.json", "utf8"));
 const fixtures: [string,TerrainSource][] = [["Flat",{radiusM:1e6,elevationAt:()=>200}],["Ramp",{radiusM:1e6,elevationAt:(e)=>500+e*.1}],["Mountain",createDemoSource()]];
 for (const shape of ["bar","cushion"] as const) for (const weight of ["slim","standard","bold"] as const) for (const [fixture,source] of fixtures) {
  const measure=(engine:typeof after)=>{
   const w=engine.facePreset(weight,shape),t=buildTerrain(source,frameFor(5000,0,w),w,{terrainHeight:.7,detail:"high"},120);
   return engine.meshVolume(engine.createRingMesh({innerDiameterMm:17.2,weight:w,shoulder:"classic",profile:"classic",terrain:t,resolution:res}));
  };
  const old=baseline.find(r=>r.shape===shape && r.weight===weight && r.fixture===fixture)!.volumeMm3,now=measure(after);
  rows.push({shape,weight,fixture,beforeMm3:old,afterMm3:now,reductionPercent:(old-now)/old*100,before9ctG:old*.0112,after9ctG:now*.0112});
  expect(now).toBeGreaterThan(0);
  expect(now).toBeLessThan(old);
 }
 const lines = ["# Terra volume comparison", "", "Before: f657b84. After: current generator. Classic shoulders, comfort profile, 17.2 mm opening, 70% relief, 5 km selection. Same face footprints and sources. Flat/ramp/mountain are deterministic synthetic fixtures, not physical samples. 9ct mass uses the existing 11.2 g/cm³ estimate.", "", "| Head | Size | Terrain | Before mm³ | After mm³ | Reduction | Before 9ct g | After 9ct g |", "|---|---|---|---:|---:|---:|---:|---:|"];
 for (const r of rows) lines.push(`| ${r.shape} | ${r.weight} | ${r.fixture} | ${r.beforeMm3.toFixed(1)} | ${r.afterMm3.toFixed(1)} | ${r.reductionPercent.toFixed(1)}% | ${r.before9ctG.toFixed(2)} | ${r.after9ctG.toFixed(2)} |`);
 lines.push("", "Thickness checks are separate. Volume reduction does not establish castability or the final selling price.", "");
 writeFileSync("../TERRA_VOLUME_COMPARISON.md",lines.join("\n"));

});
