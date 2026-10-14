CREATE SCHEMA "collab";
--> statement-breakpoint
CREATE TABLE "collab"."document_snapshots" (
	"document_id" uuid PRIMARY KEY,
	"snapshot" bytea NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collab"."document_updates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collab"."document_updates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" uuid NOT NULL,
	"update" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "document_updates_document_id_idx" ON "collab"."document_updates" ("document_id","id");