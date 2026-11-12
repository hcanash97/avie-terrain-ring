-- Version tables are append-only, including protection from accidental TRUNCATE.
CREATE FUNCTION avie_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable version record: append a new version instead'; END; $$;
--> statement-breakpoint
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['terrain_design_versions','product_configuration_versions','product_type_constraints','manufacturer_profile_versions','design_approvals','production_release_approvals'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION avie_reject_mutation()',name);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION avie_reject_mutation()',name);
 END LOOP;
END; $$;
--> statement-breakpoint
ALTER TABLE terrain_designs ADD CONSTRAINT terrain_current_version_fk FOREIGN KEY (current_version_id,id) REFERENCES terrain_design_versions(id,terrain_design_id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE product_configurations ADD CONSTRAINT config_current_version_fk FOREIGN KEY (current_version_id,id) REFERENCES product_configuration_versions(id,product_configuration_id) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE product_configuration_versions ADD CONSTRAINT configuration_json_pins CHECK (
 configuration_json->>'shopId' IS NOT NULL AND configuration_json->>'shopId'=shop_id::text AND
 configuration_json->>'terrainDesignId' IS NOT NULL AND configuration_json->>'terrainDesignId'=terrain_design_id::text AND
 configuration_json->>'terrainVersionId' IS NOT NULL AND configuration_json->>'terrainVersionId'=terrain_design_version_id::text AND
 configuration_json->>'geometryVersion' IS NOT NULL AND configuration_json->>'geometryVersion'=geometry_version AND
 configuration_json->'input'->>'material' IS NOT NULL AND configuration_json->'input'->>'material'=material::text AND
 configuration_json->'input'->>'finish' IS NOT NULL AND configuration_json->'input'->>'finish'=finish::text
);
--> statement-breakpoint
CREATE FUNCTION avie_check_configuration_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_owner uuid; expected_hash text; expected_type text; expected_constraint_hash text; expected_profile text; expected_constraint_version integer; expected_terrain_version integer;
BEGIN
 SELECT owner_session_id INTO expected_owner FROM product_configurations WHERE id=NEW.product_configuration_id;
 SELECT checksum,version INTO expected_hash,expected_terrain_version FROM terrain_design_versions WHERE id=NEW.terrain_design_version_id;
 SELECT slug::text INTO expected_type FROM product_types WHERE id=NEW.product_type_id;
 SELECT checksum,profile_key,constraint_version INTO expected_constraint_hash,expected_profile,expected_constraint_version FROM product_type_constraints WHERE id=NEW.constraint_version_id;
 IF NEW.configuration_json->>'ownerSessionId' IS DISTINCT FROM expected_owner::text OR
    NEW.configuration_json->>'terrainHash' IS DISTINCT FROM expected_hash OR
    NEW.configuration_json->>'terrainVersion' IS DISTINCT FROM expected_terrain_version::text OR
    NEW.configuration_json->'input'->'selection'->>'productType' IS DISTINCT FROM expected_type OR
    NEW.configuration_json->>'constraintHash' IS DISTINCT FROM expected_constraint_hash OR
    NEW.configuration_json->>'constraintProfileId' IS DISTINCT FROM expected_profile OR
    NEW.configuration_json->>'constraintVersion' IS DISTINCT FROM expected_constraint_version::text
 THEN RAISE EXCEPTION 'Configuration content does not match version provenance'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER configuration_content BEFORE INSERT ON product_configuration_versions FOR EACH ROW EXECUTE FUNCTION avie_check_configuration_content();
--> statement-breakpoint
CREATE FUNCTION avie_check_design_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM product_configuration_versions v JOIN product_configurations c ON c.id=v.product_configuration_id WHERE v.id=NEW.configuration_version_id AND v.checksum=NEW.configuration_hash AND c.owner_session_id=NEW.owner_session_id)
 THEN RAISE EXCEPTION 'Approval owner/hash does not match configuration'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER approval_provenance BEFORE INSERT ON design_approvals FOR EACH ROW EXECUTE FUNCTION avie_check_design_approval();
--> statement-breakpoint
CREATE FUNCTION avie_protect_ready_artefact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='ready' THEN RAISE EXCEPTION 'Ready artefact is immutable; create a new artefact'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER artefact_immutable BEFORE UPDATE OR DELETE ON product_artefacts FOR EACH ROW EXECUTE FUNCTION avie_protect_ready_artefact();
--> statement-breakpoint
CREATE FUNCTION avie_hold_production() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='released' THEN RAISE EXCEPTION 'Production release is not implemented in foundation milestone'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER production_hold BEFORE INSERT OR UPDATE ON production_jobs FOR EACH ROW EXECUTE FUNCTION avie_hold_production();
--> statement-breakpoint
-- Reject non-finite candidate dimensions even when bypassing application schemas.
DO $$ DECLARE col text; BEGIN
 FOREACH col IN ARRAY ARRAY['min_face_width_mm','max_face_width_mm','min_face_height_mm','max_face_height_mm','min_wall_thickness_mm','min_feature_width_mm','max_relief_mm','max_volume_cm3'] LOOP
  EXECUTE format('ALTER TABLE product_type_constraints ADD CONSTRAINT %I CHECK (%I IS NULL OR (%I > 0 AND %I < ''Infinity''::float8))', 'finite_'||col,col,col,col);
 END LOOP;
END; $$;
--> statement-breakpoint
ALTER TABLE product_type_constraints ADD CONSTRAINT constraint_material_values CHECK (
 jsonb_typeof(allowed_materials)='array' AND jsonb_array_length(allowed_materials)>0 AND
 allowed_materials <@ '["silver_925","gold_9ct","gold_14ct","gold_18ct","platinum_950"]'::jsonb
);
