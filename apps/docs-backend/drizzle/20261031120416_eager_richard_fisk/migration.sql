CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE TABLE "audit"."events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_event_target_idx" ON "audit"."events" ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_event_actor_idx" ON "audit"."events" ("actor_id","created_at");

--> statement-breakpoint
CREATE FUNCTION "audit"."events_append_only"() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'audit.events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "events_append_only" BEFORE UPDATE OR DELETE ON "audit"."events" FOR EACH ROW EXECUTE FUNCTION "audit"."events_append_only"();
