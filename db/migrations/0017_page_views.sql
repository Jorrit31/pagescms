CREATE TABLE "page_view" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"path" text NOT NULL,
	"source" text,
	"device" text NOT NULL,
	"visitor" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_page_view_owner_repo_createdAt" ON "page_view" USING btree (lower("owner"),lower("repo"),"created_at");--> statement-breakpoint
-- Visitor data from clients' websites: keep it away from the Supabase Data API.
ALTER TABLE "page_view" ENABLE ROW LEVEL SECURITY;
