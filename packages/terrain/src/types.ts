/** Product-neutral relief samples, normalized to 0..1 with physical displacement in mm. */
export type TerrainRelief = {
  data: Float32Array;
  cols: number;
  rows: number;
  reliefMm: number;
};
/** A mount supplies physical dimensions and a relief cap; no ring options belong here. */
export type TerrainMountDimensions = {
  faceLengthMm: number;
  faceWidthMm: number;
  maxReliefMm: number;
};
