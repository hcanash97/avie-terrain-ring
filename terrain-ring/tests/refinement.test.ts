import { expect, it } from "vitest";
import * as THREE from "three";
import { blur, edgeAwareBlur } from "../src/geometry/heightmap";
import { createRingMesh, facePreset, weldedNormals } from "../src/geometry/ring-blank";
import { fitBoxDistance } from "../src/three/camera";

it("high-detail filter preserves a ridge boundary without new extrema",()=>{
 const data=Float32Array.from({length:81},(_,i)=>i%9<4?100:200);
 const sharp=edgeAwareBlur(data,9,9,1.5),soft=blur(data,9,9,1.5);
 expect(sharp[4]!-sharp[3]!).toBeGreaterThan(soft[4]!-soft[3]!);
 expect(Math.min(...sharp)).toBeGreaterThanOrEqual(100);
 expect(Math.max(...sharp)).toBeLessThanOrEqual(200);
 expect(Array.from(edgeAwareBlur(new Float32Array(81).fill(100),9,9,1.5))).toEqual(new Array(81).fill(100));
});
for(const size of ["slim","standard","bold"] as const)it(`${size}: cushion supports a broad flat end rather than a pill-shaped neck`,()=>{
 const w=facePreset(size,"cushion");
 expect((w.faceWidthMm-2*w.cornerRadiusMm)/w.faceWidthMm).toBeGreaterThan(.7);
 const mesh=createRingMesh({innerDiameterMm:17.2,weight:w,shoulder:"classic",profile:"classic",terrain:{data:new Float32Array([0,1,1,0]),cols:2,rows:2,reliefMm:w.maxReliefMm},resolution:{faceSegments:60,backSegments:120,widthSegments:60}});
 expect(weldedNormals(mesh).every(Number.isFinite)).toBe(true);
});
for(const aspect of [.45,1,1.6])it(`projected bounds fit in a ${aspect} viewer, including detail crop`,()=>{
 const box=new THREE.Box3(new THREE.Vector3(-7,9,-6),new THREE.Vector3(7,13,6));
 const d=new THREE.Vector3(-22,42,35),camera=new THREE.PerspectiveCamera(32,aspect,.1,400),centre=box.getCenter(new THREE.Vector3());
 camera.position.copy(d.clone().normalize().multiplyScalar(fitBoxDistance(box,d,aspect,32)).add(centre));camera.lookAt(centre);camera.updateMatrixWorld();
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=new THREE.Vector3(x,y,z).project(camera);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);
 }
});
