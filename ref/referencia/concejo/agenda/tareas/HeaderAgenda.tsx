'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BotonVolver from '@/components/ui/botones/BotonVolver';
import AsistenciaUsuario from '@/components/concejo/AsistenciaUsuario';
import { AgendaConcejo } from '@/components/concejo/agenda/lib/esquemas';

interface HeaderAgendaProps {
  agenda: AgendaConcejo | null;
  rol: string;
  userId: string | null;
  nombreUsuario: string | null;
  nombrePuesto: string;
  puedeMarcarAsistencia: boolean;
  mostrarAvisoAsistencia: boolean;
  isPrinting: boolean;
  isAgendaFinalizada: boolean;
  handleGeneratePdf: () => void;
  handleActualizarEstadoAgenda: () => void;
  handleNuevoPunto: () => void;
}

export default function HeaderAgenda({
  agenda,
  rol,
  userId,
  nombreUsuario,
  nombrePuesto,
  puedeMarcarAsistencia,
  mostrarAvisoAsistencia,
  isPrinting,
  isAgendaFinalizada,
  handleGeneratePdf,
  handleActualizarEstadoAgenda,
  handleNuevoPunto
}: HeaderAgendaProps) {

  const getEstadoAgendaStyle = (estado: string) => {
    if (estado === 'En preparación') return 'bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500';
    if (estado === 'En progreso') return 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500';
    if (estado === 'Finalizada') {
      if (rol === 'SUPER') return 'bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500';
      return 'bg-gray-400 text-gray-800 cursor-not-allowed dark:bg-neutral-800 dark:text-gray-400';
    }
    return '';
  };

  const getEstadoAgendaText = (estado: string) => {
    if (estado === 'En preparación') return 'Se apertura la sesión';
    if (estado === 'En progreso') return 'Se cierra la sesión';
    if (estado === 'Finalizada') {
       if (rol === 'SUPER') return 'Reaperturar Sesión';
       return 'Sesión Finalizada';
    }
    return estado;
  };

  return (
    <div className="flex flex-col gap-2 mb-4 transition-colors">
      
      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
        
        <div className="flex-shrink-0 w-full md:w-auto">
          {!isPrinting && (
            <BotonVolver ruta="/protected/concejo/agenda" />
          )}
        </div>

        <div className="flex-1 w-full">
          {agenda && puedeMarcarAsistencia && userId && (
            <div className="w-full">
                <AsistenciaUsuario 
                    agenda={agenda} 
                    userId={userId} 
                    nombreUsuario={nombreUsuario || 'Usuario'} 
                    puesto={nombrePuesto}
                />
            </div>
          )}
        </div>

        {agenda && (
          <div className="flex-shrink-0 w-full md:w-auto flex flex-wrap items-center justify-center md:justify-end gap-2">
            
            {(rol === 'SUPER' || rol === 'SECRETARIO') && !isPrinting && (
              <Button 
                onClick={handleActualizarEstadoAgenda} 
                disabled={isAgendaFinalizada && rol !== 'SUPER'} 
                className={`px-5 py-2 rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto ${getEstadoAgendaStyle(agenda.estado)}`}
              >
                 <span className="text-sm lg:text-base font-medium">{getEstadoAgendaText(agenda.estado)}</span>
              </Button>
            )}

            {(rol === 'SUPER' || rol === 'SECRETARIO' || rol === 'SEC-TECNICO') && !isPrinting && !isAgendaFinalizada && (
                <Button 
                  onClick={handleNuevoPunto} 
                  className="px-5 py-2 rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2 bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-500 w-full sm:w-auto"
                >
                  <span className="text-sm lg:text-base font-medium">Nuevo Punto a tratar</span>                      
                </Button>
            )}

            {(rol === 'SUPER' || rol === 'SECRETARIO' || rol === 'SEC-TECNICO') && !isPrinting && isAgendaFinalizada && (
                <Button 
                  onClick={handleGeneratePdf} 
                  disabled={isPrinting} 
                  className="px-5 py-2 rounded-lg shadow-sm transition-colors flex items-center space-x-2 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 w-full md:w-auto"
                >
                  <FileText size={20} />
                  <span className="text-sm lg:text-base font-medium">Generar PDF</span>
                </Button>
            )}
          </div>
        )}
      </div>

      {agenda && mostrarAvisoAsistencia && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-500 px-3 rounded shadow-sm flex items-center justify-center md:justify-start w-full h-10 my-2">
            <Info className="w-5 h-5 mr-2 flex-shrink-0" />
            <p className="font-bold text-xs">La asistencia se podrá marcar 15 mins. antes de iniciar</p>
        </div>
      )}

      {agenda && (
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2 mx-auto w-full mt-2">
          <div className="flex-grow flex items-start text-left w-full">
            
            <div className="w-3/5 flex flex-col gap-2 pr-2">
              <h1 className="text-xs lg:text-lg font-bold text-gray-900 dark:text-gray-100">
                <span className="text-blue-600 dark:text-blue-400 block md:inline md:mr-1">
                  Agenda del Concejo Municipal:
                </span> 
                {agenda.titulo}
              </h1>
              <p className="text-xs lg:text-lg font-bold text-gray-900 dark:text-gray-100">
                <span className="text-blue-600 dark:text-blue-400 block md:inline md:mr-1">
                  Información:
                </span> 
                {agenda.descripcion}
              </p>
            </div>
            
            <div className="w-2/5 flex flex-col items-start gap-2 pl-1">
              <p className="text-xs lg:text-lg font-bold text-gray-900 dark:text-gray-100">
                <span className="text-blue-600 dark:text-blue-400 block md:inline md:mr-1">
                  Fecha:
                </span> 
                <span className="md:hidden capitalize">
                  {format(new Date(agenda.fecha_reunion), "EEE d 'de' MMM, yyyy", { locale: es })}
                </span>
                <span className="hidden md:inline">
                  {format(new Date(agenda.fecha_reunion), 'PPPP', { locale: es })}
                </span>
              </p>
              <p className="text-xs lg:text-lg font-bold text-gray-900 dark:text-gray-100">
                <span className="text-blue-600 dark:text-blue-400 block md:inline md:mr-1">
                  Hora:
                </span> 
                {format(new Date(agenda.fecha_reunion), 'h:mm a', { locale: es })}
              </p>
            </div>

          </div>
        </header>
      )}
    </div>
  );
}