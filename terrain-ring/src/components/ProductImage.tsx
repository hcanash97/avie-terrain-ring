/** Static illustrations generated from our own preview meshes; never a finished-product photo. */
export function ProductImage({ name }: { name: string }) {
  return <img className="product-image" src={`${import.meta.env.BASE_URL}products/${name}.png`} alt="" loading="lazy" />;
}
