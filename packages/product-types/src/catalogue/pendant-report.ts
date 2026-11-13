/**
 * Renders docs/pendant-presets.md from the pendant styles and catalogue, so the
 * preset table cannot drift from the code (a test compares the committed file).
 * Values are design parameters; measured volume, mass and terrain-dependent
 * depth are in each review package.
 */
import { availabilityOf } from "./availability";
import { getPreset } from "./index";
import { COVERAGE_LABELS, PENDANT_STYLES, pendantStyleParameters, sizeLabel, styleAppliesTo } from "./pendant-styles";

const f = (x: number) => +x.toFixed(2);

export function renderPendantPresets(): string {
  const out: string[] = [
    "# Pendant presets",
    "",
    "Generated from `packages/product-types/src/catalogue/pendant-styles.ts` and the catalogue by `npm run catalogue:report`. Do not edit by hand; a test fails if this file differs from the code.",
    "",
    "- **Body sizes** are the catalogue's proposed tiers. **All other dimensions are preview-only** values from each style's profile: not manufacturing values.",
    "- Size names are proposals and are always shown with millimetres. Style names are proposals for À Vie to approve.",
    "- Body dimensions exclude the attachment; overall dimensions include it. Depth is the body's maximum (base + maximum relief); the actual relief depends on the place and terrain height.",
    "- Measured volume, mass, structural wall and attachment slices are in each review package (`npm run package -- --product pendant --style <id> --size <tier>`).",
    "- No chain has been chosen: no channel or bail is claimed to fit any chain.",
    "",
  ];
  for (const style of Object.values(PENDANT_STYLES)) {
    out.push(
      `## ${style.label} (\`${style.id}\`)${style.collection === "internal" ? " — internal prototype" : ""}`,
      "",
      `- ${style.attachmentNote}`,
      `- Expected topology: ${style.expectedTopology.shells} shell, ${style.expectedTopology.genus} hole through the solid. ${style.expectedTopology.note}`,
      `- Preview-only profile: \`${style.profileId}\`. Default terrain: ${COVERAGE_LABELS[style.defaultCoverage.mode].toLowerCase()}.`,
      "",
      "| Size | Body W × H | Corner radius | Base | Max relief | Max body depth | Edge round | Attachment | Metal around channel / sections | Overall W × H × D | Status |",
      "|---|---|---:|---:|---:|---:|---:|---|---|---|---|",
    );
    for (const presetId of styleAppliesTo(style.id)) {
      const p = pendantStyleParameters(presetId, style.id);
      const a = p.attachment;
      const bodyDepth = p.baseThicknessMm + p.maximumReliefMm;
      let attachment = "", around = "", overallH = p.outline.heightMm, yMin = 0, yMax = bodyDepth;
      if (a.kind === "through_hole") {
        attachment = `channel Ø${a.diameterMm} along X; centre ${a.centreFromTopMm} below top, ${a.centreHeightMm} above back`;
        around = `${f(a.centreFromTopMm - a.diameterMm / 2)} above / ${f(a.centreHeightMm - a.diameterMm / 2)} behind / ${f(p.baseThicknessMm - a.centreHeightMm - a.diameterMm / 2)} in front`;
      } else if (a.kind === "loop" || a.kind === "tab") {
        const s = a.kind === "loop" ? a.wallMm : a.thicknessMm;
        attachment = `${a.kind}: opening ${a.openingHeightMm} high × ${a.openingDepthMm} front-to-back, along X; ${a.embedMm} into the top edge`;
        around = a.kind === "loop" ? `wire Ø${a.wallMm}` : `strap ${a.widthMm} × ${a.thicknessMm}`;
        overallH = p.outline.heightMm + a.openingHeightMm + 2 * s - a.embedMm;
        const ay = a.openingDepthMm / 2 + s / 2;
        yMin = Math.min(0, p.baseThicknessMm / 2 - ay - s / 2);
        yMax = Math.max(bodyDepth, p.baseThicknessMm / 2 + ay + s / 2);
      }
      const preset = getPreset(presetId);
      const use = availabilityOf(preset).allowed;
      out.push(
        `| ${sizeLabel(presetId)} | ${p.outline.widthMm} × ${p.outline.heightMm} | ${f(p.outline.cornerRadiusMm)} | ${p.baseThicknessMm} | ${p.maximumReliefMm} | ${f(bodyDepth)} | ${p.edgeRoundMm} | ${attachment} | ${around} | ${p.outline.widthMm} × ${f(overallH)} × ${f(yMax - yMin)} | design ${preset.status.design}; manufacturing ${preset.status.manufacturing}; preview ${use.internalPreview ? "yes" : "no"}; review package yes; checkout ${use.checkout ? "yes" : "no"} |`,
      );
    }
    out.push("");
  }
  return out.join("\n");
}
