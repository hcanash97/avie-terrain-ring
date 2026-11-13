/**
 * Attachment diagnostics, reported (never judged) for the manufacturer.
 *
 *   channel   metal above, behind and in front of the chain channel, from the
 *             design parameters (the body is flat there; terrain only adds metal
 *             in front)
 *   loop/tab  cross-section area measured by slicing the actual mesh: just above
 *             the top edge (where the attachment meets the body) and through
 *             the centre of the opening (both legs)
 */
import type { PendantAttachment } from "./attachments";
import type { PendantOutline } from "./outline";

type Mesh = { positions: ArrayLike<number>; indices: ArrayLike<number> };

/** Area (mm²) and extent of the mesh's cross-section by the plane z = c. */
export function sectionAtZ(m: Mesh, c: number) {
  const P = m.positions, I = m.indices;
  let twiceArea = 0;
  const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (let t = 0; t < I.length; t += 3) {
    const v = [0, 1, 2].map((k) => [P[I[t + k]! * 3]!, P[I[t + k]! * 3 + 1]!, P[I[t + k]! * 3 + 2]! - c]);
    // Orient each segment by how its edges cross the plane (rising, then falling),
    // so segments run the same way round every contour of a closed mesh.
    let p: number[] | null = null, q: number[] | null = null;
    for (let e = 0; e < 3; e++) {
      const a = v[e]!, b = v[(e + 1) % 3]!;
      if ((a[2]! < 0) !== (b[2]! < 0)) {
        const s = a[2]! / (a[2]! - b[2]!);
        const x = [a[0]! + s * (b[0]! - a[0]!), a[1]! + s * (b[1]! - a[1]!)];
        if (a[2]! < 0) p = x;
        else q = x;
      }
    }
    if (!p || !q) continue;
    twiceArea += p[0]! * q[1]! - q[0]! * p[1]!;
    for (const r of [p, q]) for (let k = 0; k < 2; k++) { min[k] = Math.min(min[k]!, r[k]!); max[k] = Math.max(max[k]!, r[k]!); }
  }
  return { areaMm2: Math.abs(twiceArea) / 2, widthMm: max[0]! - min[0]!, depthMm: max[1]! - min[1]! };
}

export function attachmentDiagnostics(m: Mesh, outline: PendantOutline, baseThicknessMm: number, a: PendantAttachment) {
  const r3 = (x: number) => +x.toFixed(3);
  const top = -outline.heightMm / 2;
  if (a.kind === "through_hole") {
    const r = a.diameterMm / 2;
    return {
      kind: a.kind,
      method: "from design parameters: the body is flat around the channel; terrain only adds metal in front",
      channelDiameterMm: a.diameterMm,
      channelDirection: "along X (left to right)",
      channelCentre: { belowTopMm: a.centreFromTopMm, aboveBackMm: a.centreHeightMm },
      metalAboveMm: r3(a.centreFromTopMm - r),
      metalBehindMm: r3(a.centreHeightMm - r),
      metalInFrontUnderBaselineMm: r3(baseThicknessMm - a.centreHeightMm - r),
    };
  }
  if (a.kind === "loop" || a.kind === "tab") {
    const section = a.kind === "loop" ? a.wallMm : a.thicknessMm;
    const az = a.openingHeightMm / 2 + section / 2;
    const centreZ = top - az - section / 2 + a.embedMm;
    const junction = sectionAtZ(m, top - 0.05);
    const middle = sectionAtZ(m, centreZ);
    return {
      kind: a.kind,
      method: "planar slices of the finished mesh at constant height",
      openingMm: { height: a.openingHeightMm, frontToBack: a.openingDepthMm },
      sectionMm: a.kind === "loop" ? { wireDiameter: a.wallMm } : { width: a.widthMm, thickness: a.thicknessMm },
      junctionSlice: { planeMmAboveTopEdge: 0.05, areaMm2: r3(junction.areaMm2), widthMm: r3(junction.widthMm), note: "Both legs, just above where the attachment meets the body." },
      openingCentreSlice: { areaMm2: r3(middle.areaMm2), note: "Both legs, through the centre of the opening." },
      embedMm: a.embedMm,
    };
  }
  return { kind: a.kind, method: "none" };
}
