CREATE TYPE "public"."artefact_format" AS ENUM('stl', '3dm', 'pdf', 'json', 'png');--> statement-breakpoint
CREATE TYPE "public"."artefact_purpose" AS ENUM('preview', 'review_sample', 'production');--> statement-breakpoint
CREATE TYPE "public"."artefact_status" AS ENUM('generating', 'ready', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."catalogue_status" AS ENUM('active', 'planned', 'future', 'retired');--> statement-breakpoint
CREATE TYPE "public"."configuration_status" AS ENUM('draft', 'preview_ready', 'quote_pending', 'quoted', 'approved', 'ordered', 'archived');--> statement-breakpoint
CREATE TYPE "public"."constraint_status" AS ENUM('provisional', 'approved', 'retired');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('received', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."finish" AS ENUM('polished', 'satin');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('awaiting_input', 'queued', 'generating', 'validation_failed', 'export_failed', 'awaiting_review', 'released', 'cancelled', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."metal" AS ENUM('silver_925', 'gold_9ct', 'gold_14ct', 'gold_18ct', 'platinum_950');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'dispatched', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_slug" AS ENUM('terrain_ring', 'terrain_pendant', 'terrain_signet', 'terrain_cufflinks', 'terrain_charm', 'terrain_tie_bar', 'terrain_bracelet', 'terrain_locket', 'terrain_object');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('provisional', 'approved', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."terrain_status" AS ENUM('draft', 'ready', 'archived');--> statement-breakpoint
CREATE TABLE "design_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"owner_session_id" uuid NOT NULL,
	"configuration_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_hash" CHECK ("design_approvals"."configuration_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "job_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_job_id" uuid NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_job_uq" UNIQUE("production_job_id")
);
--> statement-breakpoint
CREATE TABLE "manufacturer_profile_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_key" text NOT NULL,
	"version" integer NOT NULL,
	"status" "constraint_status" DEFAULT 'provisional' NOT NULL,
	"rules_json" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manufacturer_version_uq" UNIQUE("profile_key","version"),
	CONSTRAINT "manufacturer_version_positive" CHECK ("manufacturer_profile_versions"."version">0),
	CONSTRAINT "manufacturer_hash" CHECK ("manufacturer_profile_versions"."checksum" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "owner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_shop_id_uq" UNIQUE("shop_id","id"),
	CONSTRAINT "owner_token_uq" UNIQUE("token_hash"),
	CONSTRAINT "owner_token_hash" CHECK ("owner_sessions"."token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "price_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"status" "quote_status" DEFAULT 'provisional' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"quantity" integer NOT NULL,
	"rule_version" text NOT NULL,
	"cost_version" text NOT NULL,
	"variant_gid" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_amount" CHECK ("price_quotes"."amount_minor">=0 AND "price_quotes"."amount_minor"<=9007199254740991 AND "price_quotes"."quantity">0 AND "price_quotes"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "product_artefacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"terrain_version_id" uuid NOT NULL,
	"constraint_version_id" uuid NOT NULL,
	"product_type_id" uuid NOT NULL,
	"geometry_version" text NOT NULL,
	"configuration_hash" text NOT NULL,
	"format" "artefact_format" NOT NULL,
	"purpose" "artefact_purpose" NOT NULL,
	"status" "artefact_status" NOT NULL,
	"object_key" text NOT NULL,
	"checksum" text NOT NULL,
	"byte_length" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artefact_config_uq" UNIQUE("id","configuration_version_id"),
	CONSTRAINT "artefact_hash" CHECK ("product_artefacts"."checksum" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "artefact_bytes" CHECK ("product_artefacts"."byte_length">0)
);
--> statement-breakpoint
CREATE TABLE "product_configuration_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_configuration_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_type_id" uuid NOT NULL,
	"terrain_design_id" uuid NOT NULL,
	"terrain_design_version_id" uuid NOT NULL,
	"constraint_version_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"configuration_json" jsonb NOT NULL,
	"geometry_version" text NOT NULL,
	"material" "metal" NOT NULL,
	"finish" "finish" NOT NULL,
	"checksum" text NOT NULL,
	"signature" text,
	"key_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_version_uq" UNIQUE("product_configuration_id","version"),
	CONSTRAINT "config_version_parent_uq" UNIQUE("id","product_configuration_id"),
	CONSTRAINT "config_version_shop_uq" UNIQUE("id","product_configuration_id","shop_id"),
	CONSTRAINT "config_provenance_uq" UNIQUE("id","terrain_design_version_id","constraint_version_id","product_type_id","geometry_version","checksum"),
	CONSTRAINT "config_version_positive" CHECK ("product_configuration_versions"."version">0),
	CONSTRAINT "config_hash" CHECK ("product_configuration_versions"."checksum" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "config_signature_pair" CHECK (("product_configuration_versions"."signature" IS NULL AND "product_configuration_versions"."key_id" IS NULL) OR ("product_configuration_versions"."signature" IS NOT NULL AND "product_configuration_versions"."signature" ~ '^[a-f0-9]{64}$' AND "product_configuration_versions"."key_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "product_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"shop_id" uuid NOT NULL,
	"owner_session_id" uuid NOT NULL,
	"terrain_design_id" uuid NOT NULL,
	"product_type_id" uuid NOT NULL,
	"status" "configuration_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_configurations_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "config_parent_scope_uq" UNIQUE("id","product_type_id","terrain_design_id"),
	CONSTRAINT "config_shop_uq" UNIQUE("id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "product_type_constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type_id" uuid NOT NULL,
	"constraint_version" integer NOT NULL,
	"profile_key" text NOT NULL,
	"status" "constraint_status" DEFAULT 'provisional' NOT NULL,
	"manufacturer_profile_version_id" uuid,
	"min_face_width_mm" double precision,
	"max_face_width_mm" double precision,
	"min_face_height_mm" double precision,
	"max_face_height_mm" double precision,
	"min_wall_thickness_mm" double precision,
	"min_feature_width_mm" double precision,
	"max_relief_mm" double precision,
	"max_volume_cm3" double precision,
	"allowed_materials" jsonb NOT NULL,
	"allowed_finishes" jsonb NOT NULL,
	"allowed_face_shapes" jsonb NOT NULL,
	"allowed_attachment_types" jsonb NOT NULL,
	"validation_rules_json" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constraint_version_uq" UNIQUE("product_type_id","profile_key","constraint_version"),
	CONSTRAINT "constraint_product_uq" UNIQUE("id","product_type_id"),
	CONSTRAINT "constraint_version_positive" CHECK ("product_type_constraints"."constraint_version">0),
	CONSTRAINT "constraint_hash" CHECK ("product_type_constraints"."checksum" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "constraint_dimensions" CHECK (("product_type_constraints"."min_face_width_mm" IS NULL OR "product_type_constraints"."min_face_width_mm">0) AND ("product_type_constraints"."max_face_width_mm" IS NULL OR "product_type_constraints"."max_face_width_mm">0) AND ("product_type_constraints"."min_face_height_mm" IS NULL OR "product_type_constraints"."min_face_height_mm">0) AND ("product_type_constraints"."max_face_height_mm" IS NULL OR "product_type_constraints"."max_face_height_mm">0) AND ("product_type_constraints"."min_face_width_mm" IS NULL OR "product_type_constraints"."max_face_width_mm" IS NULL OR "product_type_constraints"."min_face_width_mm"<="product_type_constraints"."max_face_width_mm") AND ("product_type_constraints"."min_face_height_mm" IS NULL OR "product_type_constraints"."max_face_height_mm" IS NULL OR "product_type_constraints"."min_face_height_mm"<="product_type_constraints"."max_face_height_mm")),
	CONSTRAINT "constraint_thickness" CHECK (("product_type_constraints"."min_wall_thickness_mm" IS NULL OR "product_type_constraints"."min_wall_thickness_mm">0) AND ("product_type_constraints"."min_feature_width_mm" IS NULL OR "product_type_constraints"."min_feature_width_mm">0) AND ("product_type_constraints"."max_relief_mm" IS NULL OR "product_type_constraints"."max_relief_mm">0) AND ("product_type_constraints"."max_volume_cm3" IS NULL OR "product_type_constraints"."max_volume_cm3">0))
);
--> statement-breakpoint
CREATE TABLE "product_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "product_slug" NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"status" "catalogue_status" NOT NULL,
	"supports_terrain_design" boolean DEFAULT true NOT NULL,
	"requires_size" boolean NOT NULL,
	"supports_engraving" boolean NOT NULL,
	"supports_chain" boolean NOT NULL,
	"supports_multiple_locations" boolean DEFAULT false NOT NULL,
	"options_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "production_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configuration_id" uuid NOT NULL,
	"configuration_version_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_gid" text NOT NULL,
	"line_item_gid" text NOT NULL,
	"shopify_order_number" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" "job_status" DEFAULT 'awaiting_input' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"manufacturer_profile_version_id" uuid NOT NULL,
	"packet_artefact_id" uuid,
	"error_code" text,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "job_order_line_revision_uq" UNIQUE("shop_id","order_gid","line_item_gid","configuration_version_id","manufacturer_profile_version_id"),
	CONSTRAINT "job_counts" CHECK ("production_jobs"."quantity">0 AND "production_jobs"."attempts">=0)
);
--> statement-breakpoint
CREATE TABLE "production_release_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_job_id" uuid NOT NULL,
	"approver_reference" text NOT NULL,
	"packet_checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_hash" CHECK ("production_release_approvals"."packet_checksum" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "terrain_design_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terrain_design_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"parameters_json" jsonb NOT NULL,
	"heightmap_key" text NOT NULL,
	"heightmap_checksum" text NOT NULL,
	"terrain_version" text NOT NULL,
	"checksum" text NOT NULL,
	"signature" text,
	"key_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terrain_version_uq" UNIQUE("terrain_design_id","version"),
	CONSTRAINT "terrain_version_parent_uq" UNIQUE("id","terrain_design_id"),
	CONSTRAINT "terrain_version_positive" CHECK ("terrain_design_versions"."version">0),
	CONSTRAINT "terrain_checksums" CHECK ("terrain_design_versions"."checksum" ~ '^[a-f0-9]{64}$' AND "terrain_design_versions"."heightmap_checksum" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "terrain_signature_pair" CHECK (("terrain_design_versions"."signature" IS NULL AND "terrain_design_versions"."key_id" IS NULL) OR ("terrain_design_versions"."signature" IS NOT NULL AND "terrain_design_versions"."signature" ~ '^[a-f0-9]{64}$' AND "terrain_design_versions"."key_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "terrain_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"shop_id" uuid NOT NULL,
	"owner_session_id" uuid NOT NULL,
	"status" "terrain_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terrain_designs_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "terrain_owner_uq" UNIQUE("id","shop_id","owner_session_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"topic" text NOT NULL,
	"body_checksum" text NOT NULL,
	"status" "event_status" DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_event_uq" UNIQUE("shop_id","event_id"),
	CONSTRAINT "webhook_hash" CHECK ("webhook_deliveries"."body_checksum" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "design_approvals" ADD CONSTRAINT "design_approvals_configuration_version_id_product_configuration_versions_id_fk" FOREIGN KEY ("configuration_version_id") REFERENCES "public"."product_configuration_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_approvals" ADD CONSTRAINT "design_approvals_owner_session_id_owner_sessions_id_fk" FOREIGN KEY ("owner_session_id") REFERENCES "public"."owner_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_outbox" ADD CONSTRAINT "job_outbox_production_job_id_production_jobs_id_fk" FOREIGN KEY ("production_job_id") REFERENCES "public"."production_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_sessions" ADD CONSTRAINT "owner_sessions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_quotes" ADD CONSTRAINT "price_quotes_configuration_version_id_product_configuration_versions_id_fk" FOREIGN KEY ("configuration_version_id") REFERENCES "public"."product_configuration_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_artefacts" ADD CONSTRAINT "artefact_provenance_fk" FOREIGN KEY ("configuration_version_id","terrain_version_id","constraint_version_id","product_type_id","geometry_version","configuration_hash") REFERENCES "public"."product_configuration_versions"("id","terrain_design_version_id","constraint_version_id","product_type_id","geometry_version","checksum") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configuration_versions" ADD CONSTRAINT "config_version_parent_fk" FOREIGN KEY ("product_configuration_id","product_type_id","terrain_design_id") REFERENCES "public"."product_configurations"("id","product_type_id","terrain_design_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configuration_versions" ADD CONSTRAINT "config_version_shop_fk" FOREIGN KEY ("product_configuration_id","shop_id") REFERENCES "public"."product_configurations"("id","shop_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configuration_versions" ADD CONSTRAINT "config_version_terrain_fk" FOREIGN KEY ("terrain_design_version_id","terrain_design_id") REFERENCES "public"."terrain_design_versions"("id","terrain_design_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configuration_versions" ADD CONSTRAINT "config_version_constraint_fk" FOREIGN KEY ("constraint_version_id","product_type_id") REFERENCES "public"."product_type_constraints"("id","product_type_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configurations" ADD CONSTRAINT "product_configurations_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configurations" ADD CONSTRAINT "product_configurations_product_type_id_product_types_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configurations" ADD CONSTRAINT "config_terrain_owner_fk" FOREIGN KEY ("terrain_design_id","shop_id","owner_session_id") REFERENCES "public"."terrain_designs"("id","shop_id","owner_session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_type_constraints" ADD CONSTRAINT "product_type_constraints_product_type_id_product_types_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_type_constraints" ADD CONSTRAINT "product_type_constraints_manufacturer_profile_version_id_manufacturer_profile_versions_id_fk" FOREIGN KEY ("manufacturer_profile_version_id") REFERENCES "public"."manufacturer_profile_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_manufacturer_profile_version_id_manufacturer_profile_versions_id_fk" FOREIGN KEY ("manufacturer_profile_version_id") REFERENCES "public"."manufacturer_profile_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_packet_artefact_id_product_artefacts_id_fk" FOREIGN KEY ("packet_artefact_id") REFERENCES "public"."product_artefacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "job_packet_revision_fk" FOREIGN KEY ("packet_artefact_id","configuration_version_id") REFERENCES "public"."product_artefacts"("id","configuration_version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "job_config_shop_fk" FOREIGN KEY ("configuration_version_id","configuration_id","shop_id") REFERENCES "public"."product_configuration_versions"("id","product_configuration_id","shop_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_release_approvals" ADD CONSTRAINT "production_release_approvals_production_job_id_production_jobs_id_fk" FOREIGN KEY ("production_job_id") REFERENCES "public"."production_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terrain_design_versions" ADD CONSTRAINT "terrain_design_versions_terrain_design_id_terrain_designs_id_fk" FOREIGN KEY ("terrain_design_id") REFERENCES "public"."terrain_designs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terrain_designs" ADD CONSTRAINT "terrain_designs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terrain_designs" ADD CONSTRAINT "terrain_owner_fk" FOREIGN KEY ("shop_id","owner_session_id") REFERENCES "public"."owner_sessions"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_configuration_idx" ON "design_approvals" USING btree ("configuration_version_id");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "job_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "quote_configuration_expiry_idx" ON "price_quotes" USING btree ("configuration_version_id","expires_at");--> statement-breakpoint
CREATE INDEX "artefact_config_purpose_idx" ON "product_artefacts" USING btree ("configuration_version_id","purpose");--> statement-breakpoint
CREATE INDEX "config_version_terrain_idx" ON "product_configuration_versions" USING btree ("terrain_design_version_id");--> statement-breakpoint
CREATE INDEX "config_version_constraint_idx" ON "product_configuration_versions" USING btree ("constraint_version_id");--> statement-breakpoint
CREATE INDEX "config_owner_created_idx" ON "product_configurations" USING btree ("shop_id","owner_session_id","created_at");--> statement-breakpoint
CREATE INDEX "config_type_idx" ON "product_configurations" USING btree ("product_type_id");--> statement-breakpoint
CREATE INDEX "config_terrain_idx" ON "product_configurations" USING btree ("terrain_design_id");--> statement-breakpoint
CREATE INDEX "constraint_type_idx" ON "product_type_constraints" USING btree ("product_type_id");--> statement-breakpoint
CREATE INDEX "constraint_manufacturer_idx" ON "product_type_constraints" USING btree ("manufacturer_profile_version_id");--> statement-breakpoint
CREATE INDEX "job_queue_idx" ON "production_jobs" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE INDEX "job_manufacturer_idx" ON "production_jobs" USING btree ("manufacturer_profile_version_id");--> statement-breakpoint
CREATE INDEX "job_config_idx" ON "production_jobs" USING btree ("configuration_version_id");--> statement-breakpoint
CREATE INDEX "release_job_idx" ON "production_release_approvals" USING btree ("production_job_id");--> statement-breakpoint
CREATE INDEX "terrain_owner_created_idx" ON "terrain_designs" USING btree ("shop_id","owner_session_id","created_at");