import { useEffect, useState, type FormEvent } from "react";
import { PRESET_PLACES, useTerrainStore } from "../state/terrainStore";
import { searchPlaces, type SearchResult } from "../three/heightmap-loader";
import { MapPicker } from "./MapPicker";
import { withTimeout } from "../lib/withTimeout";
import { track } from "../lib/analytics";

export function StepLocation() {
  const { place, bearingDeg, satellite, mapFailed, set } = useTerrainStore();
  const [areaKm, setAreaKm] = useState(String(place.lengthM / 1000));
  useEffect(() => setAreaKm(String(Number((place.lengthM / 1000).toFixed(1)))), [place.lengthM]);
  const validArea = Number.isFinite(Number(areaKm)) && Number(areaKm) >= 0.2 && Number(areaKm) <= 100;
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
      const found = await withTimeout(searchPlaces(query.trim()), 12000);
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
        Start with a place that matters. Search for a location or try one of our favourite landscapes.
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
      {error && <p className="field-error" role="status">{error}</p>}
      <div className="chips" aria-label="Suggested places">
        {PRESET_PLACES.map((p) => (
          <button key={p.name} aria-pressed={place.name === p.name} className={place.name === p.name ? "on" : ""} onClick={() => choose(p.name, p.lat, p.lon, p.lengthM)}>
            {p.name}
          </button>
        ))}
      </div>
      <MapPicker />
      <div className="map-tools">
        <div className="rotate">
          <button onClick={() => rotate(-15)} aria-label="Rotate frame anticlockwise">↺</button>
          <span className="num">{Math.round(bearingDeg)}°</span>
          <button onClick={() => rotate(15)} aria-label="Rotate frame clockwise">↻</button>
          {bearingDeg !== 0 && <button className="link" onClick={() => set({ bearingDeg: 0 })}>Reset to north</button>}
        </div>
        {!mapFailed && <label className="toggle">
          <input type="checkbox" checked={satellite} onChange={(e) => set({ satellite: e.target.checked })} />
          Satellite
        </label>}
      </div>
      <label className="select">Area across the face (km)
        <input type="number" min="0.2" max="100" step="0.1" value={areaKm} aria-invalid={!validArea} aria-describedby="area-help"
          onChange={(e) => setAreaKm(e.target.value)} onBlur={() => { if (validArea) set({ place: { ...place, lengthM: Number(areaKm) * 1000 } }); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      </label>
      <p id="area-help" className={validArea ? "hint" : "field-error"}>Enter 0.2–100 km. Press Enter or leave the field to apply.</p>
      <p className="hint">Move and zoom the map until the gold frame holds the landscape you want. The top of the frame points towards your fingertip.</p>
    </div>
  );
}
