import presets from "../data/presets.json";
import { create } from "zustand";
import type { Detail } from "../three/terrain-surface";

export type Place = { name: string; lat: number; lon: number; lengthM: number };

export const PRESET_PLACES: Place[] = presets;

type TerrainState = {
  place: Place;
  bearingDeg: number;
  terrainHeight: number;
  detail: Detail;
  dragging: boolean;
  satellite: boolean;
  /** Inspection mode: flat face (no terrain). */
  flat: boolean;
  /** Live map tiles failed to load. */
  mapFailed: boolean;
  /** Where the current terrain came from. */
  terrainOrigin: "live" | "saved" | "sample";
  set: (patch: Partial<Omit<TerrainState, "set">>) => void;
};

export const useTerrainStore = create<TerrainState>((set) => ({
  place: PRESET_PLACES[0]!,
  bearingDeg: 0,
  terrainHeight: 0.7,
  detail: "high",
  dragging: false,
  satellite: false,
  flat: false,
  mapFailed: false,
  terrainOrigin: "live",
  set: (patch) => set(patch)
}));
