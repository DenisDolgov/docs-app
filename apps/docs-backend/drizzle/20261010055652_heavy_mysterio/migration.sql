ALTER TABLE "documents"."documents" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "documents"."documents" ADD COLUMN "created_by" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "documents"."documents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "documents_organization_id_idx" ON "documents"."documents" ("organization_id");