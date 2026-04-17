-- all_in_one ya existe (migración 0004)
-- ALTER TYPE "public"."tipo_producto" ADD VALUE 'all_in_one';
CREATE TABLE IF NOT EXISTS "cron_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"checked" integer DEFAULT 0,
	"imported" integer DEFAULT 0,
	"updated" integer DEFAULT 0,
	"detalle" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
