"use client";

import { useState, useEffect, useMemo } from "react";
import {
  fetchAsistenciaGlobalAgenda,
  fetchAgendaConcejoPorId,
  actualizarRemunerado,
} from "./acciones";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import {
  User,
  MapPin,
  Clock,
  CalendarClock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import CargandoAnimacion from "@/components/ui/animations/Cargando";
import { AnimatePresence } from "framer-motion";
import Mapa from "@/components/ui/modals/Mapa";
import { createClient } from "@/utils/supabase/client";
import { toast } from "react-toastify";

interface RegistroRaw {
  id: string;
  created_at: string;
  tipo_registro: "Entrada" | "Salida";
  ubicacion: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  } | null;
  notas?: string;
  remunerado?: boolean;
  usuarios: {
    id: string;
    nombre: string;
    puesto: string;
  };
}

interface UsuarioAsistencia {
  userId: string;
  nombre: string;
  puesto: string;
  entrada: string | null;
  salida: string | null;
  coordsEntrada: { lat: number; lng: number } | null;
  coordsSalida: { lat: number; lng: number } | null;
  duracion: string;
  estado: "Presente" | "Finalizado" | "Sin Salida";
  remunerado: boolean;
  registroEntradaCompleto?: any;
  registroSalidaCompleto?: any;
}

interface AgendaConcejoData {
  id: string;
  inicio: string | null;
  fin: string | null;
  estado: string;
  fecha_reunion: string;
}

const parsearHora = (horaStr: string | null, fechaBaseStr: string) => {
  if (!horaStr) return null;
  if (horaStr.includes("T")) return new Date(horaStr);
  try {
    const fechaISO = `${fechaBaseStr.split("T")[0]}T${horaStr}`;
    return new Date(fechaISO);
  } catch (e) {
    return null;
  }
};

const obtenerPesoCargo = (cargo: string): number => {
  const c = (cargo || "").toUpperCase().trim();

  if (c.includes("ALCALDE")) return 1;

  if (/SINDICO\s+(I|1|PRIMERO)\b/.test(c)) return 2;
  if (/SINDICO\s+(II|2|SEGUNDO)\b/.test(c)) return 3;
  if (/SINDICO\s+(III|3|TERCERO)\b/.test(c)) return 4;
  if (c.includes("SINDICO SUPLENTE")) return 5;

  if (/CONCEJAL\s+(I|1|PRIMERO)\b/.test(c)) return 10;
  if (/CONCEJAL\s+(II|2|SEGUNDO)\b/.test(c)) return 11;
  if (/CONCEJAL\s+(III|3|TERCERO)\b/.test(c)) return 12;
  if (/CONCEJAL\s+(IV|4|CUARTO)\b/.test(c)) return 13;
  if (/CONCEJAL\s+(V|5|QUINTO)\b/.test(c)) return 14;
  if (/CONCEJAL\s+(VI|6|SEXTO)\b/.test(c)) return 15;
  if (/CONCEJAL\s+(VII|7|SEPTIMO)\b/.test(c)) return 16;
  if (/CONCEJAL\s+(VIII|8|OCTAVO)\b/.test(c)) return 17;
  if (/CONCEJAL\s+(IX|9|NOVENO)\b/.test(c)) return 18;
  if (/CONCEJAL\s+(X|10|DECIMO)\b/.test(c)) return 19;

  if (
    /PRIMER\s+CONCEJAL\s+SUPLENTE/.test(c) ||
    /CONCEJAL\s+SUPLENTE\s+(I|1|PRIMERO)/.test(c)
  )
    return 30;
  if (
    /SEGUNDO\s+CONCEJAL\s+SUPLENTE/.test(c) ||
    /CONCEJAL\s+SUPLENTE\s+(II|2|SEGUNDO)/.test(c)
  )
    return 31;
  if (
    /TERCER\s+CONCEJAL\s+SUPLENTE/.test(c) ||
    /CONCEJAL\s+SUPLENTE\s+(III|3|TERCERO)/.test(c)
  )
    return 32;

  if (c.includes("CONCEJAL SUPLENTE")) return 39;

  if (c.includes("SECRETARIO")) return 99;

  return 100;
};

export default function Asistencia({
  agendaId,
  rol,
}: {
  agendaId: string;
  rol: string;
}) {
  const supabase = createClient();

  const [registros, setRegistros] = useState<RegistroRaw[]>([]);
  const [agendaData, setAgendaData] = useState<AgendaConcejoData | null>(null);
  const [cargando, setCargando] = useState(true);

  const [modalMapaOpen, setModalMapaOpen] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] =
    useState<UsuarioAsistencia | null>(null);

  const permisoEdicion = ["SECRETARIO", "ADMIN", "SUPER"].some((r) =>
    rol.toUpperCase().includes(r),
  );

  const cargarDatos = async () => {
    try {
      const [dataAsistencia, dataAgenda] = await Promise.all([
        fetchAsistenciaGlobalAgenda(agendaId),
        fetchAgendaConcejoPorId(agendaId),
      ]);

      setRegistros(dataAsistencia as any);
      setAgendaData(dataAgenda as any);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    const channel = supabase
      .channel(`vista_asistencia_global_${agendaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registros_agenda",
          filter: `agenda_id=eq.${agendaId}`,
        },
        () => cargarDatos(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agenda_concejo",
          filter: `id=eq.${agendaId}`,
        },
        () => cargarDatos(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agendaId]);

  const infoSesion = useMemo(() => {
    if (!agendaData || !agendaData.fecha_reunion)
      return { duracion: "-", inicio: "-", fin: "-" };

    const fechaInicio = parsearHora(
      agendaData.inicio,
      agendaData.fecha_reunion,
    );
    const fechaFin = parsearHora(agendaData.fin, agendaData.fecha_reunion);

    const inicioFmt = fechaInicio
      ? format(fechaInicio, "h:mm a", { locale: es })
      : "--:--";

    const finFmt = fechaFin
      ? format(fechaFin, "h:mm a", { locale: es })
      : agendaData.estado === "En progreso"
        ? "En curso"
        : "--:--";

    let duracion = "-";
    if (fechaInicio) {
      const start = fechaInicio;
      const end = fechaFin ? fechaFin : new Date();
      const diff = differenceInMinutes(end, start);
      if (diff >= 0) {
        const horas = Math.floor(diff / 60);
        const mins = diff % 60;
        duracion = `${horas}h ${mins}m`;
      }
    }

    return { inicio: inicioFmt, fin: finFmt, duracion };
  }, [agendaData]);

  const asistenciaProcesada = useMemo(() => {
    const mapa = new Map<string, UsuarioAsistencia>();

    registros.forEach((reg) => {
      const userId = reg.usuarios?.id;
      if (!userId) return;

      if (!mapa.has(userId)) {
        mapa.set(userId, {
          userId,
          nombre: reg.usuarios.nombre || "Desconocido",
          puesto: reg.usuarios.puesto || "Sin cargo",
          entrada: null,
          salida: null,
          coordsEntrada: null,
          coordsSalida: null,
          duracion: "--",
          estado: "Sin Salida",
          remunerado: reg.remunerado ?? false,
          registroEntradaCompleto: null,
          registroSalidaCompleto: null,
        });
      }

      const usuario = mapa.get(userId)!;

      let coords = { lat: 0, lng: 0 };
      if (reg.ubicacion) {
        const lat = reg.ubicacion.latitude ?? reg.ubicacion.lat ?? 0;
        const lng = reg.ubicacion.longitude ?? reg.ubicacion.lng ?? 0;
        coords = { lat, lng };
      }

      const registroNormalizado = {
        created_at: reg.created_at,
        tipo_registro: reg.tipo_registro,
        ubicacion: coords,
        notas: reg.notas,
      };

      if (reg.tipo_registro === "Entrada") {
        usuario.entrada = reg.created_at;
        usuario.coordsEntrada = coords;
        usuario.registroEntradaCompleto = registroNormalizado;
      } else if (reg.tipo_registro === "Salida") {
        usuario.salida = reg.created_at;
        usuario.coordsSalida = coords;
        usuario.registroSalidaCompleto = registroNormalizado;
      }

      if (reg.remunerado !== undefined && reg.remunerado !== null) {
        usuario.remunerado = reg.remunerado;
      }
    });

    const lista = Array.from(mapa.values());

    lista.forEach((u) => {
      if (u.entrada && u.salida) {
        const diff = differenceInMinutes(
          new Date(u.salida),
          new Date(u.entrada),
        );
        const horas = Math.floor(diff / 60);
        const mins = diff % 60;
        u.duracion = `${horas}h ${mins}m`;
        u.estado = "Finalizado";
      } else if (u.entrada && !u.salida) {
        u.estado = "Presente";
      }
    });

    return lista.sort((a, b) => {
      const pesoA = obtenerPesoCargo(a.puesto);
      const pesoB = obtenerPesoCargo(b.puesto);
      return pesoA - pesoB;
    });
  }, [registros]);

  const handleRowClick = (usuario: UsuarioAsistencia) => {
    setUsuarioSeleccionado(usuario);
    setModalMapaOpen(true);
  };

  const handleToggleRemunerado = async (
    userId: string,
    currentVal: boolean,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!permisoEdicion) return;

    const newVal = !currentVal;

    setRegistros((prev) =>
      prev.map((r) =>
        r.usuarios.id === userId ? { ...r, remunerado: newVal } : r,
      ),
    );

    const success = await actualizarRemunerado(agendaId, userId, newVal);

    if (success) {
      toast.success(
        newVal ? "Marcado como remunerado" : "Marcado como no remunerado",
        {
          style: {
            background: newVal ? "#16a34a" : "#dc2626",
            color: "#fff",
          },
        },
      );
    } else {
      setRegistros((prev) =>
        prev.map((r) =>
          r.usuarios.id === userId ? { ...r, remunerado: currentVal } : r,
        ),
      );
    }
  };

  if (cargando)
    return <CargandoAnimacion texto="Cargando lista de asistencia..." />;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-gray-100 dark:border-neutral-800 shadow-sm">
          <div className="flex flex-col w-full md:w-auto">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Asistencia y duración de la sesión
            </h3>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <Clock size={16} />
                <span className="font-bold">{infoSesion.inicio}</span>
              </div>
              <span className="text-gray-300 hidden md:inline">|</span>
              <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                <Clock size={16} />
                <span className="font-bold">{infoSesion.fin}</span>
              </div>
              <span className="text-gray-300 hidden md:inline">|</span>
              <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                <CalendarClock size={16} />
                <span className="font-bold">{infoSesion.duracion}</span>
              </div>
            </div>
          </div>
        </div>

        {asistenciaProcesada.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-300 dark:border-neutral-800 rounded-lg bg-gray-50 dark:bg-neutral-900">
            <User className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 mb-2" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Aún no hay registros de asistencia.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {asistenciaProcesada.map((usuario) => (
                <div
                  key={usuario.userId}
                  onClick={() => handleRowClick(usuario)}
                  className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-800 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="px-4 pt-3 pb-2 flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                        {usuario.nombre}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium tracking-wide">
                        {usuario.puesto}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {permisoEdicion ? (
                        <label className="inline-flex items-center cursor-pointer relative">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={usuario.remunerado}
                            onChange={(e) =>
                              handleToggleRemunerado(
                                usuario.userId,
                                usuario.remunerado,
                                e as any,
                              )
                            }
                          />
                          <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      ) : null}
                    </div>
                  </div>

                  <div className="px-4 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-neutral-950/50 px-3 py-2 rounded border border-slate-200 dark:border-neutral-800">
                      <span className="whitespace-nowrap text-green-600 dark:text-green-400">
                        <b>Entrada:</b>{" "}
                        {usuario.entrada
                          ? format(new Date(usuario.entrada), "h:mm a", {
                              locale: es,
                            })
                          : "-"}
                      </span>
                      <span className="whitespace-nowrap text-red-500 dark:text-red-400">
                        <b>Salida:</b>{" "}
                        {usuario.salida
                          ? format(new Date(usuario.salida), "h:mm a", {
                              locale: es,
                            })
                          : "-"}
                      </span>
                      <span className="whitespace-nowrap bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded font-bold">
                        Duración: {usuario.duracion}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-neutral-800 py-1.5 text-center border-t border-gray-100 dark:border-neutral-700">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1">
                      <MapPin className="h-3 w-3" /> Ver detalles
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Funcionario</th>
                      <th className="px-4 py-3 text-center">Entrada</th>
                      <th className="px-4 py-3 text-center">Salida</th>
                      <th className="px-4 py-3 text-center">Duración</th>
                      {permisoEdicion && (
                        <th className="px-4 py-3 text-center">Remunerado</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {asistenciaProcesada.map((usuario) => (
                      <tr
                        key={usuario.userId}
                        className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group"
                        onClick={() => handleRowClick(usuario)}
                        title="Ver ubicación en mapa"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                              {usuario.nombre}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              {usuario.puesto}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {usuario.entrada ? (
                            <div className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded text-xs font-medium border border-green-100 dark:border-green-800">
                              {format(new Date(usuario.entrada), "h:mm a", {
                                locale: es,
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600">
                              -
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {usuario.salida ? (
                            <div className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded text-xs font-medium border border-orange-100 dark:border-orange-800">
                              {format(new Date(usuario.salida), "h:mm a", {
                                locale: es,
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600 text-xs italic">
                              Pendiente
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-md font-semibold text-xs">
                            {usuario.duracion}
                          </span>
                        </td>

                        {permisoEdicion && (
                          <td
                            className="px-4 py-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-center">
                              <label className="inline-flex items-center cursor-pointer relative">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={usuario.remunerado}
                                  onChange={(e) =>
                                    handleToggleRemunerado(
                                      usuario.userId,
                                      usuario.remunerado,
                                      e as any,
                                    )
                                  }
                                />
                                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                              </label>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {modalMapaOpen && usuarioSeleccionado && (
          <Mapa
            isOpen={modalMapaOpen}
            onClose={() => setModalMapaOpen(false)}
            registros={{
              entrada: usuarioSeleccionado.registroEntradaCompleto || null,
              salida: usuarioSeleccionado.registroSalidaCompleto || null,
            }}
            nombreUsuario={usuarioSeleccionado.nombre}
            titulo="Sesión de Concejo"
          />
        )}
      </AnimatePresence>
    </>
  );
}
