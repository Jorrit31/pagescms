CREATE TABLE "report_sent" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"month" text NOT NULL,
	"recipients" text,
	"error" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_report_sent_site_month" ON "report_sent" USING btree (lower("owner"),lower("repo"),"month");--> statement-breakpoint
-- Keep it away from the Supabase Data API.
ALTER TABLE "report_sent" ENABLE ROW LEVEL SECURITY;
