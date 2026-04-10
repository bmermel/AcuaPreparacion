/**
 * Seed script — crea el usuario inicial en la base de datos.
 * Uso: npx tsx scripts/seed.ts
 *
 * Requiere DATABASE_URL en el entorno (cargar .env.local antes de ejecutar).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../lib/db/schema";
import bcrypt from "bcryptjs";

// Leer .env.local manualmente si no está en el entorno
import { config } from "dotenv";
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL no está definida en .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

// ─── Configuración del usuario inicial ────────────────────────────────────────
const USUARIO = {
  name: "Admin",
  email: "admin@acua.local",
  password: "acua2025",
};
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Creando usuario inicial...");

  const passwordHash = await bcrypt.hash(USUARIO.password, 12);

  try {
    await db
      .insert(users)
      .values({
        name: USUARIO.name,
        email: USUARIO.email,
        passwordHash,
        rol: "admin",
      })
      .onConflictDoNothing({ target: users.email });

    console.log("✅  Usuario creado:");
    console.log(`    Email:      ${USUARIO.email}`);
    console.log(`    Contraseña: ${USUARIO.password}`);
    console.log("\n⚠️   Cambiá la contraseña después del primer login.");
  } catch (err) {
    console.error("❌  Error al crear usuario:", err);
    process.exit(1);
  }

  process.exit(0);
}

seed();
