CREATE TABLE "form_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"form" text NOT NULL,
	"fields" jsonb NOT NULL,
	"email" text,
	"page" text,
	"ip_hash" text,
	"mailed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_form_submission_owner_repo_createdAt" ON "form_submission" USING btree (lower("owner"),lower("repo"),"created_at");--> statement-breakpoint
-- Personal data from website visitors: keep it away from the Supabase Data API.
-- The CMS connects as the table owner, which is not affected by RLS.
ALTER TABLE "form_submission" ENABLE ROW LEVEL SECURITY;