import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// #blank opens the shape-inspection view: flat face, neutral clay.
if (location.hash === "#blank") {
  void Promise.all([import("./state/ringStore"), import("./state/terrainStore")]).then(([r, t]) => {
    r.useRingStore.getState().set({ clay: true });
    t.useTerrainStore.getState().set({ flat: true });
  });
}

if (import.meta.env.DEV) {
  // Dev-only handles so comparison renders can set an exact configuration.
  void Promise.all([import("./state/ringStore"), import("./state/terrainStore")]).then(([r, t]) => {
    (window as unknown as Record<string, unknown>).__stores = { ring: r.useRingStore, terrain: t.useTerrainStore, presets: t.PRESET_PLACES };
    void import("./three/terrain-surface").then((m) => ((window as unknown as Record<string, unknown>).__detail = m.DETAIL));
    void import("./three/environment").then((m) => ((window as unknown as Record<string, unknown>).__studioDefault = m.DEFAULT_STUDIO));
  });
}
