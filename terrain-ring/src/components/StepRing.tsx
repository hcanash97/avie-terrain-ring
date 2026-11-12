import { useRingStore } from "../state/ringStore";
import { METALS, type Finish, type Metal } from "../three/materials";
import { facePreset, HEAD_SHAPES, WEIGHTS, type BandProfile, type HeadShape, type ShoulderStyle, type Weight } from "../geometry/ring-blank";
import { Choice } from "./Choice";
import { track } from "../lib/analytics";

const icon = (d: string) => (
  <svg viewBox="0 0 60 50" width="56" height="46" aria-hidden>
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
// Front view of the head narrowing into the band.
const SHOULDER_ICONS: Record<ShoulderStyle, string> = {
  straight: "M12 6 H48 L40 44 H20 Z",
  classic: "M10 6 H50 C50 20 36 22 36 30 V44 H24 V30 C24 22 10 20 10 6 Z",
  curved: "M10 6 H50 C46 18 36 24 35 44 H25 C24 24 14 18 10 6 Z"
};
// Band cross-sections.
const PROFILE_ICONS: Record<BandProfile, string> = {
  flat: "M8 18 H52 V32 H8 Z",
  classic: "M8 25 C8 14 52 14 52 25 C52 36 8 36 8 25 Z",
  d_shape: "M8 32 C8 12 52 12 52 32 Z"
};

export function StepRing() {
  const s = useRingStore();
  const change = (patch: Parameters<typeof s.set>[0]) => {
    s.set(patch);
    track("option_changed", patch);
  };

  return (
    <div className="stack">
      <Choice<HeadShape>
        label="Head shape"
        variant="card"
        value={s.headShape}
        options={[
          { value: "bar", label: HEAD_SHAPES.bar, icon: icon("M6 17 H54 V33 H6 Z") },
          { value: "cushion", label: HEAD_SHAPES.cushion, icon: icon("M18 6 H42 Q52 6 52 16 V34 Q52 44 42 44 H18 Q8 44 8 34 V16 Q8 6 18 6 Z") }
        ]}
        onChange={(headShape) => change({ headShape })}
      />
      <Choice<Weight>
        label="Face size"
        variant="card"
        value={s.weight}
        options={(Object.keys(WEIGHTS) as Weight[]).map((w) => ({
          value: w,
          label: WEIGHTS[w].label,
          note: `${facePreset(w, s.headShape).faceLengthMm} × ${facePreset(w, s.headShape).faceWidthMm} mm face · ${WEIGHTS[w].bandWidthMm} mm band`
        }))}
        onChange={(weight) => change({ weight })}
      />
      <div className="choice">
        <span className="choice-label">Metal · <strong>{METALS[s.metal].label}</strong></span>
        <div className="swatches">
          {(Object.keys(METALS) as Metal[]).map((m) => (
            <button
              key={m}
              className={`swatch ${s.metal === m ? "on" : ""}`}
              onClick={() => change({ metal: m })}
              aria-pressed={s.metal === m}
              aria-label={METALS[m].label}
            >
              <i style={{ background: `#${METALS[m].color.toString(16)}` }} />
              <span>{METALS[m].short}</span>
            </button>
          ))}
        </div>
      </div>
      <Choice<Finish>
        label="Finish"
        value={s.finish}
        options={[{ value: "polished", label: "Polished" }, { value: "satin", label: "Satin" }]}
        onChange={(finish) => change({ finish })}
      />
      <Choice<ShoulderStyle>
        label="Shoulders"
        variant="card"
        value={s.shoulder}
        options={(["straight", "classic", "curved"] as ShoulderStyle[]).map((v) => ({
          value: v, label: v[0]!.toUpperCase() + v.slice(1), icon: icon(SHOULDER_ICONS[v])
        }))}
        onChange={(shoulder) => change({ shoulder })}
      />
      <Choice<BandProfile>
        label="Band profile"
        variant="card"
        value={s.profile}
        options={[
          { value: "flat", label: "Flat", icon: icon(PROFILE_ICONS.flat) },
          { value: "classic", label: "Comfort", icon: icon(PROFILE_ICONS.classic) },
          { value: "d_shape", label: "D-shape", icon: icon(PROFILE_ICONS.d_shape) }
        ]}
        onChange={(profile) => change({ profile })}
      />
    </div>
  );
}
