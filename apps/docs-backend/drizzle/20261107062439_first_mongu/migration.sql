ALTER SCHEMA "documents" RENAME TO "document";
--> statement-breakpoint
CREATE TABLE "permission"."folder_shares" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"folder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "document_share_role" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_share_unique" UNIQUE("folder_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "document"."folders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "document"."documents_organization_id_idx";--> statement-breakpoint
ALTER TABLE "document"."documents" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
CREATE INDEX "documents_organization_id_updated_at_idx" ON "document"."documents" ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "documents_folder_id_idx" ON "document"."documents" ("folder_id");--> statement-breakpoint
CREATE INDEX "folder_share_user_id_idx" ON "permission"."folder_shares" ("user_id");--> statement-breakpoint
CREATE INDEX "folders_organization_id_idx" ON "document"."folders" ("organization_id");--> statement-breakpoint
CREATE INDEX "folders_parent_id_idx" ON "document"."folders" ("parent_id");--> statement-breakpoint
ALTER TABLE "document"."documents" ADD CONSTRAINT "documents_folder_id_folders_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document"."folders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document"."folders" ADD CONSTRAINT "folders_parent_id_folders_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "document"."folders"("id") ON DELETE RESTRICT;