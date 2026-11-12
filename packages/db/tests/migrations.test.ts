import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as s from "../src/schema";
import { constraints } from "../../product-types/src/constraints";
import { configureProduct } from "../../product-types/src/server";
import { canonicalJSON, sha256 } from "../../shared-types/src/server";
import { id, identity, ring, terrain } from "../../shared-types/tests/fixtures";
const client = new PGlite();
const db = drizzle(client, { schema: s });
const snapshot = terrain(),
  configuration = configureProduct(ring, snapshot, identity);
const configRow = {
  id: configuration.id,
  productConfigurationId: configuration.configurationId,
  shopId: identity.shopId,
  productTypeId: id(20),
  terrainDesignId: snapshot.designId,
  terrainDesignVersionId: snapshot.id,
  constraintVersionId: id(30),
  version: 1,
  configuration: configuration.content,
  geometryVersion: configuration.content.geometryVersion,
  material: "silver_925" as const,
  finish: "polished" as const,
  checksum: configuration.configurationHash,
};
const artefactRow = {
  kind: "validation_report" as const,
  id: id(50),
  configurationVersionId: configuration.id,
  terrainVersionId: snapshot.id,
  constraintVersionId: id(30),
  productTypeId: id(20),
  geometryVersion: configuration.content.geometryVersion,
  configurationHash: configuration.configurationHash,
  format: "json" as const,
  purpose: "review_sample" as const,
  status: "ready" as const,
  objectKey: "fixtures/diagnostic.json",
  checksum: "a".repeat(64),
  byteLength: 20,
};
const jobRow = {
  id: id(60),
  configurationId: configuration.configurationId,
  configurationVersionId: configuration.id,
  shopId: identity.shopId,
  orderGid: "gid://shopify/Order/test",
  lineItemGid: "gid://shopify/LineItem/test",
  shopifyOrderNumber: "TEST-ONLY",
  quantity: 1,
  manufacturerProfileVersionId: id(40),
  idempotencyKey: "fixture-job-1",
};
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
  await migrate(db, { migrationsFolder: "packages/db/drizzle" }); // repeat-safe migrator, not repeat SQL execution
  await db
    .insert(s.shops)
    .values({ id: identity.shopId, domain: "fixture.invalid" });
  await db.insert(s.ownerSessions).values({
    id: identity.ownerSessionId,
    shopId: identity.shopId,
    tokenHash: "b".repeat(64),
  });
  await db.insert(s.productTypes).values({
    id: id(20),
    slug: "terrain_ring",
    displayName: "Terra Ring",
    description: "Fixture",
    status: "active",
    requiresSize: true,
    supportsEngraving: false,
    supportsChain: false,
    options: {},
  });
  await db.insert(s.productTypes).values({
    id: id(21),
    slug: "terrain_pendant",
    displayName: "Terra Pendant",
    description: "Fixture",
    status: "planned",
    requiresSize: false,
    supportsEngraving: false,
    supportsChain: true,
    options: {},
  });
  const profile = constraints.legacyRing;
  await db.insert(s.productTypeConstraints).values({
    id: id(30),
    productTypeId: id(20),
    constraintVersion: 1,
    profileKey: profile.id,
    allowedMaterials: profile.materials,
    allowedFinishes: profile.finishes,
    allowedFaceShapes: profile.shapes,
    allowedAttachmentTypes: profile.attachments,
    validationRules: profile,
    checksum: sha256(canonicalJSON(profile)),
  });
  await db.insert(s.terrainDesigns).values({
    id: snapshot.designId,
    publicId: "T-FIXTURE",
    shopId: identity.shopId,
    ownerSessionId: identity.ownerSessionId,
  });
  await db.insert(s.terrainDesignVersions).values({
    id: snapshot.id,
    terrainDesignId: snapshot.designId,
    version: 1,
    parameters: snapshot.parameters,
    heightmapKey: snapshot.parameters.heightmap.objectKey,
    heightmapChecksum: snapshot.parameters.heightmap.checksum,
    terrainVersion: snapshot.parameters.terrainAlgorithmVersion,
    checksum: snapshot.designHash,
  });
  await db.insert(s.productConfigurations).values({
    id: configuration.configurationId,
    publicId: "C-FIXTURE",
    shopId: identity.shopId,
    ownerSessionId: identity.ownerSessionId,
    terrainDesignId: snapshot.designId,
    productTypeId: id(20),
  });
  await db.insert(s.productConfigurationVersions).values(configRow);
  await db.insert(s.manufacturerProfileVersions).values({
    id: id(40),
    profileKey: "fixture-only",
    version: 1,
    rules: { releaseAllowed: false },
    checksum: "c".repeat(64),
  });
  await db.insert(s.productArtefacts).values(artefactRow);
});
afterAll(async () => {
  await client.close();
});
it("migrates genuine PostgreSQL enums and indexes locally", async () => {
  const tables = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  expect(tables.rows).toHaveLength(16);
  const indexes = await client.query(
    "SELECT indexname FROM pg_indexes WHERE indexname='job_queue_idx'",
  );
  expect(indexes.rows).toHaveLength(1);
  const invalid = await client.query(
    "SELECT enumlabel FROM pg_enum WHERE enumlabel='released'",
  );
  expect(invalid.rows).toHaveLength(1);
});
it("version and constraint records reject updates, deletes and truncate", async () => {
  for (const table of [
    "terrain_design_versions",
    "product_configuration_versions",
    "product_type_constraints",
    "manufacturer_profile_versions",
  ]) {
    await expect(
      client.exec(`UPDATE ${table} SET created_at=now()`),
    ).rejects.toThrow(/Immutable/);
    await expect(client.exec(`DELETE FROM ${table}`)).rejects.toThrow();
    await expect(client.exec(`TRUNCATE ${table} CASCADE`)).rejects.toThrow(
      /Immutable/,
    );
  }
});
it("appends versions without altering the old terrain and constrains current pointers", async () => {
  const previous = await db
    .select()
    .from(s.terrainDesignVersions)
    .where(eq(s.terrainDesignVersions.id, snapshot.id));
  await db.insert(s.terrainDesignVersions).values({
    id: id(3),
    terrainDesignId: snapshot.designId,
    version: 2,
    parameters: snapshot.parameters,
    heightmapKey: "fixture/v2.bin",
    heightmapChecksum: snapshot.parameters.heightmap.checksum,
    terrainVersion: "terrain/v1",
    checksum: snapshot.designHash,
  });
  await db
    .update(s.terrainDesigns)
    .set({ currentVersionId: id(3) })
    .where(eq(s.terrainDesigns.id, snapshot.designId));
  expect(
    (
      await db
        .select()
        .from(s.terrainDesignVersions)
        .where(eq(s.terrainDesignVersions.id, snapshot.id))
    )[0]!.checksum,
  ).toBe(previous[0]!.checksum);
  await expect(
    db
      .update(s.terrainDesigns)
      .set({ currentVersionId: id(999) })
      .where(eq(s.terrainDesigns.id, snapshot.designId)),
  ).rejects.toThrow();
  await expect(
    db.insert(s.terrainDesignVersions).values({ ...previous[0]!, id: id(4) }),
  ).rejects.toThrow();
});
it("rejects cross-owner and mismatched product/terrain/constraint provenance", async () => {
  await db
    .insert(s.ownerSessions)
    .values({ id: id(99), shopId: identity.shopId, tokenHash: "d".repeat(64) });
  await expect(
    db.insert(s.productConfigurations).values({
      id: id(98),
      publicId: "bad-owner",
      shopId: identity.shopId,
      ownerSessionId: id(99),
      terrainDesignId: snapshot.designId,
      productTypeId: id(20),
    }),
  ).rejects.toThrow();
  await expect(
    db
      .insert(s.productConfigurationVersions)
      .values({ ...configRow, id: id(97), version: 3, productTypeId: id(21) }),
  ).rejects.toThrow();
  await expect(
    db.insert(s.productConfigurationVersions).values({
      ...configRow,
      id: id(96),
      version: 3,
      configuration: {
        ...configuration.content,
        terrainHash: "f".repeat(64),
      },
    }),
  ).rejects.toThrow();
  await expect(
    db
      .insert(s.productArtefacts)
      .values({ ...artefactRow, id: id(95), geometryVersion: "different/v1" }),
  ).rejects.toThrow();
  await expect(
    db.insert(s.designApprovals).values({
      configurationVersionId: configuration.id,
      ownerSessionId: id(99),
      configurationHash: configuration.configurationHash,
    }),
  ).rejects.toThrow();
});
it("keeps ready artefacts immutable and never releases a foundation job", async () => {
  await expect(
    db
      .update(s.productArtefacts)
      .set({ checksum: "e".repeat(64) })
      .where(eq(s.productArtefacts.id, id(50))),
  ).rejects.toThrow();
  await db.insert(s.productionJobs).values(jobRow);
  await expect(
    db
      .update(s.productionJobs)
      .set({ status: "released" })
      .where(eq(s.productionJobs.id, id(60))),
  ).rejects.toThrow();
  await expect(
    db
      .insert(s.productionJobs)
      .values({ ...jobRow, id: id(61), idempotencyKey: "different-key" }),
  ).rejects.toThrow();
});
it("rejects invalid hashes, signatures, statuses and job counts at the database", async () => {
  await expect(
    client.exec("UPDATE terrain_designs SET status='casting_ready'"),
  ).rejects.toThrow();
  for (const patch of [
    { checksum: "invalid" },
    { signature: null, keyId: "key-without-signature" },
    { signature: "a".repeat(64), keyId: null },
    { version: 0 },
  ]) {
    await expect(
      db.insert(s.terrainDesignVersions).values({
        id: id(90),
        terrainDesignId: snapshot.designId,
        version: 10,
        parameters: snapshot.parameters,
        heightmapKey: "fixture.bin",
        heightmapChecksum: snapshot.parameters.heightmap.checksum,
        terrainVersion: "v1",
        checksum: snapshot.designHash,
        ...patch,
      }),
    ).rejects.toThrow();
  }
  await expect(
    db.insert(s.productionJobs).values({
      ...jobRow,
      id: id(62),
      quantity: 0,
      idempotencyKey: "invalid-count",
    }),
  ).rejects.toThrow();
});
it("deduplicates webhook intake and binds an outbox entry to a durable job", async () => {
  const delivery = {
    shopId: identity.shopId,
    eventId: "fixture-event",
    topic: "orders/paid",
    bodyChecksum: "0".repeat(64),
  };
  await db.insert(s.webhookDeliveries).values(delivery);
  await expect(
    db.insert(s.webhookDeliveries).values(delivery),
  ).rejects.toThrow();
  // This tests schema support, not an implemented webhook or production service.
  await db.insert(s.jobOutbox).values({ productionJobId: jobRow.id });
  await expect(
    db.insert(s.jobOutbox).values({ productionJobId: jobRow.id }),
  ).rejects.toThrow();
});

it("rolls back version append and pointer changes together on invalid commit", async () => {
  await expect(
    db.transaction(async (tx) => {
      await tx.insert(s.terrainDesignVersions).values({
        id: id(77),
        terrainDesignId: snapshot.designId,
        version: 3,
        parameters: snapshot.parameters,
        heightmapKey: "fixture/rollback.bin",
        heightmapChecksum: snapshot.parameters.heightmap.checksum,
        terrainVersion: "terrain/v1",
        checksum: snapshot.designHash,
      });
      await tx
        .update(s.terrainDesigns)
        .set({ currentVersionId: id(1234) })
        .where(eq(s.terrainDesigns.id, snapshot.designId));
    }),
  ).rejects.toThrow();
  expect(
    await db
      .select()
      .from(s.terrainDesignVersions)
      .where(eq(s.terrainDesignVersions.id, id(77))),
  ).toHaveLength(0);
});
