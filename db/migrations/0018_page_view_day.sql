CREATE TABLE "page_view_day" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_page_view_day_unique" ON "page_view_day" USING btree ("owner","repo","day","kind","label");--> statement-breakpoint
CREATE INDEX "idx_page_view_day_site" ON "page_view_day" USING btree (lower("owner"),lower("repo"),"day");--> statement-breakpoint
-- Visitor data from clients' websites: keep it away from the Supabase Data API.
ALTER TABLE "page_view_day" ENABLE ROW LEVEL SECURITY;
