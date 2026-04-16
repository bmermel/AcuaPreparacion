"use client";

import { useState } from "react";
import type { Order } from "@/lib/db/schema";
import { OrderCard } from "./order-card";

export function SearchableOrderGrid({ pedidos }: { pedidos: Order[] }) {
  const [busqueda, setBusqueda] = useState("");

  const termino = busqueda.toLowerCase().trim();
  const filtrados = termino
    ? pedidos.filter((o) => {
        const campos = [
          o.referencia,
          o.clienteNombre,
          o.clienteTel,
          o.clienteEmail,
        ];
        return campos.some((c) => c?.toLowerCase().includes(termino));
      })
    : pedidos;

  return (
    <>
      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por referencia, cliente, teléfono o email..."
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
        />
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">{termino ? "🔍" : "📭"}</p>
          <p className="text-sm">
            {termino
              ? `No se encontraron pedidos para "${busqueda}"`
              : "No hay pedidos en esta sección"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtrados.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}
