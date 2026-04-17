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
  "varios",
  "all_in_one",
]);

export const envioTipoEnum = pgEnum("envio_tipo", ["retiro", "domicilio"]);

export const estadoEnum = pgEnum("estado", [
  "pendiente",
  "preparacion",
  "listo",
  "despachado",
]);

export const rolEnum = pgEnum("rol", ["admin", "tecnico"]);

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: rolEnum("rol").notNull().default("tecnico"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  qloudId: integer("qloud_id").unique(),
  tipoOrden: tipoOrdenEnum("tipo_orden").notNull(),
  referencia: text("referencia").notNull(),
  tipoProducto: tipoProductoEnum("tipo_producto").notNull(),
  clienteNombre: text("cliente_nombre"),
  clienteEmail: text("cliente_email"),
  clienteTel: text("cliente_tel"),
  clienteDni: text("cliente_dni"),
  productos: jsonb("productos"),
  envioTipo: envioTipoEnum("envio_tipo"),
  envioDireccion: jsonb("envio_direccion"),
  pagoTipo: text("pago_tipo"),
  precio: text("precio"),
  notas: text("notas"),
  notasInternas: jsonb("notas_internas").default([]),
  estado: estadoEnum("estado").notNull().default("pendiente"),
  fechaVenta: timestamp("fecha_venta"),
  fechaEntregaEstimada: timestamp("fecha_entrega_estimada"),
  fechaEntregaCustom: timestamp("fecha_entrega_custom"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Reglas de clasificación de productos (aprendizaje) ───────────────────────

export const reglasProducto = pgTable("reglas_producto", {
  id: uuid("id").primaryKey().defaultRandom(),
  patron: text("patron").notNull(),
  tipoProducto: tipoProductoEnum("tipo_producto").notNull(),
  creadoPor: text("creado_por").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Historial de cambios ────────────────────────────────────────────────────

export const orderHistory = pgTable("order_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  userName: text("user_name").notNull(),
  estadoAnterior: estadoEnum("estado_anterior"),
  estadoNuevo: estadoEnum("estado_nuevo"),
  campo: text("campo"),
  valorAnterior: text("valor_anterior"),
  valorNuevo: text("valor_nuevo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Logs de cron/polling ────────────────────────────────────────────────────

export const cronLogs = pgTable("cron_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  job: text("job").notNull(), // "poll-qloud"
  status: text("status").notNull(), // "ok" | "error" | "skipped"
  checked: integer("checked").default(0),
  imported: integer("imported").default(0),
  updated: integer("updated").default(0),
  detalle: text("detalle"), // info extra o mensaje de error
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Tipos TypeScript ─────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type ReglaProducto = typeof reglasProducto.$inferSelect;
export type OrderHistoryEntry = typeof orderHistory.$inferSelect;
export type CronLog = typeof cronLogs.$inferSelect;

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

export type NotaInterna = {
  id: string;
  userName: string;
  mensaje: string;
  createdAt: string;     // ISO string
  imprimible: boolean;
};

export type EstadoOrden = "pendiente" | "preparacion" | "listo" | "despachado";
export type TipoProducto = "notebook" | "computadora" | "all_in_one" | "varios";
export type TipoOrden =
  | "web"
  | "factura_a"
  | "factura_b"
  | "cotizacion"
  | "orden_venta";
export type Rol = "admin" | "tecnico";
