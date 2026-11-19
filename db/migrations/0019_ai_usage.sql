CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"scope" text NOT NULL,
	"neurons" integer DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ai_usage_unique" ON "ai_usage" USING btree ("day","scope");--> statement-breakpoint
-- Internal counters: keep them away from the Supabase Data API.
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
