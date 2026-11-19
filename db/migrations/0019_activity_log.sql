CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"branch" text NOT NULL,
	"user_id" text,
	"user_name" text,
	"user_email" text,
	"action" text NOT NULL,
	"label" text,
	"title" text,
	"path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_activity_log_site" ON "activity_log" USING btree (lower("owner"),lower("repo"),"created_at");--> statement-breakpoint
-- Who changed what on clients' websites: keep it away from the Supabase Data API.
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;
