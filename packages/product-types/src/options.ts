import { productIdSchema, productSelectionSchema } from "@avie/shared-types";
/** Future catalogue entries have metadata but no accepted configuration options yet. */
export function parseProductOptions(productType: unknown, options: unknown) {
  const selection = productSelectionSchema.parse({
    productType: productIdSchema.parse(productType),
    options,
  });
  return selection;
}
