ALTER TYPE "refresh_token_revoke_reason" ADD VALUE 'password_reset';--> statement-breakpoint
CREATE TABLE "auth"."password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "auth"."password_reset_tokens" ("user_id");