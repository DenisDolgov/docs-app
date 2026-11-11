CREATE TYPE "document_version_kind" AS ENUM('checkpoint', 'named');--> statement-breakpoint
CREATE TABLE "collab"."document_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"document_id" uuid NOT NULL,
	"kind" "document_version_kind" NOT NULL,
	"name" text,
	"snapshot" bytea NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"update_id" bigint
);
--> statement-breakpoint
CREATE INDEX "document_versions_document_id_created_at_idx" ON "collab"."document_versions" ("document_id","created_at");