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
        Set how strongly the landscape rises from the ring. Gentle places read better with more
        height; dramatic peaks usually look best lower.
      </p>
      <label className="slider" htmlFor="terrain-height">
        <span>
          Terrain height <strong className="num">{Math.round(terrain.terrainHeight * 100)}%</strong>
          <output className="num">{exaggeration !== null ? `${exaggeration.toFixed(1)}× true scale` : ""}</output>
        </span>
        <input
          id="terrain-height"
          type="range" min={0.05} max={1} step={0.01} value={terrain.terrainHeight}
          onChange={(e) => terrain.set({ terrainHeight: Number(e.target.value) })}
          {...hold}
        />
      </label>
      <p className="hint">
        The percentage is a share of the deepest relief this face size allows. The × figure compares
        the result with a true-scale model of the same area (1× = true scale), and is capped at 30×
        so very flat places aren’t exaggerated into noise.
      </p>
      <details className="refine">
        <summary>Refine landscape</summary>
        <div className="stack">
          <Choice<Detail>
            label="Detail"
            value={terrain.detail}
            options={[
              { value: "low", label: "Soft" },
              { value: "medium", label: "Balanced" },
              { value: "high", label: "Fine" }
            ]}
            onChange={(detail) => { terrain.set({ detail }); track("detail_changed", { detail }); }}
          />
          <p className="hint">Fine detail shows every ridge; softer detail wears more smoothly over the years.</p>
        </div>
      </details>
    </div>
  );
}
