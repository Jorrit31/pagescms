CREATE TABLE "site_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_site_setting_owner_repo_ci" ON "site_setting" USING btree (lower("owner"),lower("repo"));--> statement-breakpoint
ALTER TABLE "site_setting" ENABLE ROW LEVEL SECURITY;