/** Reproducible style illustrations from the production generators, not product photography. */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateTerrainRingPreview, facePreset, type RingMesh } from '../../packages/geometry/src/products/terrain-ring/index';
import { createDemoSource, buildTerrain, frameFor } from '../../packages/terrain/src/index';
import { createPendant } from '../../packages/geometry/src/products/terrain-pendant/index';
import { pendantStyleParameters, PENDANT_STYLES, type PendantStyleId } from '../../packages/product-types/src/index';
const dir = new URL('../public/products/', import.meta.url); mkdirSync(dir, { recursive: true });
const source = createDemoSource();
const dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i]!,0);
const cross=(a:number[],b:number[])=>[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!];
const unit=(a:number[])=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
function render(name:string,m:RingMesh,pendant=false) {
 const forward=unit(pendant?[-0.25,0.3,1]:[-0.6,0.55,1]); const right=unit(cross([0,1,0],forward)),up=cross(forward,right);
 const pts=Array.from({length:m.positions.length/3},(_,i)=>{const x=m.positions[i*3]!,y=m.positions[i*3+1]!,z=m.positions[i*3+2]!;return pendant?[x,-z,y]:[x,y,z]});
 const projected=pts.map(p=>[dot(p,right),-dot(p,up),dot(p,forward)]);
 const minY=Math.min(...projected.map(p=>p[1]!)),maxY=Math.max(...projected.map(p=>p[1]!));
 const minX=Math.min(...projected.map(p=>p[0]!)),maxX=Math.max(...projected.map(p=>p[0]!));
 const scale=pendant?Math.min(190/(maxY-minY),210/(maxX-minX)):6.9;
 const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
 const faces=[];
 for(let t=0;t<m.indices.length;t+=3){const ids=[m.indices[t]!,m.indices[t+1]!,m.indices[t+2]!],a=pts[ids[0]!]!,b=pts[ids[1]!]!,c=pts[ids[2]!]!;
 const normal=unit(cross(b.map((v,i)=>v-a[i]!),c.map((v,i)=>v-a[i]!))); if(dot(normal,forward)<=0)continue;
 const light=Math.max(0,dot(normal,unit([-0.5,0.8,1]))),tone=0.48+light*0.5;
 const color=[218,195,144].map(v=>Math.round(v*tone+255*(Math.pow(light,20)*0.15)));
 const points=ids.map(i=>`${(160+(projected[i]![0]!-centerX)*scale).toFixed(2)},${(115+(projected[i]![1]!-centerY)*scale).toFixed(2)}`).join(' ');
 faces.push({depth:ids.reduce((s,i)=>s+projected[i]![2]!,0),svg:`<polygon points="${points}" fill="rgb(${color.join(',')})" stroke="rgb(${color.join(',')})" stroke-width="0.35"/>`});}
 faces.sort((a,b)=>a.depth-b.depth);
 writeFileSync(new URL(`${name}.png`,dir),new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 230"><defs><radialGradient id="s"><stop stop-color="#8b7d66" stop-opacity=".2"/><stop offset="1" stop-color="#8b7d66" stop-opacity="0"/></radialGradient></defs><path fill="#f1eeE8" d="M0 0h320v230H0z"/><ellipse cx="160" cy="210" rx="88" ry="14" fill="url(#s)"/>${faces.map(f=>f.svg).join('')}</svg>`, {fitTo:{mode:'width',value:480}}).render().asPng());
}
for(const shape of ['bar','cushion'] as const)for(const weight of ['slim','standard','bold'] as const){const {mesh}=generateTerrainRingPreview({source,lengthM:6000,bearingDeg:0,terrainHeight:.7,detail:'high',flat:false,innerDiameterMm:16.9,weight:facePreset(weight,shape),shoulder:'classic',profile:'classic',resolution:{cols:64,faceSegments:64,backSegments:64,widthSegments:24}});render(`ring-${shape}-${weight}`,mesh);}
for(const style of Object.keys(PENDANT_STYLES) as PendantStyleId[]){const info=PENDANT_STYLES[style],params=pendantStyleParameters(`pendant-${info.shape}-classic`,style),dims={faceLengthMm:params.outline.widthMm,faceWidthMm:params.outline.heightMm,maxReliefMm:params.maximumReliefMm};const terrain=buildTerrain(source,frameFor(6000,0,dims),dims,{terrainHeight:.7,detail:'high'},64);const built=await createPendant({...params,terrain,resolution:{rings:24,angular:72,round:3},attachmentSegments:24});render(`pendant-${style}`,built.mesh,true);}
console.log('Generated 10 mesh-based product illustrations.');
