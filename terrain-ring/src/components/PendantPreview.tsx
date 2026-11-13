import { useEffect, useMemo, useRef, useState } from "react";
import { availabilityOf, getPreset, PENDANT_PREVIEW_PROFILE } from "@avie/product-types";
import { createScene, type SceneContext, type ViewName } from "../three/scene";
import { loadBakedSource } from "../three/heightmap-loader";
import { METALS, type Metal } from "../three/materials";
import { PRESET_PLACES } from "../state/terrainStore";
import type { TerrainSource } from "../geometry/heightmap";
import { METAL_DENSITY_G_CM3 } from "../geometry/ring-blank";
import { buildPendantPreview, pendantDisplayMesh, PENDANT_PRESET_ID } from "../geometry/pendant-preview";

/**
 * Internal prototype preview of the first pendant (#pendant-preview). Not linked
 * from the customer configurator; shows every preview-only value it relies on.
 */
export function PendantPreview() {
  const preset = getPreset(PENDANT_PRESET_ID);
  const allowed = availabilityOf(preset).allowed.internalPreview;
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const [placeName, setPlaceName] = useState(PRESET_PLACES[0]!.name);
  const [source, setSource] = useState<TerrainSource | null>(null);
  const [terrainHeight, setTerrainHeight] = useState(0.7);
  const [bearingDeg, setBearingDeg] = useState(0);
  const [metal, setMetal] = useState<Metal>("gold_9ct");
  const [clay, setClay] = useState(false);
  const [view, setView] = useState<ViewName>("front");
  const place = PRESET_PLACES.find((p) => p.name === placeName)!;

  useEffect(() => {
    if (!allowed || !containerRef.current) return;
    const context = createScene(containerRef.current, { pixelRatioCap: 2 });
    sceneRef.current = context;
    return () => { context.dispose(); sceneRef.current = null; };
  }, [allowed]);

  useEffect(() => {
    const abort = new AbortController();
    setSource(null);
    void loadBakedSource(placeName, abort.signal).then((s) => { if (!abort.signal.aborted) setSource(s); }).catch(() => undefined);
    return () => abort.abort();
  }, [placeName]);

  const built = useMemo(
    () => (source ? buildPendantPreview({ source, lengthM: place.lengthM, bearingDeg, terrainHeight, detail: "high", flat: false }) : null),
    [source, place.lengthM, bearingDeg, terrainHeight],
  );

  useEffect(() => { if (built) sceneRef.current?.setRing(pendantDisplayMesh(built.pendant)); }, [built]);
  useEffect(() => { sceneRef.current?.setMaterial(metal, "polished"); }, [metal, built]);
  useEffect(() => { sceneRef.current?.setClay(clay); }, [clay, built]);
  useEffect(() => { sceneRef.current?.setView(view); }, [view, built]);

  if (!allowed) return <main className="pendant-preview"><p>The pendant prototype preview is not enabled.</p></main>;
  const d = built?.dimensions;
  const massG = d ? ((d.body.volumeMm3 + (d.bail?.volumeMm3 ?? 0)) / 1000) * METAL_DENSITY_G_CM3[metal] : null;
  const unresolved = Object.keys(preset.manufacturing);

  return (
    <main className="pendant-preview">
      <section className="stage pendant-stage" aria-label="Pendant prototype preview">
        <div ref={containerRef} className="viewer" aria-label="3D preview of the pendant prototype. Drag to rotate." />
        <div className="view-bar" role="group" aria-label="Camera views">
          {(["front", "three_quarter", "side", "top"] as ViewName[]).map((v) => (
            <button key={v} className={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{v === "three_quarter" ? "¾" : v[0]!.toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
      </section>
      <aside className="pendant-panel">
        <p className="pendant-warning" role="note"><strong>Internal prototype preview.</strong> Not for sale and not for production. Built with the preview-only profile <code>{PENDANT_PREVIEW_PROFILE.id}</code>.</p>
        <h1>{preset.label}</h1>
        <label>Place <select value={placeName} onChange={(e) => setPlaceName(e.target.value)}>{PRESET_PLACES.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>
        <label>Terrain height {Math.round(terrainHeight * 100)}% <input type="range" min={0.05} max={1} step={0.05} value={terrainHeight} onChange={(e) => setTerrainHeight(+e.target.value)} /></label>
        <label>Rotation {bearingDeg}° <input type="range" min={0} max={355} step={5} value={bearingDeg} onChange={(e) => setBearingDeg(+e.target.value)} /></label>
        <label>Metal <select value={metal} onChange={(e) => setMetal(e.target.value as Metal)}>{(Object.keys(METALS) as Metal[]).map((m) => <option key={m} value={m}>{METALS[m].label}</option>)}</select></label>
        <label><input type="checkbox" checked={clay} onChange={(e) => setClay(e.target.checked)} /> Clay</label>

        <h2>Dimensions (generated)</h2>
        {d ? (
          <dl className="num">
            <dt>Body</dt><dd>Ø{d.body.diameterMm} mm × {d.body.depthMm} mm deep</dd>
            <dt>Overall, with bail</dt><dd>{d.overall.widthMm} × {d.overall.heightMm} × {d.overall.depthMm} mm (W × H × D)</dd>
            <dt>Ground across the face</dt><dd>{(place.lengthM / 1000).toFixed(1)} km; north towards the bail</dd>
            <dt>Estimated mass</dt><dd>{massG!.toFixed(2)} g {METALS[metal].label} (body + bail; overlap not subtracted)</dd>
          </dl>
        ) : <p>Loading saved terrain…</p>}

        <h2>Preview-only values</h2>
        <table className="num"><tbody>
          {Object.entries(PENDANT_PREVIEW_PROFILE.values).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v.value} mm</td><td>{v.note}</td></tr>)}
        </tbody></table>

        <h2>Not decided</h2>
        <p>The bail is a visual placeholder overlapping the rim, not a joined component. Awaiting the manufacturer: {unresolved.join(", ")}. Chain: awaiting an approved supplied chain.</p>
      </aside>
    </main>
  );
}
