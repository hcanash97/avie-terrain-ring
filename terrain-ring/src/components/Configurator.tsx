import { useEffect, useState } from "react";
import { createDemoSource, type TerrainSource } from "../geometry/heightmap";
import { loadBakedSource, loadTerrainSource } from "../three/heightmap-loader";
import { isWebGLAvailable } from "../three/renderer";
import { METALS } from "../three/materials";
import { HEAD_SHAPES, WEIGHTS } from "../geometry/ring-blank";
import { useRingStore } from "../state/ringStore";
import { useTerrainStore } from "../state/terrainStore";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { RingViewer, type PreviewStats } from "./RingViewer";
import { StepLocation } from "./StepLocation";
import { StepLandscape } from "./StepLandscape";
import { StepRing } from "./StepRing";
import { StepReview } from "./StepReview";
import { LoadingOverlay } from "./LoadingOverlay";
import { ErrorBanner } from "./ErrorBanner";
import { track } from "../lib/analytics";
import logo from "../assets/avie-logo.png";

const STEPS = ["Place", "Landscape", "Ring", "Size & review"] as const;
const SITE = "https://aviediamonds.com";

export function Configurator() {
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<TerrainSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [cartMessage, setCartMessage] = useState(false);
  const place = useTerrainStore((s) => s.place);
  const terrainOrigin = useTerrainStore((s) => s.terrainOrigin);
  const setTerrain = useTerrainStore((s) => s.set);
  const { metal, weight, headShape } = useRingStore();
  const [webgl] = useState(isWebGLAvailable);

  // Refetch elevation only once the map has settled.
  const area = useDebouncedValue(place, 400);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadTerrainSource(area.lat, area.lon, area.lengthM * 0.72, area.lengthM / 600, controller.signal)
      .then((s) => {
        setSource(s);
        setNotice(null);
        setTerrain({ terrainOrigin: "live" });
        track("terrain_preview_loaded", { place: area.name });
      })
      .catch(async (err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const saved = await loadBakedSource(area.name, controller.signal).catch(() => null);
        if (controller.signal.aborted) return;
        if (saved) {
          setSource(saved);
          setNotice(null);
          setTerrain({ terrainOrigin: "saved" });
          return;
        }
        setTerrain({ terrainOrigin: "sample" });
        setSource((prev) => prev ?? createDemoSource());
        setNotice("Live elevation isn’t available here, so this is sample terrain. Choose one of the suggested places to see a real landscape.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [area, setTerrain]);

  const last = step === STEPS.length - 1;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={SITE} target="_blank" rel="noreferrer">
          <img src={logo} alt="À Vie Diamonds" />
          <span className="brand-name">
            À Vie Diamonds
            <small>Terra Ring</small>
          </span>
        </a>
        <nav className="topbar-links" aria-label="À Vie Diamonds">
          <a href={`${SITE}/pages/the-bespoke-journey`} target="_blank" rel="noreferrer">How we work</a>
          <a href={`${SITE}/pages/ring-sizing`} target="_blank" rel="noreferrer">Ring sizing</a>
          <a className="contact-link" href={`${SITE}/pages/contact-us`} target="_blank" rel="noreferrer">Contact</a>
        </nav>
      </header>
      <main className="configurator">
        <section className="stage" aria-label="Your ring">
          <div className="stage-head">
            <span className="eyebrow">{WEIGHTS[weight].label} {HEAD_SHAPES[headShape].toLowerCase()} · {METALS[metal].label}</span>
            <h1>{place.name}</h1>
            <p className="stage-meta num">
              {stats
                ? <>{(place.lengthM / 1000).toFixed(1)} km across · relief {stats.exaggeration.toFixed(1)}× · approx. {stats.massG.toFixed(1)} g of metal</>
                : <>Preparing your landscape</>}
              {terrainOrigin !== "live" && (
                <span className="origin-tag">{terrainOrigin === "saved" ? "Saved terrain" : "Sample terrain"}</span>
              )}
            </p>
            <p className="quote-line">Priced by written quote · nothing is made until you approve it</p>
            {stats?.terrainAdjusted && <p className="hint">Steep edge detail has been softened where the terrain meets the shoulders.</p>}
          </div>
          {webgl ? (
            source && <RingViewer source={source} onStats={setStats} />
          ) : (
            <ErrorBanner tone="info">3D preview isn’t available on this device. You can still design your ring, and we’ll send renders before anything is made.</ErrorBanner>
          )}
          {loading && !source && <LoadingOverlay label="Preparing your landscape…" />}
          {loading && source && <div className="pill-loading">Updating landscape…</div>}
          {notice && <ErrorBanner>{notice}</ErrorBanner>}
          <p className="stage-foot">
            A sculptural interpretation of real elevation data. Hand finishing softens the finest detail. Drag to turn the ring.
          </p>
        </section>

        <aside className="panel">
          <div className="step-head">
            <button className="icon-btn" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Previous step">‹</button>
            <h2>{STEPS[step]} <span className="num">{step + 1}/{STEPS.length}</span></h2>
            <button className="icon-btn" disabled={last} onClick={() => setStep(step + 1)} aria-label="Next step">›</button>
          </div>
          <div className="step-body">
            {step === 0 && <StepLocation />}
            {step === 1 && <StepLandscape exaggeration={stats?.exaggeration ?? null} />}
            {step === 2 && <StepRing />}
            {step === 3 && <StepReview stats={stats} showCartMessage={cartMessage} />}
          </div>
          <footer className="stepper">
            <div className="stepper-main">
              <ol>
                {STEPS.map((name, i) => (
                  <li key={name} className={i < step ? "done" : i === step ? "current" : ""}>
                    <button onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${name}`} aria-current={i === step ? "step" : undefined}>
                      <span className="bar" aria-hidden="true" />
                      <span className="step-number">{String(i + 1).padStart(2, "0")}</span><span>{name}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <span className="stepper-note">Nothing is made until you approve your design.</span>
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                if (last) {
                  setCartMessage(true);
                  track("quote_next_steps_viewed");
                } else setStep(step + 1);
              }}
            >
              {last ? "Next steps" : "Continue"}
            </button>
          </footer>
        </aside>
      </main>
    </div>
  );
}
