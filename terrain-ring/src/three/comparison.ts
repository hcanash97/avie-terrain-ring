/** Dev-only controlled comparison: one fixture, opening, material and studio. */
import * as THREE from "three";
import { createRingMesh, facePreset, weldedNormals } from "../geometry/ring-blank";
import { createDemoSource } from "../geometry/heightmap";
import { buildTerrain, frameFor } from "./terrain-surface";
import { createEnvironment } from "./environment";
import { createLights } from "./lights";
import { createRingMaterial } from "./materials";
import { fitBoxDistance } from "./camera";

export async function buildComparisonSheet() {
 const width=480,height=360,heading=60;
 const output=document.createElement("canvas");output.width=width*4;output.height=heading+height*6;
 const ctx=output.getContext("2d")!;
 ctx.fillStyle="#efefed";ctx.fillRect(0,0,output.width,output.height);
 ctx.fillStyle="#252525";ctx.font="20px sans-serif";
 ctx.fillText("Terra comparison | synthetic terrain | 17.2 mm opening | 70% relief | high detail | Classic / Comfort",20,36);
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height-34);
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xefefed);
 const env=createEnvironment(renderer);scene.environment=env.texture;scene.add(createLights());
 const clay=new THREE.MeshStandardMaterial({color:0x80868d,roughness:.75,metalness:0,envMapIntensity:.25});
 const silver=createRingMaterial("silver_925","polished");
 const ring=new THREE.Mesh(new THREE.BufferGeometry(),clay);scene.add(ring);
 const camera=new THREE.PerspectiveCamera(32,width/(height-34),.1,400);
 const views=[new THREE.Vector3(0,0,1),new THREE.Vector3(1,.06,0),new THREE.Vector3(-30,31.5,46),new THREE.Vector3(-30,31.5,46)];
 const labels=["Clay / Front","Clay / Side","Clay / Three-quarter","Silver / Three-quarter"];
 let row=0;
 try {
  for(const shape of ["bar","cushion"] as const)for(const size of ["slim","standard","bold"] as const){
   const w=facePreset(size,shape),terrain=buildTerrain(createDemoSource(),frameFor(5000,0,w),w,{terrainHeight:.7,detail:"high"},300);
   const mesh=createRingMesh({innerDiameterMm:17.2,weight:w,shoulder:"classic",profile:"classic",terrain,resolution:{faceSegments:280,backSegments:160,widthSegments:140}});
   ring.geometry.dispose();const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(mesh.positions,3));g.setAttribute("terrainBlend",new THREE.BufferAttribute(mesh.terrainBlend,1));g.setAttribute("normal",new THREE.BufferAttribute(weldedNormals(mesh),3));g.setIndex(new THREE.BufferAttribute(mesh.indices,1));g.computeBoundingBox();ring.geometry=g;
   const centre=g.boundingBox!.getCenter(new THREE.Vector3());
   for(let col=0;col<4;col++){
    ring.material=col===3?silver:clay;
    const dir=views[col]!.clone();camera.position.copy(dir.normalize().multiplyScalar(fitBoxDistance(g.boundingBox!,dir,camera.aspect,camera.fov)).add(centre));camera.lookAt(centre);renderer.render(scene,camera);
    const x=col*width,y=heading+row*height;
    ctx.fillStyle="#252525";ctx.font="16px sans-serif";ctx.fillText(`${shape.toUpperCase()} ${size} | ${labels[col]}`,x+12,y+24);
    ctx.drawImage(renderer.domElement,x,y+34);
   }
   row++;
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
  const response=await fetch("/__capture?name=terra-controlled-comparison",{method:"POST",body:output.toDataURL("image/png")});
  if(!response.ok)throw new Error("Comparison could not be saved");
 } finally {ring.geometry.dispose();clay.dispose();silver.dispose();env.dispose();renderer.dispose();renderer.forceContextLoss();}
}
