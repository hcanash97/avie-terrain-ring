import { ProductImage } from "./ProductImage";
export function Collection() {
  const review = import.meta.env.DEV || import.meta.env.VITE_INTERNAL_REVIEW === "true";
  return <details className="collection refine">
    <summary>Explore the Terra collection</summary>
    <div className="collection-cards">
      <article className="collection-card selected"><ProductImage name="ring-bar-standard" /><div><span className="status-tag">Your piece</span><h3>Terra Ring</h3><p>A landscape integrated into a sculptural signet.</p></div></article>
      <article className="collection-card"><ProductImage name="pendant-tablet_slider" /><div><span className="status-tag">In development</span><h3>Terra Pendant</h3><p>A landscape to carry close. Prototype only; unavailable to order.</p>{review && <a href="#pendant-preview">Open internal preview →</a>}</div></article>
    </div>
    <p className="hint">Style illustrations use our preview geometry. Your chosen landscape appears in the large 3D view.</p>
  </details>;
}
