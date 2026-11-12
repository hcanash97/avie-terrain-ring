import { useState, type FormEvent } from "react";
import { PRESET_PLACES, useTerrainStore } from "../state/terrainStore";
import { searchPlaces, type SearchResult } from "../three/heightmap-loader";
import { MapPicker } from "./MapPicker";
import { track } from "../lib/analytics";

export function StepLocation() {
  const { place, bearingDeg, satellite, mapFailed, set } = useTerrainStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    track("location_search_started", { queryLength: query.length });
    try {
      const found = await searchPlaces(query.trim());
      setResults(found);
      if (!found.length) setError("No places found. Try a nearby town or landmark.");
    } catch {
      setError("Search isn’t available right now. Try a preset or move the map.");
    } finally {
      setSearching(false);
    }
  };

  const choose = (name: string, lat: number, lon: number, lengthM = place.lengthM) => {
    set({ place: { name, lat, lon, lengthM } });
    setResults([]);
    track("location_selected", { name });
  };

  const rotate = (delta: number) => set({ bearingDeg: (bearingDeg + delta + 360) % 360 });

  return (
    <div className="stack">
      <p className="intro">
        Choose a mountain, coastline or valley that matters to you. Its real elevation becomes the
        face of a made-to-order signet. <strong>There’s no obligation.</strong>
      </p>
      <form className="search" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a place"
          aria-label="Search for a place"
        />
        <button type="submit" className="btn-secondary" disabled={searching}>{searching ? "Searching…" : "Search"}</button>
      </form>
      {results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button onClick={() => choose(r.name, r.lat, r.lon)}>{r.name}</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="field-error">{error}</p>}
      <div className="chips">
        {PRESET_PLACES.map((p) => (
          <button key={p.name} className={place.name === p.name ? "on" : ""} onClick={() => choose(p.name, p.lat, p.lon, p.lengthM)}>
            {p.name}
          </button>
        ))}
      </div>
      <MapPicker />
      {!mapFailed && <div className="map-tools">
        <div className="rotate">
          <button onClick={() => rotate(-15)} aria-label="Rotate frame anticlockwise">↺</button>
          <span className="num">{Math.round(bearingDeg)}°</span>
          <button onClick={() => rotate(15)} aria-label="Rotate frame clockwise">↻</button>
          {bearingDeg !== 0 && <button className="link" onClick={() => set({ bearingDeg: 0 })}>Reset to north</button>}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={satellite} onChange={(e) => set({ satellite: e.target.checked })} />
          Satellite
        </label>
      </div>}
      <p className="hint">Move and zoom the map until the gold frame holds the landscape you want. The top of the frame points towards your fingertip.</p>
    </div>
  );
}
