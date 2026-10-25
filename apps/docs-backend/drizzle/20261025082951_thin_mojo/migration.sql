ALTER TABLE "auth"."refresh_tokens" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "auth"."refresh_tokens" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "auth"."refresh_tokens" ADD COLUMN "last_used_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_live_session_uidx" ON "auth"."refresh_tokens" ("session_id") WHERE "revoked_at" is null;--> statement-breakpoint
ALTER TABLE "auth"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;