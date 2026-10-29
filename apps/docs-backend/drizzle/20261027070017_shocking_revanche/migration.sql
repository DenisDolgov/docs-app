CREATE SCHEMA "permission";
--> statement-breakpoint
CREATE TYPE "document_share_role" AS ENUM('viewer', 'commenter', 'editor');--> statement-breakpoint
CREATE TABLE "permission"."document_shares" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "document_share_role" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_share_unique" UNIQUE("document_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "document_share_user_id_idx" ON "permission"."document_shares" ("user_id");