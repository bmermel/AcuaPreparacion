import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { DashboardClient } from "@/components/dashboard-client";
import { signOut, auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  const rol = session?.user?.rol ?? "tecnico";

  const pedidos = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Acua</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">
              {session?.user?.name}
              {rol === "admin" && (
                <span className="ml-1 text-blue-500">(admin)</span>
              )}
            </span>
            <Link
              href="/orders/new"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              + Nuevo pedido
            </Link>
            <Link
              href="/orders/import"
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              Qloud
            </Link>
            {rol === "admin" && (
              <>
                <Link
                  href="/contabilium"
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Contabilium
                </Link>
                <Link
                  href="/metricas"
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Métricas
                </Link>
              </>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <DashboardClient pedidos={pedidos} rol={rol} />
      </main>
    </div>
  );
}
