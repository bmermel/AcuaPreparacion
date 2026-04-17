"use client";

import { useState, useTransition, useEffect } from "react";
import type { Order, Cliente } from "@/lib/db/schema";
import { guardarDatosCliente } from "@/lib/actions";

type Props = {
  order: Order;
  cliente?: Cliente | null;
};

export function ClientEditor({ order, cliente }: Props) {
  const tieneCliente = !!(order.clienteNombre || order.clienteEmail || order.clienteTel || order.clienteDni);

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(order.clienteNombre ?? "");
  const [email, setEmail] = useState(order.clienteEmail ?? "");
  const [tel, setTel] = useState(order.clienteTel ?? "");
  const [dni, setDni] = useState(order.clienteDni ?? "");
  const [horario, setHorario] = useState(cliente?.horarioRecepcion ?? "");
  const [notasCliente, setNotasCliente] = useState(cliente?.notas ?? "");
  const [isSaving, startSaving] = useTransition();

  function handleGuardar() {
    startSaving(async () => {
      await guardarDatosCliente(order.id, {
        clienteNombre: nombre.trim() || null,
        clienteEmail: email.trim() || null,
        clienteTel: tel.trim() || null,
        clienteDni: dni.trim() || null,
        horarioRecepcion: horario.trim() || null,
        notasCliente: notasCliente.trim() || null,
      });
      setEditando(false);
    });
  }

  function handleCancelar() {
    setNombre(order.clienteNombre ?? "");
    setEmail(order.clienteEmail ?? "");
    setTel(order.clienteTel ?? "");
    setDni(order.clienteDni ?? "");
    setHorario(cliente?.horarioRecepcion ?? "");
    setNotasCliente(cliente?.notas ?? "");
    setEditando(false);
  }

  // Vista de solo lectura
  if (tieneCliente && !editando) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Cliente
          </p>
          <button
            onClick={() => setEditando(true)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            Editar
          </button>
        </div>
        <div className="space-y-1.5">
          {order.clienteNombre && (
            <p className="text-sm font-medium text-gray-800">{order.clienteNombre}</p>
          )}
          {order.clienteEmail && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400">Email:</span>{" "}
              <a href={`mailto:${order.clienteEmail}`} className="hover:underline">
                {order.clienteEmail}
              </a>
            </p>
          )}
          {order.clienteTel && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400">Tel:</span>{" "}
              <a href={`tel:${order.clienteTel}`} className="hover:underline">
                {order.clienteTel}
              </a>
            </p>
          )}
          {order.clienteDni && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400">DNI:</span> {order.clienteDni}
            </p>
          )}
          {cliente?.horarioRecepcion && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400">Horario:</span> {cliente.horarioRecepcion}
            </p>
          )}
          {cliente?.notas && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400">Notas:</span> {cliente.notas}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Vista de edicion
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {tieneCliente ? "Editar cliente" : "Cliente"}
        </p>
        {!tieneCliente && !editando && (
          <span className="text-xs text-amber-600 font-medium">Sin datos de cliente</span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Telefono</label>
            <input
              type="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="11-1234-5678"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">DNI / CUIT</label>
            <input
              type="text"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="12345678"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
            />
          </div>
        </div>

        {/* Campos del perfil del cliente */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-400 mb-2">Datos guardados del cliente (aplican a todos sus pedidos)</p>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Horario de recepcion</label>
            <input
              type="text"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              placeholder="Ej: 9 a 14hs, solo mañanas, etc."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-600 mb-1">Notas del cliente</label>
            <textarea
              value={notasCliente}
              onChange={(e) => setNotasCliente(e.target.value)}
              placeholder="Info permanente del cliente: preferencias, instrucciones especiales, etc."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleGuardar}
            disabled={isSaving}
            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isSaving ? "Guardando..." : "Guardar datos del cliente"}
          </button>
          {tieneCliente && (
            <button
              onClick={handleCancelar}
              className="py-2 px-3 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
