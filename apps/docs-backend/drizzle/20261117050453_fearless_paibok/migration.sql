CREATE TABLE "document"."comments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"document_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"anchor" jsonb,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_max_length" CHECK (LENGTH("body") <= 5000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "comments_document_idx" ON "document"."comments" ("document_id","id");--> statement-breakpoint
ALTER TABLE "document"."comments" ADD CONSTRAINT "comments_document_id_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"."documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document"."comments" ADD CONSTRAINT "comments_document_id_parent_id_comments_document_id_id_fkey" FOREIGN KEY ("document_id","parent_id") REFERENCES "document"."comments"("document_id","id") ON DELETE CASCADE;