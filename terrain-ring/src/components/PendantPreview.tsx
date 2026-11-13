import { Choice } from "./Choice";
import { ProductImage } from "./ProductImage";
import { LoadingOverlay } from "./LoadingOverlay";
import { withTimeout } from "../lib/withTimeout";
import { useEffect, useRef, useState } from "react";
import { availabilityOf, CHARM_STYLES, COVERAGE_LABELS, getPreset, PENDANT_STYLES, sizeLabel, type CharmStyleId, type PendantStyleId } from "@avie/product-types";
import { createScene, type SceneContext, type ViewName } from "../three/scene";
import { loadBakedSource } from "../three/heightmap-loader";
import { METALS, type Metal } from "../three/materials";
import { PRESET_PLACES } from "../state/terrainStore";
import type { TerrainSource } from "../geometry/heightmap";
import { METAL_DENSITY_G_CM3 } from "../geometry/ring-blank";
import { buildCharmPreview, buildPendantPreview, CHARM_SIZE_TIERS, charmPresetFor, pendantDisplayMesh, presetFor, SIZE_TIERS, type CharmSizeTier, type SizeTier } from "../geometry/pendant-preview";

export type PreviewProduct = "pendant" | "charm";
const PRODUCT_NOUN: Record<PreviewProduct, string> = { pendant: "pendant", charm: "charm" };
/** Size tiers differ by family; petite and classic carry across, the largest maps to the largest. */
const tierFor = (product: PreviewProduct, tier: string): string =>
  tier === "statement" && product === "charm" ? "larger" : tier === "larger" && product === "pendant" ? "statement" : tier;

type Built = Awaited<ReturnType<typeof buildPendantPreview>>;

/**
 * Internal prototype preview of the pendant and charm styles (#pendant-preview,
 * #charm-preview). Not linked from the customer configurator; shows every
 * preview-only value it relies on.
 */
export function PendantPreview({ initialProduct = "pendant" }: { initialProduct?: PreviewProduct }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const [product, setProduct] = useState<PreviewProduct>(initialProduct);
  const [style, setStyle] = useState<PendantStyleId>("tablet_slider");
  const [charmStyle, setCharmStyle] = useState<CharmStyleId>("round_charm");
  const [tier, setTier] = useState<string>("classic");
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
  const isCharm = product === "charm";
  const presetOf = (t: string) => (isCharm ? charmPresetFor(charmStyle, t as CharmSizeTier) : presetFor(style, t as SizeTier));
  const tiers: readonly string[] = isCharm ? CHARM_SIZE_TIERS : SIZE_TIERS;
  const preset = getPreset(presetOf(tier));
  const allowed = availabilityOf(preset).allowed.internalPreview;
  const styleInfo = isCharm ? CHARM_STYLES[charmStyle] : PENDANT_STYLES[style];
  const internalOnly = "collection" in styleInfo && styleInfo.collection === "internal";
  const noun = PRODUCT_NOUN[product];
  const chooseProduct = (next: PreviewProduct) => { setProduct(next); setTier((t) => tierFor(next, t)); };

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
      const terrain = { coverage, source, lengthM: place.lengthM, bearingDeg, terrainHeight, detail: "high" as const };
      withTimeout(isCharm ? buildCharmPreview({ ...terrain, style: charmStyle, tier: tier as CharmSizeTier }) : buildPendantPreview({ ...terrain, style, tier: tier as SizeTier }), 20000)
        .then((b) => { if (!cancelled) { setBuilt(b); setError(null); } })
        .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
        .finally(() => { if (!cancelled) setPending(false); });
    }, 80);
    return () => { cancelled = true; clearTimeout(id); };
  }, [source, allowed, isCharm, style, charmStyle, tier, coverageMode, level, place.lengthM, bearingDeg, terrainHeight, attempt]);

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
      <section className="stage pendant-stage" aria-label={`${noun[0]!.toUpperCase()}${noun.slice(1)} prototype preview`}>
        <div ref={containerRef} className="viewer" aria-label={`3D preview of the ${noun} prototype. Drag to rotate.`} />
        {pending && <LoadingOverlay label={`Preparing ${noun} preview…`} />}
        {(error || sourceError || graphicsError) && <div className="preview-error" role="alert">{!isCharm && <ProductImage name={`pendant-${style}`} />}<h2>Preview unavailable</h2><p>{sourceError ?? "The 3D model couldn’t load here. Your choices have been kept."}</p>{!isCharm && <p className="small">Style illustration shown; it does not show your selected landscape.</p>}<button className="btn-secondary" onClick={() => setAttempt((v) => v + 1)}>Retry preview</button></div>}
        <div className="view-bar" role="group" aria-label="Camera views">
          {(["front", "three_quarter", "side", "top"] as ViewName[]).map((v) => (
            <button key={v} className={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{v === "three_quarter" ? "¾" : v[0]!.toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
      </section>
      <aside className="pendant-panel">
        <p className="pendant-warning" role="note"><strong>Internal prototype preview.</strong> Not for sale or production. {isCharm ? "Loop strength and jump-ring or clasp fit are awaiting manufacturer review; how a charm hangs is still to be decided." : "Attachment strength and chain fit are awaiting manufacturer review."}</p>
        <h1>{styleInfo.label}</h1>
        <p className="small">{sizeLabel(preset.id)}{internalOnly ? " · internal prototype, not part of the proposed collection" : ""}</p>
        {!allowed && <p role="alert">This preset is not enabled for internal preview.</p>}

        <Choice label="Piece" value={product} options={[{ value: "pendant", label: "Pendant" }, { value: "charm", label: "Charm" }]} onChange={chooseProduct} />
        {isCharm
          ? <Choice label="Charm style" variant="card" value={charmStyle} options={Object.values(CHARM_STYLES).map((v) => ({ value: v.id, label: v.label.replace(/^Terrain /, ""), note: v.attachmentNote }))} onChange={setCharmStyle} />
          : <Choice label="Pendant style" variant="card" value={style} options={Object.values(PENDANT_STYLES).map((v) => ({ value: v.id, label: v.label.replace(/^Terrain /, ""), note: v.attachmentNote, icon: <ProductImage name={`pendant-${v.id}`} /> }))} onChange={setStyle} />}
        <label>Size <select value={tier} onChange={(e) => setTier(e.target.value)}>{tiers.map((t) => <option key={t} value={t}>{sizeLabel(presetOf(t))}</option>)}</select></label>
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
        <p>The attachment is joined into one solid, but its strength and {isCharm ? "jump-ring or clasp" : "chain"} fit are not assessed. Awaiting the manufacturer: {Object.keys(preset.manufacturing).join(", ")}. {isCharm ? `Awaiting the supplier: ${Object.keys(preset.components).join(", ")}. Awaiting À Vie: ${Object.keys(preset.design).join(", ")}.` : "Chain: awaiting an approved supplied chain."}</p>
        </details>
      </aside>
    </main>
  );
}
