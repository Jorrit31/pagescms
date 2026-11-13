CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
