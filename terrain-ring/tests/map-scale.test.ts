import { expect, it } from "vitest";
import { metresPerPixel, zoomForFrame } from "../src/geometry/map-scale";
it("preserves the same selected distance when the map/frame resize",()=>{
 for(const lat of [-34,0,53,67])for(const length of [1000,6000,15000])for(const width of [180,320,680]){
  const zoom=zoomForFrame(lat,length,width);
  expect(width*metresPerPixel(lat,zoom)).toBeCloseTo(length,6);
 }
});
