// Paste into the dev page console (or run via the browser tool). Saves fixed-camera
// renders to ../captures via the dev-only /__capture endpoint.
window.__shootSet = async (prefix) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const S = window.__stores;
  const save = async (name, view) =>
    fetch(`/__capture?name=${name}`, { method: "POST", body: window.__ringCapture(view) });
  const done = [];
  const views = ["three_quarter", "front", "side", "top"];
  // Blank: clay, flat face, every face size at three finger sizes.
  S.ring.getState().set({ clay: true, shoulder: "classic", profile: "classic", finish: "polished" });
  S.terrain.getState().set({ flat: true, place: S.presets[0], bearingDeg: 0, terrainHeight: 0.7, detail: "high" });
  S.ring.getState().set({ headShape: "bar" });
  for (const weight of ["slim", "standard", "bold"]) {
    for (const size of ["H½", "N", "Y"]) {
      S.ring.getState().set({ weight, ringSize: size });
      await wait(900);
      for (const v of views) { const n = `${prefix}_blank_${weight}_${size.replace("½", "h")}_${v}`; await save(n, v); done.push(n); }
    }
  }
  // Cushion head, size N (no "before" exists for this shape).
  S.ring.getState().set({ headShape: "cushion", ringSize: "N" });
  for (const weight of ["slim", "standard", "bold"]) {
    S.ring.getState().set({ weight });
    await wait(900);
    for (const v of views) { const n = `${prefix}_cushion_${weight}_N_${v}`; await save(n, v); done.push(n); }
  }
  S.ring.getState().set({ headShape: "bar" });
  // Gold with real terrain (Snowdon), size N.
  S.ring.getState().set({ clay: false, metal: "gold_18ct", ringSize: "N" });
  S.terrain.getState().set({ flat: false });
  for (const weight of ["slim", "standard", "bold"]) {
    S.ring.getState().set({ weight });
    await wait(2500);
    for (const v of views) { const n = `${prefix}_gold_${weight}_N_${v}`; await save(n, v); done.push(n); }
  }
  return done.length;
};
