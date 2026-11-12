import { create } from "zustand";
import type { Detail } from "../three/terrain-surface";

export type Place = { name: string; lat: number; lon: number; lengthM: number };

export const PRESET_PLACES: Place[] = [
  { name: "Snowdon, GB", lat: 53.0685, lon: -4.0763, lengthM: 6000 },
  { name: "Ben Nevis, GB", lat: 56.7969, lon: -5.0036, lengthM: 7000 },
  { name: "Matterhorn, CH", lat: 45.9763, lon: 7.6586, lengthM: 6000 },
  { name: "Table Mountain, ZA", lat: -33.9628, lon: 18.4098, lengthM: 8000 },
  { name: "Mount Fuji, JP", lat: 35.3606, lon: 138.7274, lengthM: 20000 },
  { name: "Grand Canyon, US", lat: 36.0997, lon: -112.1124, lengthM: 16000 },
  { name: "Lake District, GB", lat: 54.46, lon: -3.09, lengthM: 18000 }
];

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
