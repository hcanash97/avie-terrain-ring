import { defineConfig } from "drizzle-kit";
// Generation only. No database URL or remote migrate command is supplied.
export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/drizzle",
});
