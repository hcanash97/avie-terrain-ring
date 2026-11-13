import { useTerrainStore } from "../state/terrainStore";
import type { Detail } from "../three/terrain-surface";
import { Choice } from "./Choice";
import { track } from "../lib/analytics";

export function StepLandscape({ exaggeration }: { exaggeration: number | null }) {
  const terrain = useTerrainStore();
  const hold = {
    onPointerDown: () => terrain.set({ dragging: true }),
    onPointerUp: () => terrain.set({ dragging: false }),
    onPointerCancel: () => terrain.set({ dragging: false }),
    onBlur: () => terrain.set({ dragging: false })
  };

  return (
    <div className="stack">
      <p className="intro">
        Give your landscape a gentle texture or a stronger sculptural presence. Rotate the preview to judge the peaks in profile.
      </p>
      <label className="slider" htmlFor="terrain-height">
        <span>
          Terrain height <strong className="num">{Math.round(terrain.terrainHeight * 100)}%</strong>
          <output className="num">{exaggeration !== null ? `${exaggeration.toFixed(1)}× true scale` : ""}</output>
        </span>
        <input
          id="terrain-height" aria-describedby="height-help" aria-valuetext={`${Math.round(terrain.terrainHeight * 100)} percent relief`}
          type="range" min={0.05} max={1} step={0.01} value={terrain.terrainHeight}
          onChange={(e) => terrain.set({ terrainHeight: Number(e.target.value) })}
          {...hold}
        />
      </label>
      <p id="height-help" className="hint">Lower for a subtle texture; higher for more prominent peaks. The percentage is relative to this face’s maximum relief.</p>
      <details className="refine"><summary>About landscape scale</summary><p className="small">The × value compares vertical relief with a true-scale model of the selected area. 1× is true scale. Exaggeration is capped at 30× to limit noise in flatter places. Casting and polishing may soften fine details.</p></details>
      <details className="refine">
        <summary>Refine landscape</summary>
        <div className="stack">
          <Choice<Detail>
            label="Detail"
            value={terrain.detail}
            options={[
              { value: "low", label: "Soft", note: "Smooths smaller features." },
              { value: "medium", label: "Balanced", note: "A middle level of detail." },
              { value: "high", label: "Fine", note: "Preserves available small features." }
            ]}
            onChange={(detail) => { terrain.set({ detail }); track("detail_changed", { detail }); }}
          />
          <p className="hint">Fine preserves more of the available elevation detail; Soft smooths smaller features. Casting and polishing may soften the result.</p>
        </div>
      </details>
    </div>
  );
}
