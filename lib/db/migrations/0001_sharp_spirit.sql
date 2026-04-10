CREATE TYPE "public"."rol" AS ENUM('admin', 'tecnico');--> statement-breakpoint
ALTER TYPE "public"."tipo_producto" ADD VALUE 'varios';--> statement-breakpoint
CREATE TABLE "reglas_producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patron" text NOT NULL,
	"tipo_producto" "tipo_producto" NOT NULL,
	"creado_por" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fecha_entrega_estimada" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fecha_entrega_custom" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rol" "rol" DEFAULT 'tecnico' NOT NULL;