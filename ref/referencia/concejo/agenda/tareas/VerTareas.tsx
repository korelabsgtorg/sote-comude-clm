'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import useUserData from '@/hooks/sesion/useUserData';
import { fetchTareasDeAgenda, fetchAgendaConcejoPorId, actualizarEstadoAgenda, obtenerPuestoUsuario, fetchConteoDocumentosDeAgenda } from '@/components/concejo/agenda/lib/acciones';
import { Tarea, AgendaConcejo } from '@/components/concejo/agenda/lib/esquemas';
import TareaForm from './forms/tareas/Tarea';
import NotaSeguimiento from './forms/NotaSeguimiento';
import ActividadesAsignadas from './modals/ActividadesAsignadas';
import DocumentosModal from './modals/DocumentosModal'; 
import { obtenerActividadesDeAgenda } from './lib/actividades';
import Asistencia from './Asistencia';
import { AnimatePresence, motion } from 'framer-motion';
import CargandoAnimacion from '@/components/ui/animations/Cargando';
import Tabla from './Tabla';
import HeaderAgenda from './HeaderAgenda';
import TabsYFiltros from './TabsYFiltros';
import { format, subMinutes, isAfter } from 'date-fns';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { createClient } from '@/utils/supabase/client'; 

const calcularResumenDeEstados = (tareas: Tarea[]) => {
  const resumen: Record<string, number> = {};
  tareas.forEach(tarea => {
    const estado = tarea.estado;
    resumen[estado] = (resumen[estado] || 0) + 1;
  });
  return resumen;
};

const estadoOrden = ['En progreso', 'En espera', 'No aprobado', 'Aprobado', 'En comisión', 'No iniciado', 'Realizado'];

export default function VerTareas() {
  const params = useParams();
  const agendaId = params.id as string;
  const { rol, userId, nombre, cargando: cargandoUsuario } = useUserData();
  const supabase = createClient();

  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargandoTareas, setCargandoTareas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Tarea | null>(null);
  
  const [isDocumentosModalOpen, setIsDocumentosModalOpen] = useState(false);
  const [tareaParaDocumentos, setTareaParaDocumentos] = useState<Tarea | null>(null);

  const [agenda, setAgenda] = useState<AgendaConcejo | null>(null);
  const [filtrosActivos, setFiltrosActivos] = useState<string[]>([]);
  const [isNotaSeguimientoModalOpen, setIsNotaSeguimientoModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'notas' | 'seguimiento' | null>(null);
  const [isActividadesModalOpen, setIsActividadesModalOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [nombrePuesto, setNombrePuesto] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'agenda' | 'asistencia'>('agenda');
  const [puedeMarcarAsistencia, setPuedeMarcarAsistencia] = useState(false);
  const [mostrarAvisoAsistencia, setMostrarAvisoAsistencia] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const adjuntarActividades = (
    listaTareas: Tarea[],
    actividadesPorTarea: Record<string, Tarea['actividades']>
  ): Tarea[] => listaTareas.map((t) => ({ ...t, actividades: actividadesPorTarea[t.id] || [] }));

  const adjuntarConteoDocumentos = (
    listaTareas: Tarea[],
    conteos: Record<string, number>
  ): Tarea[] => listaTareas.map((t) => ({ ...t, total_documentos: conteos[t.id] || 0 }));

  const fetchDatos = async () => {
    if (!agendaId) return;
    try {
      const [dataTareas, dataAgenda, dataActividades, conteoDocumentos] = await Promise.all([
        fetchTareasDeAgenda(agendaId),
        fetchAgendaConcejoPorId(agendaId),
        obtenerActividadesDeAgenda(agendaId),
        fetchConteoDocumentosDeAgenda(agendaId),
      ]);
      setTareas(adjuntarConteoDocumentos(adjuntarActividades(dataTareas, dataActividades), conteoDocumentos));
      setAgenda(dataAgenda);
    } catch (e: any) {
      setError('Ocurrió un error al cargar los datos.');
    } finally {
      setCargandoTareas(false);
    }
  };

  const refreshTareasOnly = async () => {
     try {
        const [dataTareas, dataActividades, conteoDocumentos] = await Promise.all([
          fetchTareasDeAgenda(agendaId),
          obtenerActividadesDeAgenda(agendaId),
          fetchConteoDocumentosDeAgenda(agendaId),
        ]);
        setTareas(adjuntarConteoDocumentos(adjuntarActividades(dataTareas, dataActividades), conteoDocumentos));
     } catch (e) {
        console.error("Error actualizando tareas en tiempo real", e);
     }
  };

  useEffect(() => {
    fetchDatos();

    const channel = supabase
      .channel(`agenda_completa_${agendaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agenda_concejo',
          filter: `id=eq.${agendaId}`,
        },
        async (payload) => {
          const nuevaAgenda = payload.new as AgendaConcejo;
          setAgenda(nuevaAgenda);
          
          if (nuevaAgenda.estado === 'Finalizada') {
             toast.warning('La sesión ha sido finalizada.');
             setPuedeMarcarAsistencia(false);
             setMostrarAvisoAsistencia(false);
          } else if (nuevaAgenda.estado === 'En progreso') {
             toast.info('La sesión está En progreso.');
             setPuedeMarcarAsistencia(true);
          } 

          await fetchDatos();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'tareas_concejo',
          filter: `agenda_concejo_id=eq.${agendaId}`,
        },
        async () => {
          await refreshTareasOnly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agendaId, supabase]);

  useEffect(() => {
    const getPuesto = async () => {
      if (userId) {
        const nombrePuesto = await obtenerPuestoUsuario(userId);
        setNombrePuesto(nombrePuesto);
      }
    };
    getPuesto();
  }, [userId]);

  useEffect(() => {
    if (!agenda) return;

    const verificarTiempoAsistencia = () => {
      const ahora = new Date();
      const fechaReunion = new Date(agenda.fecha_reunion);
      const tiempoHabilitacion = subMinutes(fechaReunion, 15);
      
      const esTiempoValido = isAfter(ahora, tiempoHabilitacion);
      const estaEnProgreso = agenda.estado === 'En progreso';
      const estaEnPreparacion = agenda.estado === 'En preparación';
      const estaFinalizada = agenda.estado === 'Finalizada';

      if (estaFinalizada) {
        setPuedeMarcarAsistencia(false);
        setMostrarAvisoAsistencia(false);
        return;
      }

      if (estaEnProgreso) {
        setPuedeMarcarAsistencia(true);
        setMostrarAvisoAsistencia(false);
      } else if (estaEnPreparacion) {
        if (esTiempoValido) {
          setPuedeMarcarAsistencia(true);
          setMostrarAvisoAsistencia(false);
        } else {
          setPuedeMarcarAsistencia(false);
          setMostrarAvisoAsistencia(true);
        }
      }
    };

    verificarTiempoAsistencia();
    const intervalo = setInterval(verificarTiempoAsistencia, 30000);
    return () => clearInterval(intervalo);
  }, [agenda]);

  const generatePdf = async () => {
      setIsPrinting(true);
      const element = printRef.current;
      const isMobile = window.innerWidth < 768;

      if (!element) {
          toast.error('No se pudo encontrar el elemento para imprimir.');
          setIsPrinting(false);
          return;
      }

      try {
          const dataUrl = await htmlToImage.toJpeg(element, {
              quality: 0.7,
              backgroundColor: '#ffffff'
          });

          const pdf = new jsPDF({
              orientation: 'landscape',
              unit: 'in',
              format: [8.5, 13]
          });

          const margin = { top: 0.7, right: 0.5, bottom: 0.2, left: 0.5 };
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const usableWidth = pdfWidth - margin.left - margin.right;
          const usableHeight = pdfHeight - margin.top - margin.bottom;

          const img = new Image();
          img.src = dataUrl;

          img.onload = () => {
              const imgWidth = img.width;
              const imgHeight = img.height;
              
              let newWidth = imgWidth;
              let newHeight = imgHeight;

              const widthRatio = usableWidth / imgWidth;
              const heightRatio = usableHeight / imgHeight;
              const scale = Math.min(widthRatio, heightRatio);

              newWidth = imgWidth * scale;
              newHeight = imgHeight * scale;

              pdf.addImage(img, 'JPEG', (pdfWidth - newWidth) / 2, margin.top, newWidth, newHeight);

              if (isMobile) {
                  const filename = `agenda-${format(new Date(), 'yyyyMMdd')}.pdf`;
                  pdf.save(filename);
                  toast.success('PDF descargado.');
              } else {
                  const blobUrl = pdf.output('bloburl');
                  window.open(blobUrl, '_blank');
                  toast.success('PDF abierto en una nueva pestaña.');
              }
              
              setIsPrinting(false);
          };
      } catch (err) {
          toast.error('Hubo un error al generar el PDF.');
          console.error(err);
          setIsPrinting(false);
      }
  };

  useEffect(() => {
    if (isPrinting) {
      setTimeout(generatePdf, 300);
    }
  }, [isPrinting]);

  const handleGeneratePdf = () => {
    setIsPrinting(true);
  };

  const isAgendaFinalizada = agenda?.estado === 'Finalizada';

  const handleOpenEditModal = (tarea: Tarea) => {
    if (rol === 'INVITADO' || rol === 'ALCALDE') {
      toast.info('No tiene permisos para editar.');
      return; 
    }
    if (isAgendaFinalizada) {
      toast.info('No se pueden editar puntos de una agenda finalizada.');
    } else {
      setTareaSeleccionada(tarea);
      setIsFormModalOpen(true);
    }
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setTareaSeleccionada(null);
  };

  const handleOpenDocumentosModal = (tarea: Tarea) => {
    setTareaParaDocumentos(tarea);
    setIsDocumentosModalOpen(true);
  };

  const handleCloseDocumentosModal = async () => {
    setIsDocumentosModalOpen(false);
    setTareaParaDocumentos(null);
    try {
      const conteoDocumentos = await fetchConteoDocumentosDeAgenda(agendaId);
      setTareas((prev) => adjuntarConteoDocumentos(prev, conteoDocumentos));
    } catch (e) {
      console.error('Error actualizando conteo de documentos', e);
    }
  };

  const handleOpenNotasModal = (tarea: Tarea) => {
    setTareaSeleccionada(tarea);
    setModalType('notas');
    setIsNotaSeguimientoModalOpen(true);
  };

  const handleOpenActividadesModal = (tarea: Tarea) => {
    if (rol === 'INVITADO' || rol === 'ALCALDE') {
      toast.info('No tiene permisos para gestionar actividades.');
      return;
    }
    setTareaSeleccionada(tarea);
    setIsActividadesModalOpen(true);
  };

  const handleCloseActividadesModal = (hasChanged: boolean) => {
    setIsActividadesModalOpen(false);
    setTareaSeleccionada(null);
    if (hasChanged) fetchDatos();
  };

  const handleCloseNotaSeguimientoModal = (hasChanged: boolean) => {
    setIsNotaSeguimientoModalOpen(false);
    setTareaSeleccionada(null);
    setModalType(null);
    if (hasChanged) fetchDatos();
  };

  const handleActualizarEstadoAgenda = async () => {
    if (!agenda) return;
    if (isAgendaFinalizada && rol !== 'SUPER') return;

    let nuevoEstado = '';
    let mensajeHtml = '';

    if (agenda.estado === 'En preparación') {
      nuevoEstado = 'En progreso';
      mensajeHtml = '¿Está todo listo para aperturar la sesión?';
    } else if (agenda.estado === 'En progreso') {
      nuevoEstado = 'Finalizada';
      mensajeHtml = `
        <div style="text-align: left;">
          <p>¿Está seguro de que deseas cerrar la sesión?</p>
          <br/>
          <p style="color: #d33; font-weight: bold; background-color: #fee2e2; padding: 10px; border-radius: 6px; border: 1px solid #fecaca;">
            ⚠️ ADVERTENCIA: Asegúrese de que todos los miembros del concejo hayan marcado su asistencia antes de continuar.
          </p>
          <br/>
          <p style="font-size: 0.9em; color: #555;">
            Al finalizar, ya no se podrán registrar asistencias ni editar la agenda.
          </p>
        </div>
      `;
    } else if (agenda.estado === 'Finalizada' && rol === 'SUPER') {
      nuevoEstado = 'En progreso';
      mensajeHtml = `
        <div style="text-align: left;">
          <p>¿Deseas <b>REAPERTURAR</b> la sesión?</p>
          <br/>
          <p style="font-size: 0.9em; color: #555;">
             Esto volverá a habilitar el marcado de asistencia y la edición de puntos.
          </p>
        </div>
      `;
    }

    if (!nuevoEstado) return;

    const { isConfirmed } = await Swal.fire({
      title: 'Confirmar acción', 
      html: mensajeHtml, 
      icon: 'warning', 
      showCancelButton: true,
      confirmButtonColor: '#3085d6', 
      cancelButtonColor: '#d33', 
      confirmButtonText: 'Continuar', 
      cancelButtonText: 'Cancelar',
    });

    if (isConfirmed) {
      try {
        await actualizarEstadoAgenda(agenda.id, nuevoEstado);
        
        setAgenda({ ...agenda, estado: nuevoEstado });
        fetchDatos();

        if (nuevoEstado === 'En progreso') {
           toast.success(agenda.estado === 'Finalizada' ? 'Sesión reaperturada.' : 'Sesión aperturada correctamente.');
        } else if (nuevoEstado === 'Finalizada') {
           toast.success('Sesión finalizada correctamente.');
        }

      } catch (error) {
        toast.error('Error al actualizar el estado de la agenda.');
      }
    }
  };

  const toggleFiltro = (estado: string) => {
    setFiltrosActivos(prev => prev.includes(estado) ? prev.filter(f => f !== estado) : [...prev, estado]);
  };

  const tareasFiltradas = filtrosActivos.length > 0 ? tareas.filter(tarea => filtrosActivos.includes(tarea.estado)) : tareas;
  const resumenDeEstados = calcularResumenDeEstados(tareas);

  if (cargandoUsuario || cargandoTareas) {
    return <div className="text-xs lg:text-base"><CargandoAnimacion texto="Cargando agenda..." /></div>;
  }
  if (error) {
    return <div className="text-center text-red-500 dark:text-red-400 text-xs lg:text-base">{error}</div>;
  }

  return (
    <div className="px-2 mt-2 md:px-8 text-xs lg:text-base text-gray-900 dark:text-gray-100 transition-colors">
      <div ref={printRef}>
        <HeaderAgenda 
          agenda={agenda}
          rol={rol}
          userId={userId}
          nombreUsuario={nombre}
          nombrePuesto={nombrePuesto}
          puedeMarcarAsistencia={puedeMarcarAsistencia}
          mostrarAvisoAsistencia={mostrarAvisoAsistencia}
          isPrinting={isPrinting}
          isAgendaFinalizada={!!isAgendaFinalizada}
          handleGeneratePdf={handleGeneratePdf}
          handleActualizarEstadoAgenda={handleActualizarEstadoAgenda}
          handleNuevoPunto={() => { setTareaSeleccionada(null); setIsFormModalOpen(true); }}
        />

        {agenda && (
          <TabsYFiltros 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            filtrosActivos={filtrosActivos}
            toggleFiltro={toggleFiltro}
            clearFiltros={() => setFiltrosActivos([])}
            resumenDeEstados={resumenDeEstados}
            estadoOrden={estadoOrden}
          />
        )}

        <AnimatePresence mode="wait">
            {activeTab === 'agenda' ? (
                <motion.div 
                    key="agenda"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    <Tabla 
                      rol={rol} 
                      tareas={tareasFiltradas} 
                      handleOpenEditModal={handleOpenEditModal} 
                      handleOpenNotasModal={handleOpenNotasModal} 
                      handleOpenActividadesModal={handleOpenActividadesModal} 
                      handleOpenDocumentosModal={handleOpenDocumentosModal}
                      estadoAgenda={agenda?.estado || ''} 
                    />
                </motion.div>
            ) : (
                <motion.div 
                    key="asistencia"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    <Asistencia agendaId={agendaId} rol={rol}/>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isFormModalOpen && (
          <TareaForm isOpen={isFormModalOpen} onClose={handleCloseFormModal} onSave={async () => { await fetchDatos(); handleCloseFormModal(); }} agendaConcejoId={agendaId} tareaAEditar={tareaSeleccionada} />
        )}
        {isNotaSeguimientoModalOpen && tareaSeleccionada && modalType && (
          <NotaSeguimiento isOpen={isNotaSeguimientoModalOpen} onClose={handleCloseNotaSeguimientoModal} tarea={tareaSeleccionada} estadoAgenda={agenda?.estado || ''} tipo={modalType} />
        )}
        {isActividadesModalOpen && tareaSeleccionada && (
          <ActividadesAsignadas
            isOpen={isActividadesModalOpen}
            onClose={handleCloseActividadesModal}
            tarea={tareaSeleccionada}
            puedeEditar={['SUPER', 'SECRETARIO', 'SEC-TECNICO'].includes(rol)}
          />
        )}
        {isDocumentosModalOpen && tareaParaDocumentos && (
          <DocumentosModal 
            isOpen={isDocumentosModalOpen}
            onClose={handleCloseDocumentosModal}
            tarea={tareaParaDocumentos}
            rol={rol}
            estadoAgenda={agenda?.estado || ''}
          />
        )}
      </AnimatePresence>
    </div>
  );
}