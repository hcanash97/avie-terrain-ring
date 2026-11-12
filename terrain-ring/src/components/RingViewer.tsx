import { useEffect, useRef, useState } from "react";
import { createScene, type SceneContext, type ViewName } from "../three/scene";
import { buildTerrain, frameFor } from "../three/terrain-surface";
import { LOD, type Quality } from "../three/performance";
import { createRingMesh, facePreset, meshVolume, METAL_DENSITY_G_CM3 } from "../geometry/ring-blank";
import { getInnerDiameterMm } from "../geometry/ring-sizing";
import type { TerrainSource } from "../geometry/heightmap";
import { useRingStore } from "../state/ringStore";
import { useTerrainStore } from "../state/terrainStore";

export type PreviewStats = { triangles: number; ms: number; massG: number; exaggeration: number; rangeM: number; terrainAdjusted: boolean };

type Props = { source: TerrainSource; onStats: (s: PreviewStats) => void };

const PREVIEW_SIZE = "N"; // used for the preview when the customer sizes later

export function RingViewer({ source, onStats }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const [quality, setQuality] = useState<Quality>("high");
  const [simplified, setSimplified] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const [comparison, setComparison] = useState("");
  const { metal, finish, weight, headShape, shoulder, profile, ringSize, clay } = useRingStore();
  const { place, bearingDeg, terrainHeight, detail, dragging, flat } = useTerrainStore();
  const [view, setView] = useState<ViewName>("three_quarter");

  useEffect(() => {
    const stage = containerRef.current?.parentElement;
    if (!stage) return;
    const heading = stage.querySelector<HTMLElement>(".stage-head");
    const foot = stage.querySelector<HTMLElement>(".stage-foot");
    const toolbar = stage.querySelector<HTMLElement>(".view-bar");
    const measure = () => {
      stage.style.setProperty("--viewer-top", `${(heading?.offsetTop ?? 20) + (heading?.offsetHeight ?? 100) + 12}px`);
      const toolbarBottom = toolbar ? parseFloat(getComputedStyle(toolbar).bottom) : 18;
      stage.style.setProperty("--toolbar-space", `${(toolbar?.offsetHeight ?? 40) + toolbarBottom + 16}px`);
      stage.style.setProperty("--viewer-bottom", `${foot ? stage.clientHeight - foot.offsetTop + 12 : 130}px`);
    };
    const observer = new ResizeObserver(measure);
    if (heading) observer.observe(heading);
    if (foot) observer.observe(foot);
    if (toolbar) observer.observe(toolbar);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const context = createScene(containerRef.current, {
      pixelRatioCap: 2,
      onContextLost: () => setContextLost(true),
      onContextRestored: () => { setContextLost(false); setSceneVersion((v) => v + 1); },
      onFps: (fps) => {
        if (fps < 30) {
          setQuality("low");
          setSimplified(true);
        }
      }
    });
    sceneRef.current = context;
    return () => {
      context.dispose();
      sceneRef.current = null;
    };
  }, [sceneVersion, createScene]);

  useEffect(() => { sceneRef.current?.setView(view); }, [view, sceneVersion]);

  useEffect(() => {
    sceneRef.current?.setMaterial(metal, finish);
  }, [metal, finish, sceneVersion]);

  useEffect(() => {
    sceneRef.current?.setClay(clay);
  }, [clay, sceneVersion]);

  useEffect(() => {
    const build = (lod: (typeof LOD)[keyof typeof LOD]) => {
      const started = performance.now();
      const preset = facePreset(weight, headShape);
      const terrain = buildTerrain(
        source,
        frameFor(place.lengthM, bearingDeg, preset),
        preset,
        { terrainHeight, detail },
        lod.cols
      );
      const mesh = createRingMesh({
        innerDiameterMm: getInnerDiameterMm(ringSize ?? PREVIEW_SIZE),
        weight: preset,
        shoulder,
        profile,
        terrain: flat ? null : terrain,
        resolution: lod
      });
      sceneRef.current?.setRing(mesh);
      onStats({
        triangles: mesh.triangleCount,
        ms: Math.round(performance.now() - started),
        massG: (meshVolume(mesh) / 1000) * METAL_DENSITY_G_CM3[metal],
        exaggeration: flat ? 0 : terrain.exaggeration,
        rangeM: flat ? 0 : terrain.rangeM,
        terrainAdjusted: mesh.terrainAdapted
      });
    };
    if (dragging) {
      build(LOD.drag);
      return;
    }
    const id = setTimeout(() => build(quality === "low" ? LOD.low : LOD.high), 100);
    return () => clearTimeout(id);
  }, [source, place.lengthM, bearingDeg, terrainHeight, detail, weight, headShape, shoulder, profile, ringSize, metal, dragging, quality, onStats, flat, sceneVersion]);

  const VIEW_LABELS: [ViewName, string][] = [["three_quarter", "¾"], ["front", "Front"], ["side", "Side"], ["top", "Top"], ["detail", "Detail"]];

  return (
    <>
      <div ref={containerRef} className="viewer" aria-label="3D preview of your Terra ring. Drag to rotate. Use the zoom buttons to change scale." />
      <div className="view-bar" role="group" aria-label="Camera views">
        <button title="Rebuild lighting and materials without changing your design" onClick={() => { setContextLost(false); setSceneVersion((v) => v + 1); }}>Reset preview</button>
        <button aria-label="Zoom out" onClick={() => sceneRef.current?.zoom(1.18)}>−</button>
        <button aria-label="Zoom in" onClick={() => sceneRef.current?.zoom(0.85)}>+</button>
        {VIEW_LABELS.map(([v, label]) => (
          <button
            key={v}
            className={view === v ? "on" : ""}
            aria-pressed={view === v}
            title={v === "three_quarter" ? "Reset to the default view" : `${label} view`}
            onClick={() => { setView(v); sceneRef.current?.setView(v); }}
          >
            {label}
          </button>
        ))}
      </div>
      {import.meta.env.DEV && <details className="dev-inspection">
        <summary>Inspect shape</summary>
        <label><input type="checkbox" checked={clay} onChange={(e) => useRingStore.getState().set({ clay: e.target.checked })} /> Clay</label>
        <label><input type="checkbox" checked={flat} onChange={(e) => useTerrainStore.getState().set({ flat: e.target.checked })} /> Flat terrain</label>
        <button onClick={() => sceneRef.current?.simulateContextRecovery()}>Test GPU recovery</button>
        <button disabled={comparison === "Building comparison…"} onClick={async () => {
          setComparison("Building comparison…");
          try { await (await import("../three/comparison")).buildComparisonSheet(); setComparison("Comparison saved in captures"); }
          catch { setComparison("Comparison failed; try again"); }
        }}>Build comparison sheet</button>
        {comparison && <span role="status">{comparison}</span>}
      </details>}
      {contextLost && <div className="notice" role="status">Restoring the 3D preview… Your design is retained.</div>}
      {simplified && (
        <div className="notice">Preview detail reduced to keep rotation smooth.</div>
      )}
    </>
  );
}
