import { Choice } from "./Choice";
import { ProductImage } from "./ProductImage";
import { LoadingOverlay } from "./LoadingOverlay";
import { withTimeout } from "../lib/withTimeout";
import { useEffect, useRef, useState } from "react";
import { availabilityOf, COVERAGE_LABELS, getPreset, PENDANT_STYLES, sizeLabel, type PendantStyleId } from "@avie/product-types";
import { createScene, type SceneContext, type ViewName } from "../three/scene";
import { loadBakedSource } from "../three/heightmap-loader";
import { METALS, type Metal } from "../three/materials";
import { PRESET_PLACES } from "../state/terrainStore";
import type { TerrainSource } from "../geometry/heightmap";
import { METAL_DENSITY_G_CM3 } from "../geometry/ring-blank";
import { buildPendantPreview, pendantDisplayMesh, presetFor, SIZE_TIERS, type SizeTier } from "../geometry/pendant-preview";

type Built = Awaited<ReturnType<typeof buildPendantPreview>>;

/**
 * Internal prototype preview of the pendant styles (#pendant-preview). Not linked
 * from the customer configurator; shows every preview-only value it relies on.
 */
export function PendantPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const [style, setStyle] = useState<PendantStyleId>("tablet_slider");
  const [tier, setTier] = useState<SizeTier>("classic");
  const [coverageMode, setCoverageMode] = useState<"style" | "full" | "above_level">("style");
  const [level, setLevel] = useState(0.3);
  const [placeName, setPlaceName] = useState(PRESET_PLACES[0]!.name);
  const [source, setSource] = useState<TerrainSource | null>(null);
  const [terrainHeight, setTerrainHeight] = useState(0.8);
  const [bearingDeg, setBearingDeg] = useState(0);
  const [metal, setMetal] = useState<Metal>("silver_925");
  const [clay, setClay] = useState(false);
  const [view, setView] = useState<ViewName>("front");
  const [built, setBuilt] = useState<Built | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  const [graphicsError, setGraphicsError] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const place = PRESET_PLACES.find((p) => p.name === placeName)!;
  const preset = getPreset(presetFor(style, tier));
  const allowed = availabilityOf(preset).allowed.internalPreview;
  const styleInfo = PENDANT_STYLES[style];

  useEffect(() => {
    if (!containerRef.current) return;
    setGraphicsError(false);
    let context: SceneContext;
    try { context = createScene(containerRef.current, { pixelRatioCap: 2 }); }
    catch { setGraphicsError(true); setError("3D graphics are unavailable on this device."); setPending(false); return; }
    sceneRef.current = context;
    return () => { context.dispose(); sceneRef.current = null; };
  }, [attempt]);

  useEffect(() => {
    const abort = new AbortController();
    setSource(null);
    setBuilt(null);
    setSourceError(null);
    setPending(true);
    void withTimeout(loadBakedSource(placeName, abort.signal), 15000)
      .then((value) => { if (!value) throw new Error("No cached elevation for this place"); if (!abort.signal.aborted) setSource(value); })
      .catch(() => { if (!abort.signal.aborted) { setSourceError("The landscape couldn’t load. Your options are retained."); setPending(false); } });
    return () => abort.abort();
  }, [placeName, attempt]);

  useEffect(() => {
    if (!source || !allowed) return;
    let cancelled = false;
    setPending(true);
    setError(null);
    setBuilt(null);
    const coverage = coverageMode === "style" ? undefined : coverageMode === "full" ? { mode: "full" as const } : { mode: "above_level" as const, level };
    const id = setTimeout(() => {
      withTimeout(buildPendantPreview({ style, tier, coverage, source, lengthM: place.lengthM, bearingDeg, terrainHeight, detail: "high" }), 20000)
        .then((b) => { if (!cancelled) { setBuilt(b); setError(null); } })
        .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
        .finally(() => { if (!cancelled) setPending(false); });
    }, 80);
    return () => { cancelled = true; clearTimeout(id); };
  }, [source, allowed, style, tier, coverageMode, level, place.lengthM, bearingDeg, terrainHeight, attempt]);

  useEffect(() => { if (built) sceneRef.current?.setRing(pendantDisplayMesh(built.built.mesh)); }, [built]);
  useEffect(() => { sceneRef.current?.setMaterial(metal, "polished"); }, [metal, built]);
  useEffect(() => { sceneRef.current?.setClay(clay); }, [clay, built]);
  useEffect(() => { sceneRef.current?.setView(view); }, [view, built]);

  const d = built?.built.dimensions;
  const massG = d ? (d.volumeMm3 / 1000) * METAL_DENSITY_G_CM3[metal] : null;
  const coverage = built?.params.coverage;

  return (
    <main className="pendant-preview">
      <a className="back-to-ring" href="#">← Back to Terra Ring</a>
      <section className="stage pendant-stage" aria-label="Pendant prototype preview">
        <div ref={containerRef} className="viewer" aria-label="3D preview of the pendant prototype. Drag to rotate." />
        {pending && <LoadingOverlay label="Preparing pendant preview…" />}
        {(error || sourceError || graphicsError) && <div className="preview-error" role="alert"><ProductImage name={`pendant-${style}`} /><h2>Preview unavailable</h2><p>{sourceError ?? "The 3D model couldn’t load here. Your choices have been kept."}</p><p className="small">Style illustration shown; it does not show your selected landscape.</p><button className="btn-secondary" onClick={() => setAttempt((v) => v + 1)}>Retry preview</button></div>}
        <div className="view-bar" role="group" aria-label="Camera views">
          {(["front", "three_quarter", "side", "top"] as ViewName[]).map((v) => (
            <button key={v} className={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{v === "three_quarter" ? "¾" : v[0]!.toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
      </section>
      <aside className="pendant-panel">
        <p className="pendant-warning" role="note"><strong>Internal prototype preview.</strong> Not for sale or production. Attachment strength and chain fit are awaiting manufacturer review.</p>
        <h1>{styleInfo.label}</h1>
        <p className="small">{sizeLabel(preset.id)}{styleInfo.collection === "internal" ? " · internal prototype, not part of the proposed collection" : ""}</p>
        {!allowed && <p role="alert">This preset is not enabled for internal preview.</p>}

        <Choice label="Pendant style" variant="card" value={style} options={Object.values(PENDANT_STYLES).map((v) => ({ value: v.id, label: v.label.replace(/^Terrain /, ""), note: v.attachmentNote, icon: <ProductImage name={`pendant-${v.id}`} /> }))} onChange={setStyle} />
        <label>Size <select value={tier} onChange={(e) => setTier(e.target.value as SizeTier)}>{SIZE_TIERS.map((t) => <option key={t} value={t}>{sizeLabel(presetFor(style, t))}</option>)}</select></label>
        <label>Terrain coverage <select value={coverageMode} onChange={(e) => setCoverageMode(e.target.value as typeof coverageMode)}>
          <option value="style">Style default ({COVERAGE_LABELS[styleInfo.defaultCoverage.mode].toLowerCase()})</option>
          <option value="full">{COVERAGE_LABELS.full}</option>
          <option value="above_level">{COVERAGE_LABELS.above_level}</option>
        </select></label>
        {coverageMode === "above_level" && <label>Flat below {Math.round(level * 100)}% of the relief <input type="range" min={0} max={0.8} step={0.05} value={level} onChange={(e) => setLevel(+e.target.value)} /></label>}
        <label>Place <select value={placeName} onChange={(e) => setPlaceName(e.target.value)}>{PRESET_PLACES.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>
        <label>Terrain height {Math.round(terrainHeight * 100)}% <input type="range" min={0.05} max={1} step={0.05} value={terrainHeight} onChange={(e) => setTerrainHeight(+e.target.value)} /></label>
        <label>Rotation {bearingDeg}° <input type="range" min={0} max={355} step={5} value={bearingDeg} onChange={(e) => setBearingDeg(+e.target.value)} /></label>
        <label>Metal <select value={metal} onChange={(e) => setMetal(e.target.value as Metal)}>{(Object.keys(METALS) as Metal[]).map((m) => <option key={m} value={m}>{METALS[m].label}</option>)}</select></label>


        <h2>Dimensions (generated)</h2>
        {d && !pending && !error && !sourceError ? (
          <dl className="num">
            <dt>Body</dt><dd>{d.body.widthMm} × {d.body.heightMm} mm, {d.body.depthMm} mm deep</dd>
            <dt>Overall</dt><dd>{d.overall.widthMm} × {d.overall.heightMm} × {d.overall.depthMm} mm (W × H × D)</dd>
            <dt>Attachment</dt><dd>{styleInfo.attachmentNote}</dd>
            <dt>Terrain</dt><dd>{coverage?.mode === "above_level" ? `flat below ${Math.round(coverage.level * 100)}% of the relief (stylised, not a coastline)` : "full relief"}; {(place.lengthM / 1000).toFixed(1)} km across the width; north at the top</dd>
            <dt>Estimated mass</dt><dd>{massG!.toFixed(2)} g {METALS[metal].label}</dd>
          </dl>
        ) : <p role="status">{error || sourceError ? "Dimensions unavailable until a model is built." : "Preparing dimensions…"}</p>}

        <details className="prototype-inspector refine"><summary>Prototype inspector</summary>
        <p className="small">Profile: <code>{styleInfo.profileId}</code></p>
        {error && <p className="small">Diagnostic: {error}</p>}
        <label className="toggle"><input type="checkbox" checked={clay} onChange={(e) => setClay(e.target.checked)} /> Neutral clay inspection</label>
        <h2>Preview-only values</h2>
        <table className="num"><tbody>
          {Object.entries(styleInfo.values).map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v.value}</td><td>{v.note}</td></tr>)}
        </tbody></table>

        <h2>Not decided</h2>
        <p>The attachment is joined into one solid, but its strength and chain fit are not assessed. Awaiting the manufacturer: {Object.keys(preset.manufacturing).join(", ")}. Chain: awaiting an approved supplied chain.</p>
        </details>
      </aside>
    </main>
  );
}
