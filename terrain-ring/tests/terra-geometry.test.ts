import { describe, expect, it } from "vitest";
import { createRingMesh, facePreset, meshVolume, openEdgeCount, terrainCollar, easedLinear, type BandProfile, type ShoulderStyle } from "../src/geometry/ring-blank";
const res = { faceSegments: 32, backSegments: 70, widthSegments: 32 };

describe("supported rounded bands", () => {
 for(const weight of ["slim","standard","bold"] as const) for(const profile of ["flat","classic","d_shape"] as BandProfile[]) {
  it(`${weight}/${profile}: local radial clearance at every palm cross-section column`,()=>{
   const w=facePreset(weight,"bar"),d=17.2,r=d/2;
   const mesh=createRingMesh({innerDiameterMm:d,weight:w,shoulder:"classic",profile,terrain:null,resolution:res});
   const cols=res.widthSegments+1;
   const rows=mesh.positions.length/3/(cols+13+2*13);
   let samples=0;
   for(let row=0;row<rows;row++) {
    const centre=(row*cols+res.widthSegments/2)*3;
    if(mesh.positions[centre+1]! > -r*.5) continue;
    for(let k=0;k<cols;k++) {
     const i=(row*cols+k)*3,z=mesh.positions[i+2]!,h=w.bandWidthMm/2;
     const comfort=profile==="classic"?.12*(z/h)**2:0;
     const rr=Math.min(.25,h*.3),edge=Math.max(0,Math.abs(z)-(h-rr));
     const inner=r+comfort+(edge>0?rr-Math.sqrt(Math.max(0,rr*rr-edge*edge)):0);
     expect(Math.hypot(mesh.positions[i]!,mesh.positions[i+1]!)-inner).toBeGreaterThanOrEqual(.7-1e-5);
     samples++;
    }
   }
   expect(samples).toBeGreaterThan(50);
  });
 }
});

describe("geometry matrix: opening, closure and finite coordinates",()=>{
 for(const shape of ["bar","cushion"] as const) for(const size of ["slim","standard","bold"] as const) for(const d of [15,17.2,21.5]) for(const shoulder of ["straight","classic","curved"] as ShoulderStyle[]) for(const profile of ["flat","classic","d_shape"] as BandProfile[]) {
  it(`${shape}/${size}/${d}/${shoulder}/${profile}`,()=>{
   const w=facePreset(size,shape),terrain={data:new Float32Array([0,1,1,0]),cols:2,rows:2,reliefMm:w.maxReliefMm};
   const mesh=createRingMesh({innerDiameterMm:d,weight:w,shoulder,profile,terrain,resolution:res});
   expect(mesh.positions.every(Number.isFinite)).toBe(true);
   expect(mesh.terrainBlend.every(v=>Number.isFinite(v)&&v>=0&&v<=1)).toBe(true);
   expect(openEdgeCount(mesh)).toBe(0);
   expect(meshVolume(mesh)).toBeGreaterThan(0);
   let min=Infinity;
   for(let i=0;i<mesh.positions.length;i+=3)min=Math.min(min,Math.hypot(mesh.positions[i]!,mesh.positions[i+1]!));
   expect(min*2).toBeCloseTo(d,3);
  });
 }
});

it("straight width progression has eased derivatives at both ends",()=>{
 const e=1e-5;
 expect(easedLinear(e)/e).toBeLessThan(.001);
 expect((1-easedLinear(1-e))/e).toBeLessThan(.001);
 expect(easedLinear(.5)).toBeCloseTo(.5,8);
});

it("landscape continuation preserves boundary height and moderate slope, then fades flat",()=>{
 const t={data:new Float32Array([0,.5,.5,1]),cols:2,rows:2,reliefMm:1};
 for(const side of [1,-1] as const){
  const at=(s:number)=>terrainCollar(t,12,8,side,0,s,2).lift;
  expect(at(0)).toBeCloseTo(side===1?.75:.25,5);
  const derivative=(at(.0001)-at(0))/.0001;
  expect(derivative).toBeCloseTo(side/24,3);
  expect(at(2)).toBe(0);
  expect(Math.abs((at(2)-at(2-.0001))/.0001)).toBeLessThan(.001);
 }
});
it("flat landscapes acquire no invented shoulder veins",()=>{
 const t={data:new Float32Array(4),cols:2,rows:2,reliefMm:0};
 for(const s of [0,.2,1,2]) expect(terrainCollar(t,12,8,1,0,s,2).lift).toBe(0);
});
it("extreme edge slopes remain finite and nonnegative",()=>{
 const t={data:new Float32Array([1,0,0,1]),cols:2,rows:2,reliefMm:2.8};
 for(const side of [1,-1] as const)for(const z of [-4,4])for(let i=0;i<=100;i++){
  const r=terrainCollar(t,12,8,side,z,i/50,2);
  expect(Number.isFinite(r.lift)).toBe(true);expect(r.lift).toBeGreaterThanOrEqual(0);
 }
});
