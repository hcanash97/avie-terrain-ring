import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTerrainStore } from "../state/terrainStore";
import { useRingStore } from "../state/ringStore";
import { facePreset } from "../geometry/ring-blank";

import { metresPerPixel, zoomForFrame } from "../geometry/map-scale";
const FRAME_FRACTION = 0.62; // frame width as a share of the map width

const LAYERS = {
  map: () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: "© OpenStreetMap contributors"
  }),
  satellite: () => L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 17, attribution: "Imagery © Esri" }
  )
};

/**
 * Leaflet map with a fixed frame in the middle. The frame's aspect matches the
 * ring face and it rotates with the chosen bearing; whatever sits inside it
 * becomes the landscape on the ring.
 */
export function MapPicker() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const programmatic = useRef(false);
  const layerRef = useRef<L.TileLayer | null>(null);
  const tilesFailed = useTerrainStore((s) => s.mapFailed);
  const setTilesFailed = (mapFailed: boolean) => useTerrainStore.getState().set({ mapFailed });
  const [attempt, setAttempt] = useState(0);
  const { place, bearingDeg, satellite, set } = useTerrainStore();
  const weight = useRingStore((s) => s.weight);
  const headShape = useRingStore((s) => s.headShape);
  const preset = facePreset(weight, headShape);

  const frameWidthPx = () => (mapEl.current?.clientWidth ?? 400) * FRAME_FRACTION;
  const zoomFor = (lat: number, lengthM: number) =>
    zoomForFrame(lat, lengthM, frameWidthPx());

  useEffect(() => {
    if (!mapEl.current) return;
    const map = L.map(mapEl.current, { zoomSnap: 0, zoomDelta: 0.5, attributionControl: true, trackResize: false });
    map.setView([place.lat, place.lon], zoomFor(place.lat, place.lengthM));
    map.on("moveend", () => {
      if (programmatic.current) return;
      const c = map.getCenter();
      const lengthM = frameWidthPx() * metresPerPixel(c.lat, map.getZoom());
      const current = useTerrainStore.getState().place;
      const moved = Math.hypot(c.lat - current.lat, c.lng - current.lon) * 111000;
      const resized = Math.abs(lengthM - current.lengthM) / current.lengthM;
      if (moved < current.lengthM * 0.01 && resized < 0.01) return; // our own setView
      set({ place: { name: moved > current.lengthM * 0.5 ? "Custom area" : current.name, lat: c.lat, lon: c.lng, lengthM } });
    });
    mapRef.current = map;
    // Layout resizing must retain geographic extent instead of sampling a
    // different landscape at the old pixel zoom. Own resize handling avoids
    // Leaflet emitting a user-like moveend before the frame is recalibrated.
    const observer = new ResizeObserver(() => {
      const current = useTerrainStore.getState().place;
      programmatic.current = true;
      try {
        map.invalidateSize({ pan: false });
        map.setView([current.lat, current.lon], zoomFor(current.lat, current.lengthM), { animate: false });
      } finally { programmatic.current = false; }
    });
    observer.observe(mapEl.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External changes (presets, search) move the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const lengthNow = frameWidthPx() * metresPerPixel(c.lat, map.getZoom());
    const moved = Math.hypot(c.lat - place.lat, c.lng - place.lon) * 111000;
    if (moved > place.lengthM * 0.01 || Math.abs(lengthNow - place.lengthM) / place.lengthM > 0.01) {
      programmatic.current = true;
      try { map.setView([place.lat, place.lon], zoomFor(place.lat, place.lengthM), { animate: false }); }
      finally { programmatic.current = false; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current?.remove();
    const layer = LAYERS[satellite ? "satellite" : "map"]();
    let failures = 0;
    layer.on("tileerror", () => { if (++failures >= 3) setTilesFailed(true); });
    layer.on("tileload", () => setTilesFailed(false));
    layerRef.current = layer.addTo(map);
  }, [satellite, attempt]);

  return (
    <div className="map-wrap">
      <div ref={mapEl} className="map" />
      <div
        className="frame"
        style={{
          width: `${FRAME_FRACTION * 100}%`,
          aspectRatio: `${preset.faceLengthMm} / ${preset.faceWidthMm}`,
          transform: `translate(-50%, -50%) rotate(${bearingDeg}deg)`
        }}
        aria-hidden
      >
        <span className="frame-top">▲</span>
      </div>
      {tilesFailed && (
        <div className="map-offline" role="alert">
          <p>The map couldn’t load here. You can still choose one of the places above, which use saved terrain.</p>
          <button className="btn-secondary" onClick={() => { setTilesFailed(false); setAttempt((n) => n + 1); }}>Retry map</button>
        </div>
      )}
    </div>
  );
}
