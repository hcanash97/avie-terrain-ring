import { useEffect, useRef, useState } from "react";
import { createScene, type SceneContext, type ViewName } from "../three/scene";
import { buildTerrain, frameFor } from "../three/terrain-surface";
import { LOD, type Quality } from "../three/performance";
import { createRingMesh, facePreset, meshVolume, METAL_DENSITY_G_CM3 } from "../geometry/ring-blank";
import { getInnerDiameterMm } from "../geometry/ring-sizing";
import type { TerrainSource } from "../geometry/heightmap";
import { useRingStore } from "../state/ringStore";
import { useTerrainStore } from "../state/terrainStore";

export type PreviewStats = { triangles: number; ms: number; massG: number; exaggeration: number; rangeM: number };

type Props = { source: TerrainSource; onStats: (s: PreviewStats) => void };

const PREVIEW_SIZE = "N"; // used for the preview when the customer sizes later

export function RingViewer({ source, onStats }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const [quality, setQuality] = useState<Quality>("high");
  const [simplified, setSimplified] = useState(false);
  const { metal, finish, weight, headShape, shoulder, profile, ringSize, clay } = useRingStore();
  const { place, bearingDeg, terrainHeight, detail, dragging, flat } = useTerrainStore();
  const [view, setView] = useState<ViewName>("three_quarter");

  useEffect(() => {
    if (!containerRef.current) return;
    const context = createScene(containerRef.current, {
      pixelRatioCap: 2,
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
  }, []);

  useEffect(() => {
    sceneRef.current?.setMaterial(metal, finish);
  }, [metal, finish]);

  useEffect(() => {
    sceneRef.current?.setClay(clay);
  }, [clay]);

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
        exaggeration: terrain.exaggeration,
        rangeM: terrain.rangeM
      });
    };
    if (dragging) {
      build(LOD.drag);
      return;
    }
    const id = setTimeout(() => build(quality === "low" ? LOD.low : LOD.high), 100);
    return () => clearTimeout(id);
  }, [source, place.lengthM, bearingDeg, terrainHeight, detail, weight, headShape, shoulder, profile, ringSize, metal, dragging, quality, onStats, flat]);

  const VIEW_LABELS: [ViewName, string][] = [["three_quarter", "¾"], ["front", "Front"], ["side", "Side"], ["top", "Top"]];

  return (
    <>
      <div ref={containerRef} className="viewer" aria-label="3D preview of your ring. Drag to rotate, pinch or scroll to zoom." />
      <div className="view-bar" role="group" aria-label="Camera views">
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
      {simplified && (
        <div className="notice">We’ve simplified the preview to keep everything running smoothly. Your finished ring will include the full level of detail.</div>
      )}
    </>
  );
}
