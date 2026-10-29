CREATE TABLE "organization"."organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "organization_role" NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "organization_invites_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"."organizations"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invite_live_unique" ON "organization"."organization_invites" ("organization_id","email") WHERE "accepted_at" is null and "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "organization_invite_organization_id_idx" ON "organization"."organization_invites" ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invite_expires_at_idx" ON "organization"."organization_invites" ("expires_at");--> statement-breakpoint
CREATE TABLE "permission"."public_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"document_id" uuid NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"role" "document_share_role" DEFAULT 'viewer' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "public_link_document_id_idx" ON "permission"."public_links" ("document_id");--> statement-breakpoint
CREATE INDEX "public_link_expires_at_idx" ON "permission"."public_links" ("expires_at");
