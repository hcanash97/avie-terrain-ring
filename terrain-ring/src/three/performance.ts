export type Quality = "high" | "low";

/** cols = terrain samples along the face; segments = mesh rows/columns. */
export const LOD = {
  high: { cols: 420, faceSegments: 360, backSegments: 160, widthSegments: 150 },
  low: { cols: 140, faceSegments: 140, backSegments: 110, widthSegments: 60 },
  drag: { cols: 80, faceSegments: 80, backSegments: 70, widthSegments: 36 }
} as const;

export function createFpsProbe(onResult: (fps: number) => void, windowMs = 2500) {
  let start = 0, frames = 0, done = false;
  return (now: number) => {
    if (done) return;
    if (start === 0) start = now;
    frames++;
    if (now - start >= windowMs) {
      done = true;
      onResult((frames * 1000) / (now - start));
    }
  };
}
