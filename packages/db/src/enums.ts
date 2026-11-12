import { pgEnum } from "drizzle-orm/pg-core";
export const terrainStatus = pgEnum("terrain_status", [
  "draft",
  "ready",
  "archived",
]);
export const configurationStatus = pgEnum("configuration_status", [
  "draft",
  "preview_ready",
  "quote_pending",
  "quoted",
  "approved",
  "ordered",
  "archived",
]);
export const catalogueStatus = pgEnum("catalogue_status", [
  "active",
  "planned",
  "future",
  "retired",
]);
export const constraintStatus = pgEnum("constraint_status", [
  "provisional",
  "approved",
  "retired",
]);
export const artefactStatus = pgEnum("artefact_status", [
  "generating",
  "ready",
  "failed",
  "superseded",
]);
export const artefactPurpose = pgEnum("artefact_purpose", [
  "preview",
  "review_sample",
  "production",
]);
export const artefactFormat = pgEnum("artefact_format", [
  "stl",
  "3dm",
  "pdf",
  "json",
  "png",
]);
export const jobStatus = pgEnum("job_status", [
  "awaiting_input",
  "queued",
  "generating",
  "validation_failed",
  "export_failed",
  "awaiting_review",
  "released",
  "cancelled",
  "superseded",
]);
export const quoteStatus = pgEnum("quote_status", [
  "provisional",
  "approved",
  "expired",
  "revoked",
]);
export const eventStatus = pgEnum("event_status", [
  "received",
  "processed",
  "failed",
]);
export const outboxStatus = pgEnum("outbox_status", [
  "pending",
  "dispatched",
  "failed",
]);
export const productSlug = pgEnum("product_slug", [
  "terrain_ring",
  "terrain_pendant",
  "terrain_signet",
  "terrain_cufflinks",
  "terrain_charm",
  "terrain_tie_bar",
  "terrain_bracelet",
  "terrain_locket",
  "terrain_object",
]);
export const metal = pgEnum("metal", [
  "silver_925",
  "gold_9ct",
  "gold_14ct",
  "gold_18ct",
  "platinum_950",
]);
export const finish = pgEnum("finish", ["polished", "satin"]);

export const artefactKind = pgEnum("artefact_kind", [
  "mesh",
  "production_spec",
  "validation_report",
  "checksum_manifest",
  "render_front",
  "render_side",
  "render_three_quarter",
  "design_snapshot",
  "heightmap_metadata",
]);
