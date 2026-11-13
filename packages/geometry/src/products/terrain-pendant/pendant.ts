/** One entry point: body + attachment as a single solid, with its dimensions. */
import { createPendantBody, signedVolume, type PendantBodyParameters } from "./body";
import { finishPendant, type FinishedPendant, type PendantAttachment } from "./attachments";

export type PendantParameters = PendantBodyParameters & { attachment: PendantAttachment; attachmentSegments?: number };

export async function createPendant(p: PendantParameters): Promise<FinishedPendant & { dimensions: ReturnType<typeof dimensionsOf> }> {
  const body = createPendantBody(p);
  const finished = await finishPendant(body, p.outline, p.baseThicknessMm, p.attachment, p.attachmentSegments);
  return { ...finished, dimensions: dimensionsOf(finished.mesh, p) };
}

/** Body dimensions come from the outline; overall dimensions include the attachment. */
export function dimensionsOf(m: { positions: Float32Array; indices: Uint32Array }, p: PendantBodyParameters) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, m.positions[i + k]!); max[k] = Math.max(max[k]!, m.positions[i + k]!); }
  let bodyDepth = 0;
  for (let i = 0; i < m.positions.length; i += 3)
    if (Math.abs(m.positions[i]!) <= p.outline.widthMm / 2 && Math.abs(m.positions[i + 2]!) <= p.outline.heightMm / 2) bodyDepth = Math.max(bodyDepth, m.positions[i + 1]!);
  const r3 = (x: number) => +x.toFixed(3);
  return {
    body: { widthMm: p.outline.widthMm, heightMm: p.outline.heightMm, cornerRadiusMm: p.outline.cornerRadiusMm, depthMm: r3(bodyDepth), baseThicknessMm: p.baseThicknessMm, note: "Body excludes any attachment above the top edge." },
    overall: { widthMm: r3(max[0]! - min[0]!), heightMm: r3(max[2]! - min[2]!), depthMm: r3(max[1]! - min[1]!) },
    volumeMm3: r3(signedVolume(m)),
  };
}
