// Dev-page helpers for look tuning: fixed-camera renders plus pixel statistics.
window.__lookTools = {
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  async stats(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const lum = [];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 255) continue; // ring pixels only (shadow and background are translucent)
      lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    }
    lum.sort((a, b) => a - b);
    const q = (p) => Math.round(lum[Math.floor(p * (lum.length - 1))]);
    const pct = (f) => +((100 * lum.filter(f).length) / lum.length).toFixed(1);
    return { clippedPct: pct((v) => v >= 250), crushedPct: pct((v) => v <= 30), p5: q(0.05), p50: q(0.5), p95: q(0.95) };
  },
  async shoot(name, views = ["three_quarter", "side", "front"]) {
    const out = {};
    for (const v of views) {
      const url = window.__ringCapture(v);
      await fetch(`/__capture?name=${name}_${v}`, { method: "POST", body: url });
      out[v] = "saved"; // statistics: node scripts/look-stats.mjs <name>
    }
    return out;
  },
  async setup({ metal = "gold_18ct", finish = "polished", place = 0, weight = "standard", headShape = "bar" } = {}) {
    const S = window.__stores;
    S.ring.getState().set({ clay: false, metal, finish, weight, headShape, ringSize: "N", shoulder: "classic", profile: "classic" });
    S.terrain.getState().set({ flat: false, place: S.presets[place], bearingDeg: 0, terrainHeight: 0.7, detail: "high" });
    await this.wait(4000);
  }
};
