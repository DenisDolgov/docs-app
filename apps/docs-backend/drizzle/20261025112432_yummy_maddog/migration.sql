CREATE INDEX "refresh_tokens_user_id_idx" ON "auth"."refresh_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "auth"."refresh_tokens" ("expires_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_revoked_at_idx" ON "auth"."refresh_tokens" ("revoked_at");