CREATE TYPE "public"."envio_tipo" AS ENUM('retiro', 'domicilio');--> statement-breakpoint
CREATE TYPE "public"."estado" AS ENUM('pendiente', 'preparacion', 'listo', 'despachado');--> statement-breakpoint
CREATE TYPE "public"."tipo_orden" AS ENUM('web', 'factura_a', 'factura_b', 'cotizacion', 'orden_venta');--> statement-breakpoint
CREATE TYPE "public"."tipo_producto" AS ENUM('notebook', 'computadora');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qloud_id" integer,
	"tipo_orden" "tipo_orden" NOT NULL,
	"referencia" text NOT NULL,
	"tipo_producto" "tipo_producto" NOT NULL,
	"cliente_nombre" text,
	"cliente_email" text,
	"cliente_tel" text,
	"cliente_dni" text,
	"productos" jsonb,
	"envio_tipo" "envio_tipo",
	"envio_direccion" jsonb,
	"pago_tipo" text,
	"precio" text,
	"notas" text,
	"estado" "estado" DEFAULT 'pendiente' NOT NULL,
	"fecha_venta" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_qloud_id_unique" UNIQUE("qloud_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
