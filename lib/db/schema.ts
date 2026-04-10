import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const tipoOrdenEnum = pgEnum("tipo_orden", [
  "web",
  "factura_a",
  "factura_b",
  "cotizacion",
  "orden_venta",
]);

export const tipoProductoEnum = pgEnum("tipo_producto", [
  "notebook",
  "computadora",
]);

export const envioTipoEnum = pgEnum("envio_tipo", ["retiro", "domicilio"]);

export const estadoEnum = pgEnum("estado", [
  "pendiente",
  "preparacion",
  "listo",
  "despachado",
]);

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Solo para pedidos web (Qloud) — null para pedidos manuales
  qloudId: integer("qloud_id").unique(),
  tipoOrden: tipoOrdenEnum("tipo_orden").notNull(),
  // Referencia visible: #130564, FCA54444, OV 3772, etc.
  referencia: text("referencia").notNull(),
  tipoProducto: tipoProductoEnum("tipo_producto").notNull(),
  // Datos del cliente
  clienteNombre: text("cliente_nombre"),
  clienteEmail: text("cliente_email"),
  clienteTel: text("cliente_tel"),
  clienteDni: text("cliente_dni"),
  // Productos como JSON array
  productos: jsonb("productos"),
  // Envío
  envioTipo: envioTipoEnum("envio_tipo"),
  envioDireccion: jsonb("envio_direccion"),
  // Pago
  pagoTipo: text("pago_tipo"),
  precio: text("precio"),
  // Internas
  notas: text("notas"),
  estado: estadoEnum("estado").notNull().default("pendiente"),
  // Fechas
  fechaVenta: timestamp("fecha_venta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tipos TypeScript ─────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Producto = {
  sku: string;
  nombre: string;
  cantidad: number;
  precio: number;
};

export type DireccionEnvio = {
  calle?: string;
  altura?: string;
  piso?: string;
  puerta?: string;
  localidad?: string;
  provincia?: string;
  cp?: string;
};

export type EstadoOrden = "pendiente" | "preparacion" | "listo" | "despachado";
export type TipoProducto = "notebook" | "computadora";
export type TipoOrden =
  | "web"
  | "factura_a"
  | "factura_b"
  | "cotizacion"
  | "orden_venta";
