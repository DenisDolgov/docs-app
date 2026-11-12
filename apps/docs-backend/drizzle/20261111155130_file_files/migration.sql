CREATE SCHEMA "file";
--> statement-breakpoint
CREATE TYPE "file_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TABLE "file"."files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"owner_id" uuid NOT NULL,
	"organization_id" uuid,
	"document_id" uuid,
	"key" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"status" "file_status" DEFAULT 'pending'::"file_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_size_non_negative" CHECK ("size" >= 0),
	CONSTRAINT "files_key_not_empty" CHECK (length("key") > 0)
);
--> statement-breakpoint
CREATE INDEX "files_document_id_created_at_idx" ON "file"."files" ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "files_status_created_at_idx" ON "file"."files" ("status","created_at");--> statement-breakpoint
CREATE INDEX "files_owner_id_idx" ON "file"."files" ("owner_id");