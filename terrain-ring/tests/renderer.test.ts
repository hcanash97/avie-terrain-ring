import { afterEach, expect, it, vi } from "vitest";
import { fitDistance } from "../src/three/camera";
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it("probes WebGL once and explicitly releases its temporary context",async()=>{
 const loseContext=vi.fn(),getContext=vi.fn(()=>({getExtension:()=>({loseContext})})),createElement=vi.fn(()=>({getContext}));
 vi.stubGlobal("document",{createElement});
 const {isWebGLAvailable}=await import("../src/three/renderer");
 for(let i=0;i<50;i++)expect(isWebGLAvailable()).toBe(true);
 expect(createElement).toHaveBeenCalledTimes(1);
 expect(loseContext).toHaveBeenCalledTimes(1);
});
it("fits narrower viewers at a greater camera distance",()=>{
 expect(fitDistance(14,.5,32)).toBeGreaterThan(fitDistance(14,1,32));
 expect(Number.isFinite(fitDistance(14,0,32))).toBe(true);
});
