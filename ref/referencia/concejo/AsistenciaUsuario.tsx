'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { format, parseISO, differenceInMinutes, getHours } from 'date-fns';
import { es } from 'date-fns/locale';
import Swal from 'sweetalert2';
import { AnimatePresence } from 'framer-motion';
import { MapPin } from 'lucide-react';

import { useAsistenciaAgendaUsuario } from '@/hooks/agenda/useAsistenciaAgenda';
import { marcarAsistenciaAgenda } from '@/components/concejo/agenda/lib/acciones';
import { useObtenerUbicacion } from '@/hooks/ubicacion/useObtenerUbicacion';
import useFechaHora from '@/hooks/utility/useFechaHora';
import { AgendaConcejo } from '@/components/concejo/agenda/lib/esquemas';
import Mapa from '@/components/ui/modals/Mapa'; 

interface AsistenciaAgendaProps {
  agenda: AgendaConcejo;
  userId: string;
  nombreUsuario: string;
  puesto: string;
  onAsistenciaMarcada?: () => void;
}

const calcularDuracion = (entradaDate: string, salidaDate: string) => {
  const diff = new Date(salidaDate).getTime() - new Date(entradaDate).getTime();
  if (diff < 0) return null;
  let minutos = Math.floor(diff / 60000);
  let horas = Math.floor(minutos / 60);
  minutos = minutos % 60;
  const parts = [];
  if (horas > 0) parts.push(`${horas}h`);
  if (minutos > 0) parts.push(`${minutos}m`);
  return parts.join(' ') || "0m";
};

const formatTime = (dateString: string | undefined) => 
  dateString ? format(new Date(dateString), 'h:mm a', { locale: es }) : '--:--';

export default function AsistenciaUsuario({ agenda, userId, nombreUsuario, puesto, onAsistenciaMarcada }: AsistenciaAgendaProps) {
  const { cargando: cargandoGeo, obtenerUbicacion } = useObtenerUbicacion();
  const fechaHoraGt = useFechaHora();
  const { registros, loading: cargandoRegistros, fetchRegistros } = useAsistenciaAgendaUsuario(userId, agenda.id);

  const [cargandoMarcaje, setCargandoMarcaje] = useState(false);
  const [isMapaOpen, setIsMapaOpen] = useState(false);

  const registrosDeLaAgenda = useMemo(() => {
    const registroEntrada = registros.find(r => r.tipo_registro === 'Entrada') || null;
    const registroSalida = registros.find(r => r.tipo_registro === 'Salida') || null;
    return { registroEntrada, registroSalida };
  }, [registros]);

  const { registroEntrada, registroSalida } = registrosDeLaAgenda;
  const entradaMarcada = !!registroEntrada;
  const salidaMarcada = !!registroSalida;
  const asistenciaCompleta = entradaMarcada && salidaMarcada;

  const duracion = useMemo(() => {
    if (registroEntrada && registroSalida) {
      return calcularDuracion(registroEntrada.created_at, registroSalida.created_at);
    }
    return null;
  }, [registroEntrada, registroSalida]);

  const normalizarRegistro = (registro: any) => {
    if (!registro) return null;
    let ubicacionCorregida = registro.ubicacion;
    if (ubicacionCorregida && ubicacionCorregida.latitude !== undefined) {
        ubicacionCorregida = {
            lat: ubicacionCorregida.latitude,
            lng: ubicacionCorregida.longitude
        };
    }
    return {
        ...registro,
        ubicacion: ubicacionCorregida
    };
  };

  const fechaReunion = parseISO(agenda.fecha_reunion);
  const horaReunion = getHours(fechaReunion);
  const toleranciaMinutos = horaReunion < 9 ? 30 : 15;
  const diffMinutes = differenceInMinutes(fechaHoraGt, fechaReunion);
  const esTarde = diffMinutes > toleranciaMinutos;

  const handleIniciarMarcado = async (tipo: 'Entrada' | 'Salida') => {
    const fechaActual = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy - h:mm a", { locale: es });
    let notaAutomatica = '';
    let tituloSwal = `Marcar ${tipo}`;
    let textoSwal = `¿Confirme si desea marcar su ${tipo.toLowerCase()} ahora?`;
    let iconoSwal: 'question' | 'warning' = 'question';
    let confirmColor = '#3085d6';

    if (tipo === 'Entrada' && esTarde) {
      notaAutomatica = 'SIN DERECHO A DIETA';
      tituloSwal = 'Entrada Tardía - Sin Dieta';
      textoSwal = `Ha excedido el tiempo de ${toleranciaMinutos} minutos. Por reglamento, su asistencia quedará registrada SIN DERECHO A DIETA.`;
      iconoSwal = 'warning';
      confirmColor = '#d33';
    }

    const { isConfirmed } = await Swal.fire({
      title: tituloSwal,
      html: `
        <div class="text-sm text-gray-600 mb-4">
          ${fechaActual}
        </div>
        <p>${textoSwal}</p>
      `,
      icon: iconoSwal,
      showCancelButton: true,
      confirmButtonText: `Sí, marcar`,
      confirmButtonColor: confirmColor,
      cancelButtonText: 'Cancelar',
    });

    if (!isConfirmed) return;

    const coords = await obtenerUbicacion();

    if (coords) {
      setCargandoMarcaje(true);
      const registro = await marcarAsistenciaAgenda(userId, agenda.id, tipo, coords, notaAutomatica);
      if (registro) {
        Swal.fire('¡Éxito!', 'Marcaje registrado.', 'success');
        fetchRegistros();
        if (onAsistenciaMarcada) onAsistenciaMarcada();
      } else {
        Swal.fire('Error', 'No se pudo realizar el marcaje.', 'error');
      }
      setCargandoMarcaje(false);
    } else {
      Swal.fire('Error GPS', 'No se pudo obtener ubicación.', 'error');
    }
  };

  if (cargandoRegistros) {
    return <div className="animate-pulse h-14 bg-gray-200 dark:bg-neutral-800 rounded-lg w-full border border-gray-300 dark:border-neutral-700"></div>;
  }

  return (
    <>
      <div 
        onClick={() => setIsMapaOpen(true)}
        className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-gray-300 dark:border-neutral-800 rounded-lg px-4 py-3 bg-white dark:bg-neutral-900 shadow-sm mb-4 md:mb-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
      >
          
          <div className="flex flex-col text-center md:text-left">
              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">{nombreUsuario}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium tracking-wide">{puesto}</span>
          </div>

          <div className="w-full md:w-auto flex justify-center md:justify-end">
              {asistenciaCompleta ? (
                  <div className="flex flex-row items-center justify-center gap-3 text-xs bg-slate-50 dark:bg-neutral-950/50 px-4 py-3 rounded-md border border-slate-200 dark:border-neutral-800 w-full md:w-auto">
                      <span className="whitespace-nowrap text-green-600 dark:text-green-400">
                          <span className='font-bold'>Entrada:</span> {formatTime(registroEntrada?.created_at)}
                      </span>
                      <span className="whitespace-nowrap border-slate-300 dark:border-neutral-700 pl-3 text-red-500 dark:text-red-400">
                          <span className='font-bold'>Salida:</span> {formatTime(registroSalida?.created_at)}
                      </span>
                      <span className="whitespace-nowrap border-slate-300 dark:border-neutral-700 pl-3 text-blue-500 dark:text-blue-400">
                          <span className='font-bold'>Duración:</span> {duracion}
                      </span>
                  </div>
              ) : (
                  <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                      {entradaMarcada && (
                          <span className="text-xs font-mono text-green-800 dark:text-green-300 whitespace-nowrap bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded border border-green-200 dark:border-green-800 w-full md:w-auto text-center shadow-sm">
                              Entrada: <b>{formatTime(registroEntrada?.created_at)}</b>
                          </span>
                      )}
                      
                      {!entradaMarcada ? (
                          <Button 
                              onClick={(e) => {
                                e.stopPropagation(); 
                                handleIniciarMarcado('Entrada');
                              }} 
                              disabled={cargandoMarcaje || cargandoGeo} 
                              size="sm"
                              className={`w-full md:w-auto uppercase font-bold text-sm h-10 px-6 flex items-center justify-center gap-2 ${
                                  esTarde 
                                  ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white' 
                                  : 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white'
                              }`}
                          >
                              {cargandoGeo && <MapPin className="animate-bounce h-4 w-4" />}
                              {cargandoGeo ? 'GPS...' : (esTarde ? 'MARCAR ENTRADA TARDE' : 'MARCAR ENTRADA')}
                          </Button>
                      ) : (
                          <Button 
                              onClick={(e) => {
                                e.stopPropagation(); 
                                handleIniciarMarcado('Salida');
                              }} 
                              disabled={cargandoMarcaje || salidaMarcada || cargandoGeo} 
                              size="sm"
                              className="w-full md:w-auto uppercase font-bold text-sm bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white h-10 px-6 flex items-center justify-center gap-2"
                          >
                              {cargandoGeo && <MapPin className="animate-bounce h-4 w-4" />}
                              {cargandoGeo ? 'GPS...' : 'MARCAR SALIDA'}
                          </Button>
                      )}
                  </div>
              )}
          </div>
      </div>

      <AnimatePresence>
        {isMapaOpen && (
          <Mapa
            isOpen={isMapaOpen}
            onClose={() => setIsMapaOpen(false)}
            registros={{ 
                entrada: normalizarRegistro(registroEntrada), 
                salida: normalizarRegistro(registroSalida),
                multiple: undefined 
            }}
            nombreUsuario={nombreUsuario}
            titulo="Concejo Municipal"
          />
        )}
      </AnimatePresence>
    </>
  );
}