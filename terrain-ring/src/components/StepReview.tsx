import { useRingStore } from "../state/ringStore";
import { useTerrainStore } from "../state/terrainStore";
import { UK_RING_SIZES, getInnerDiameterMm } from "../geometry/ring-sizing";
import { METALS } from "../three/materials";
import { facePreset, HEAD_SHAPES } from "../geometry/ring-blank";
import type { PreviewStats } from "./RingViewer";

const PROFILE_LABEL = { flat: "flat", classic: "comfort", d_shape: "D-shape" } as const;

export function StepReview({ stats, showCartMessage }: { stats: PreviewStats | null; showCartMessage: boolean }) {
  const ring = useRingStore();
  const terrain = useTerrainStore();
  const later = ring.ringSize === null;

  return (
    <div className="stack">
      <div className="choice">
        <span className="choice-label">Ring size</span>
        <div className="choice-row" role="radiogroup" aria-label="Ring size">
          <button role="radio" aria-checked={!later} className={!later ? "on" : ""} onClick={() => ring.set({ ringSize: ring.ringSize ?? "N" })}>I know my size</button>
          <button role="radio" aria-checked={later} className={later ? "on" : ""} onClick={() => ring.set({ ringSize: null })}>Size later</button>
        </div>
      </div>
      {later ? (
        <div className="card-note">
          <strong>Confirm your size later</strong>
          <ol>
            <li>Send us your design and we’ll reply with a written quote.</li>
            <li>We confirm your ring size with you before anything is made.</li>
            <li>Nothing is made until you’ve approved the design, size and price.</li>
          </ol>
        </div>
      ) : (
        <label className="select" htmlFor="ring-size">
          <span className="choice-label">UK size</span>
          <select id="ring-size" className="num" value={ring.ringSize ?? "N"} onChange={(e) => ring.set({ ringSize: e.target.value })}>
            {UK_RING_SIZES.map((s) => (
              <option key={s} value={s}>{s} · {getInnerDiameterMm(s).toFixed(1)} mm inside diameter</option>
            ))}
          </select>
        </label>
      )}

      <dl className="summary num">
        <dt>Place</dt><dd>{terrain.place.name}, {(terrain.place.lengthM / 1000).toFixed(1)} km across, {Math.round(terrain.bearingDeg)}° from north</dd>
        <dt>Landscape</dt><dd>{Math.round(terrain.terrainHeight * 100)}% height{stats ? ` (${stats.exaggeration.toFixed(1)}× true scale)` : ""}, {terrain.detail === "high" ? "fine" : terrain.detail === "medium" ? "balanced" : "soft"} detail</dd>
        <dt>Ring</dt><dd>{facePreset(ring.weight, ring.headShape).label} {HEAD_SHAPES[ring.headShape].toLowerCase()} head ({facePreset(ring.weight, ring.headShape).faceLengthMm} × {facePreset(ring.weight, ring.headShape).faceWidthMm} mm), {ring.shoulder} shoulders, {PROFILE_LABEL[ring.profile]} band {facePreset(ring.weight, ring.headShape).bandWidthMm} mm wide at the palm</dd>
        <dt>Metal</dt><dd>{METALS[ring.metal].label}, {ring.finish}</dd>
        {stats && <><dt>Approx. weight</dt><dd>{stats.massG.toFixed(1)} g{later ? " at size N" : ""}</dd></>}
      </dl>

      <ul className="assurance">
        <li>Nothing is made until you approve your design.</li>
      </ul>

      {showCartMessage && (
        <p className="cart-note" role="status">Nothing has been sent. Contact us to discuss this design and receive a written quote.</p>
      )}

      <div className="contact">
        <span>Prefer to talk it through? We’re happy to help.</span>
        <a className="btn-secondary" href="https://aviediamonds.com/pages/contact-us" target="_blank" rel="noreferrer">Contact us</a>
      </div>
    </div>
  );
}
