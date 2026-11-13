// Builds artifact/index.html: body content only (the host adds the document
// skeleton), with the bundle's CSS and JS inlined. Baked terrain stays as
// separate files fetched relatively. Build first with ARTIFACT=1 so the bundle
// is a single script (no lazily loaded chunks).
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
const html = readFileSync("dist/index.html", "utf8");
const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1];
const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/)[1];
const script = readFileSync(`dist/${js}`, "utf8").replace(/<\/script/gi, "<\\/script");
const style = readFileSync(`dist/${css}`, "utf8");
rmSync("artifact", { recursive: true, force: true });
mkdirSync("artifact", { recursive: true });
cpSync("dist/baked", "artifact/baked", { recursive: true });
writeFileSync("artifact/index.html", `<title>À Vie Terrain Ring</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Trirong:wght@300;400;500;600&display=swap">
<style>
html, body { height: 100%; background: #EFECEC; color: #585757; }
${style}
</style>
<nav class="review-switch" aria-label="Preview">
  <a href="#">Ring</a><a href="#pendant-preview">Pendant prototype (internal)</a>
</nav>
<style>
.review-switch { position: fixed; z-index: 50; left: 50%; top: 10px; transform: translateX(-50%); display: flex; gap: 2px; padding: 3px; background: #EFECEC; border: 1px solid #3F5147; border-radius: 999px; font: 500 13px/1 Inter, system-ui, sans-serif; }
.review-switch a { padding: 7px 12px; border-radius: 999px; color: #3F5147; text-decoration: none; }
.review-switch a[aria-current="page"] { background: #3F5147; color: #EFECEC; }
</style>
<script>
(() => {
  const mark = () => document.querySelectorAll(".review-switch a").forEach((a) => {
    const on = (a.getAttribute("href") === "#pendant-preview") === (location.hash === "#pendant-preview");
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  addEventListener("hashchange", mark);
  mark();
})();
</script>
<div id="root"></div>
<script type="module">
${script}
</script>
`);
console.log("artifact/index.html", (readFileSync("artifact/index.html").length / 1024).toFixed(0), "KB;", readdirSync("artifact/baked").length, "terrain files");
