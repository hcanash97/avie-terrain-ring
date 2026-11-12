import { create } from "zustand";
import type { Finish, Metal } from "../three/materials";
import type { BandProfile, HeadShape, ShoulderStyle, Weight } from "../geometry/ring-blank";

type RingState = {
  metal: Metal;
  finish: Finish;
  weight: Weight;
  headShape: HeadShape;
  shoulder: ShoulderStyle;
  profile: BandProfile;
  /** null = "size later" */
  ringSize: string | null;
  /** Inspection mode: neutral clay instead of metal. */
  clay: boolean;
  set: (patch: Partial<Omit<RingState, "set">>) => void;
};

export const useRingStore = create<RingState>((set) => ({
  metal: "gold_9ct",
  finish: "polished",
  weight: "standard",
  headShape: "bar",
  shoulder: "classic",
  profile: "classic",
  ringSize: null,
  clay: false,
  set: (patch) => set(patch)
}));
