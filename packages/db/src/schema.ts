import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
  unique,
  index,
  foreignKey,
  check,
  bigint,
} from "drizzle-orm/pg-core";
import * as e from "./enums";
import type {
  ConfigurationContent,
  TerrainParameters,
} from "@avie/shared-types";
const pk = () => uuid("id").defaultRandom().primaryKey();
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const hash = (name: string) => text(name).notNull();

export const shops = pgTable("shops", {
  id: pk(),
  domain: text("domain").notNull().unique(),
  createdAt: created(),
});
export const ownerSessions = pgTable(
  "owner_sessions",
  {
    id: pk(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id),
    tokenHash: hash("token_hash"),
    createdAt: created(),
  },
  (t) => [
    unique("owner_shop_id_uq").on(t.shopId, t.id),
    unique("owner_token_uq").on(t.tokenHash),
    check("owner_token_hash", sql`${t.tokenHash} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const productTypes = pgTable("product_types", {
  id: pk(),
  slug: e.productSlug("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  status: e.catalogueStatus("status").notNull(),
  supportsTerrainDesign: boolean("supports_terrain_design")
    .notNull()
    .default(true),
  requiresSize: boolean("requires_size").notNull(),
  supportsEngraving: boolean("supports_engraving").notNull(),
  supportsChain: boolean("supports_chain").notNull(),
  supportsMultipleLocations: boolean("supports_multiple_locations")
    .notNull()
    .default(false),
  options: jsonb("options_json").notNull(),
  createdAt: created(),
  updatedAt: updated(),
});
export const manufacturerProfileVersions = pgTable(
  "manufacturer_profile_versions",
  {
    id: pk(),
    profileKey: text("profile_key").notNull(),
    version: integer("version").notNull(),
    status: e.constraintStatus("status").notNull().default("provisional"),
    rules: jsonb("rules_json").notNull(),
    checksum: hash("checksum"),
    createdAt: created(),
  },
  (t) => [
    unique("manufacturer_version_uq").on(t.profileKey, t.version),
    check("manufacturer_version_positive", sql`${t.version}>0`),
    check("manufacturer_hash", sql`${t.checksum} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const productTypeConstraints = pgTable(
  "product_type_constraints",
  {
    id: pk(),
    productTypeId: uuid("product_type_id")
      .notNull()
      .references(() => productTypes.id),
    constraintVersion: integer("constraint_version").notNull(),
    profileKey: text("profile_key").notNull(),
    status: e.constraintStatus("status").notNull().default("provisional"),
    manufacturerProfileVersionId: uuid(
      "manufacturer_profile_version_id",
    ).references(() => manufacturerProfileVersions.id),
    minFaceWidthMm: doublePrecision("min_face_width_mm"),
    maxFaceWidthMm: doublePrecision("max_face_width_mm"),
    minFaceHeightMm: doublePrecision("min_face_height_mm"),
    maxFaceHeightMm: doublePrecision("max_face_height_mm"),
    minWallThicknessMm: doublePrecision("min_wall_thickness_mm"),
    minFeatureWidthMm: doublePrecision("min_feature_width_mm"),
    maxReliefMm: doublePrecision("max_relief_mm"),
    maxVolumeCm3: doublePrecision("max_volume_cm3"),
    allowedMaterials: jsonb("allowed_materials").notNull(),
    allowedFinishes: jsonb("allowed_finishes").notNull(),
    allowedFaceShapes: jsonb("allowed_face_shapes").notNull(),
    allowedAttachmentTypes: jsonb("allowed_attachment_types").notNull(),
    validationRules: jsonb("validation_rules_json").notNull(),
    checksum: hash("checksum"),
    createdAt: created(),
  },
  (t) => [
    unique("constraint_version_uq").on(
      t.productTypeId,
      t.profileKey,
      t.constraintVersion,
    ),
    unique("constraint_product_uq").on(t.id, t.productTypeId),
    index("constraint_type_idx").on(t.productTypeId),
    index("constraint_manufacturer_idx").on(t.manufacturerProfileVersionId),
    check("constraint_version_positive", sql`${t.constraintVersion}>0`),
    check("constraint_hash", sql`${t.checksum} ~ '^[a-f0-9]{64}$'`),
    check(
      "constraint_dimensions",
      sql`(${t.minFaceWidthMm} IS NULL OR ${t.minFaceWidthMm}>0) AND (${t.maxFaceWidthMm} IS NULL OR ${t.maxFaceWidthMm}>0) AND (${t.minFaceHeightMm} IS NULL OR ${t.minFaceHeightMm}>0) AND (${t.maxFaceHeightMm} IS NULL OR ${t.maxFaceHeightMm}>0) AND (${t.minFaceWidthMm} IS NULL OR ${t.maxFaceWidthMm} IS NULL OR ${t.minFaceWidthMm}<=${t.maxFaceWidthMm}) AND (${t.minFaceHeightMm} IS NULL OR ${t.maxFaceHeightMm} IS NULL OR ${t.minFaceHeightMm}<=${t.maxFaceHeightMm})`,
    ),
    check(
      "constraint_thickness",
      sql`(${t.minWallThicknessMm} IS NULL OR ${t.minWallThicknessMm}>0) AND (${t.minFeatureWidthMm} IS NULL OR ${t.minFeatureWidthMm}>0) AND (${t.maxReliefMm} IS NULL OR ${t.maxReliefMm}>0) AND (${t.maxVolumeCm3} IS NULL OR ${t.maxVolumeCm3}>0)`,
    ),
  ],
);

export const terrainDesigns = pgTable(
  "terrain_designs",
  {
    id: pk(),
    publicId: text("public_id").notNull().unique(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id),
    ownerSessionId: uuid("owner_session_id").notNull(),
    status: e.terrainStatus("status").notNull().default("draft"),
    currentVersionId: uuid("current_version_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    unique("terrain_owner_uq").on(t.id, t.shopId, t.ownerSessionId),
    foreignKey({
      name: "terrain_owner_fk",
      columns: [t.shopId, t.ownerSessionId],
      foreignColumns: [ownerSessions.shopId, ownerSessions.id],
    }),
    index("terrain_owner_created_idx").on(
      t.shopId,
      t.ownerSessionId,
      t.createdAt,
    ),
  ],
);
export const terrainDesignVersions = pgTable(
  "terrain_design_versions",
  {
    id: pk(),
    terrainDesignId: uuid("terrain_design_id")
      .notNull()
      .references(() => terrainDesigns.id),
    version: integer("version").notNull(),
    parameters: jsonb("parameters_json").$type<TerrainParameters>().notNull(),
    heightmapKey: text("heightmap_key").notNull(),
    heightmapChecksum: hash("heightmap_checksum"),
    terrainVersion: text("terrain_version").notNull(),
    checksum: hash("checksum"),
    signature: text("signature"),
    keyId: text("key_id"),
    createdAt: created(),
  },
  (t) => [
    unique("terrain_version_uq").on(t.terrainDesignId, t.version),
    unique("terrain_version_parent_uq").on(t.id, t.terrainDesignId),
    check("terrain_version_positive", sql`${t.version}>0`),
    check(
      "terrain_checksums",
      sql`${t.checksum} ~ '^[a-f0-9]{64}$' AND ${t.heightmapChecksum} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "terrain_signature_pair",
      sql`(${t.signature} IS NULL AND ${t.keyId} IS NULL) OR (${t.signature} IS NOT NULL AND ${t.signature} ~ '^[a-f0-9]{64}$' AND ${t.keyId} IS NOT NULL)`,
    ),
  ],
);
export const productConfigurations = pgTable(
  "product_configurations",
  {
    id: pk(),
    publicId: text("public_id").notNull().unique(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id),
    ownerSessionId: uuid("owner_session_id").notNull(),
    terrainDesignId: uuid("terrain_design_id").notNull(),
    productTypeId: uuid("product_type_id")
      .notNull()
      .references(() => productTypes.id),
    status: e.configurationStatus("status").notNull().default("draft"),
    currentVersionId: uuid("current_version_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    unique("config_parent_scope_uq").on(
      t.id,
      t.productTypeId,
      t.terrainDesignId,
    ),
    unique("config_shop_uq").on(t.id, t.shopId),
    foreignKey({
      name: "config_terrain_owner_fk",
      columns: [t.terrainDesignId, t.shopId, t.ownerSessionId],
      foreignColumns: [
        terrainDesigns.id,
        terrainDesigns.shopId,
        terrainDesigns.ownerSessionId,
      ],
    }),
    index("config_owner_created_idx").on(
      t.shopId,
      t.ownerSessionId,
      t.createdAt,
    ),
    index("config_type_idx").on(t.productTypeId),
    index("config_terrain_idx").on(t.terrainDesignId),
  ],
);
export const productConfigurationVersions = pgTable(
  "product_configuration_versions",
  {
    id: pk(),
    productConfigurationId: uuid("product_configuration_id").notNull(),
    shopId: uuid("shop_id").notNull(),
    productTypeId: uuid("product_type_id").notNull(),
    terrainDesignId: uuid("terrain_design_id").notNull(),
    terrainDesignVersionId: uuid("terrain_design_version_id").notNull(),
    constraintVersionId: uuid("constraint_version_id").notNull(),
    version: integer("version").notNull(),
    configuration: jsonb("configuration_json")
      .$type<ConfigurationContent>()
      .notNull(),
    geometryVersion: text("geometry_version").notNull(),
    material: e.metal("material").notNull(),
    finish: e.finish("finish").notNull(),
    checksum: hash("checksum"),
    signature: text("signature"),
    keyId: text("key_id"),
    createdAt: created(),
  },
  (t) => [
    unique("config_version_uq").on(t.productConfigurationId, t.version),
    unique("config_version_parent_uq").on(t.id, t.productConfigurationId),
    unique("config_version_shop_uq").on(
      t.id,
      t.productConfigurationId,
      t.shopId,
    ),
    unique("config_provenance_uq").on(
      t.id,
      t.terrainDesignVersionId,
      t.constraintVersionId,
      t.productTypeId,
      t.geometryVersion,
      t.checksum,
    ),
    foreignKey({
      name: "config_version_parent_fk",
      columns: [t.productConfigurationId, t.productTypeId, t.terrainDesignId],
      foreignColumns: [
        productConfigurations.id,
        productConfigurations.productTypeId,
        productConfigurations.terrainDesignId,
      ],
    }),
    foreignKey({
      name: "config_version_shop_fk",
      columns: [t.productConfigurationId, t.shopId],
      foreignColumns: [productConfigurations.id, productConfigurations.shopId],
    }),
    foreignKey({
      name: "config_version_terrain_fk",
      columns: [t.terrainDesignVersionId, t.terrainDesignId],
      foreignColumns: [
        terrainDesignVersions.id,
        terrainDesignVersions.terrainDesignId,
      ],
    }),
    foreignKey({
      name: "config_version_constraint_fk",
      columns: [t.constraintVersionId, t.productTypeId],
      foreignColumns: [
        productTypeConstraints.id,
        productTypeConstraints.productTypeId,
      ],
    }),
    index("config_version_terrain_idx").on(t.terrainDesignVersionId),
    index("config_version_constraint_idx").on(t.constraintVersionId),
    check("config_version_positive", sql`${t.version}>0`),
    check("config_hash", sql`${t.checksum} ~ '^[a-f0-9]{64}$'`),
    check(
      "config_signature_pair",
      sql`(${t.signature} IS NULL AND ${t.keyId} IS NULL) OR (${t.signature} IS NOT NULL AND ${t.signature} ~ '^[a-f0-9]{64}$' AND ${t.keyId} IS NOT NULL)`,
    ),
  ],
);
export const productArtefacts = pgTable(
  "product_artefacts",
  {
    kind: e.artefactKind("kind").notNull(),
    id: pk(),
    configurationVersionId: uuid("configuration_version_id").notNull(),
    terrainVersionId: uuid("terrain_version_id").notNull(),
    constraintVersionId: uuid("constraint_version_id").notNull(),
    productTypeId: uuid("product_type_id").notNull(),
    geometryVersion: text("geometry_version").notNull(),
    configurationHash: hash("configuration_hash"),
    format: e.artefactFormat("format").notNull(),
    purpose: e.artefactPurpose("purpose").notNull(),
    status: e.artefactStatus("status").notNull(),
    objectKey: text("object_key").notNull(),
    checksum: hash("checksum"),
    byteLength: bigint("byte_length", { mode: "number" }).notNull(),
    createdAt: created(),
  },
  (t) => [
    unique("artefact_config_uq").on(t.id, t.configurationVersionId),
    foreignKey({
      name: "artefact_provenance_fk",
      columns: [
        t.configurationVersionId,
        t.terrainVersionId,
        t.constraintVersionId,
        t.productTypeId,
        t.geometryVersion,
        t.configurationHash,
      ],
      foreignColumns: [
        productConfigurationVersions.id,
        productConfigurationVersions.terrainDesignVersionId,
        productConfigurationVersions.constraintVersionId,
        productConfigurationVersions.productTypeId,
        productConfigurationVersions.geometryVersion,
        productConfigurationVersions.checksum,
      ],
    }),
    index("artefact_config_purpose_idx").on(
      t.configurationVersionId,
      t.purpose,
    ),
    check("artefact_hash", sql`${t.checksum} ~ '^[a-f0-9]{64}$'`),
    check("artefact_bytes", sql`${t.byteLength}>0`),
  ],
);
export const priceQuotes = pgTable(
  "price_quotes",
  {
    id: pk(),
    configurationVersionId: uuid("configuration_version_id")
      .notNull()
      .references(() => productConfigurationVersions.id),
    status: e.quoteStatus("status").notNull().default("provisional"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    quantity: integer("quantity").notNull(),
    ruleVersion: text("rule_version").notNull(),
    costVersion: text("cost_version").notNull(),
    variantGid: text("variant_gid"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [
    index("quote_configuration_expiry_idx").on(
      t.configurationVersionId,
      t.expiresAt,
    ),
    check(
      "quote_amount",
      sql`${t.amountMinor}>=0 AND ${t.amountMinor}<=9007199254740991 AND ${t.quantity}>0 AND ${t.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);
export const productionJobs = pgTable(
  "production_jobs",
  {
    id: pk(),
    configurationId: uuid("configuration_id").notNull(),
    configurationVersionId: uuid("configuration_version_id").notNull(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id),
    orderGid: text("order_gid").notNull(),
    lineItemGid: text("line_item_gid").notNull(),
    shopifyOrderNumber: text("shopify_order_number").notNull(),
    quantity: integer("quantity").notNull(),
    status: e.jobStatus("status").notNull().default("awaiting_input"),
    priority: integer("priority").notNull().default(0),
    manufacturerProfileVersionId: uuid("manufacturer_profile_version_id")
      .notNull()
      .references(() => manufacturerProfileVersions.id),
    packetArtefactId: uuid("packet_artefact_id").references(
      () => productArtefacts.id,
    ),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    foreignKey({
      name: "job_packet_revision_fk",
      columns: [t.packetArtefactId, t.configurationVersionId],
      foreignColumns: [
        productArtefacts.id,
        productArtefacts.configurationVersionId,
      ],
    }),
    foreignKey({
      name: "job_config_shop_fk",
      columns: [t.configurationVersionId, t.configurationId, t.shopId],
      foreignColumns: [
        productConfigurationVersions.id,
        productConfigurationVersions.productConfigurationId,
        productConfigurationVersions.shopId,
      ],
    }),
    unique("job_order_line_revision_uq").on(
      t.shopId,
      t.orderGid,
      t.lineItemGid,
      t.configurationVersionId,
      t.manufacturerProfileVersionId,
    ),
    index("job_queue_idx").on(t.status, t.priority, t.createdAt),
    index("job_manufacturer_idx").on(t.manufacturerProfileVersionId),
    index("job_config_idx").on(t.configurationVersionId),
    check("job_counts", sql`${t.quantity}>0 AND ${t.attempts}>=0`),
  ],
);
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: pk(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id),
    eventId: text("event_id").notNull(),
    topic: text("topic").notNull(),
    bodyChecksum: hash("body_checksum"),
    status: e.eventStatus("status").notNull().default("received"),
    createdAt: created(),
  },
  (t) => [
    unique("webhook_event_uq").on(t.shopId, t.eventId),
    check("webhook_hash", sql`${t.bodyChecksum} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const jobOutbox = pgTable(
  "job_outbox",
  {
    id: pk(),
    productionJobId: uuid("production_job_id")
      .notNull()
      .references(() => productionJobs.id),
    status: e.outboxStatus("status").notNull().default("pending"),
    createdAt: created(),
  },
  (t) => [
    unique("outbox_job_uq").on(t.productionJobId),
    index("outbox_status_idx").on(t.status, t.createdAt),
  ],
);
export const designApprovals = pgTable(
  "design_approvals",
  {
    id: pk(),
    configurationVersionId: uuid("configuration_version_id")
      .notNull()
      .references(() => productConfigurationVersions.id),
    ownerSessionId: uuid("owner_session_id")
      .notNull()
      .references(() => ownerSessions.id),
    configurationHash: hash("configuration_hash"),
    createdAt: created(),
  },
  (t) => [
    index("approval_configuration_idx").on(t.configurationVersionId),
    check("approval_hash", sql`${t.configurationHash} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const productionReleaseApprovals = pgTable(
  "production_release_approvals",
  {
    id: pk(),
    productionJobId: uuid("production_job_id")
      .notNull()
      .references(() => productionJobs.id),
    approverReference: text("approver_reference").notNull(),
    packetChecksum: hash("packet_checksum"),
    createdAt: created(),
  },
  (t) => [
    index("release_job_idx").on(t.productionJobId),
    check("release_hash", sql`${t.packetChecksum} ~ '^[a-f0-9]{64}$'`),
  ],
);

export * from "./enums";
