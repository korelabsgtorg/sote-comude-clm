'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { crearAgenda, editarAgenda, getTodayDate } from '../lib/acciones';
import { type AgendaConcejo } from '../lib/esquemas';
import { parseISO, getHours, getMinutes, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { sesionSchema, type SesionFormData } from '../lib/esquemas';
import Calendario from '@/components/ui/Calendario';
import { obtenerDestinatariosClave } from '../lib/usuarios/notificaciones'; 

interface SesionProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  agendaAEditar?: AgendaConcejo | null;
}

const parseDescripcion = (descripcion: string) => {
  if (!descripcion) return { acta: '', libro: '' };
  const match = descripcion.match(/ACTA (.*), LIBRO (.*)/);
  if (match && match.length === 3) {
    return { acta: match[1], libro: match[2] };
  }
  return { acta: '', libro: '' };
};

const convert24to12 = (h24: number): { hora12: string; periodo: string } => {
  const periodo = h24 >= 12 ? 'PM' : 'AM';
  let hora12 = h24 % 12;
  if (hora12 === 0) hora12 = 12;
  return { hora12: String(hora12).padStart(2, '0'), periodo };
};

const convert12to24 = (hora12: string, periodo: string): string => {
  let h24 = parseInt(hora12, 10);
  if (periodo === 'PM' && h24 < 12) h24 += 12;
  if (periodo === 'AM' && h24 === 12) h24 = 0;
  return String(h24).padStart(2, '0');
};

export default function Sesion({ isOpen, onClose, onSave, agendaAEditar }: SesionProps) {
  const isEditMode = !!agendaAEditar;

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<SesionFormData>({
    resolver: zodResolver(sesionSchema),
    defaultValues: {
      titulo: '',
      descripcion: '',
      acta: '',
      libro: '',
      fecha_reunion: getTodayDate(),
      hora_reunion: '08:00',
    }
  });

  const [hora, setHora] = useState('08');
  const [minuto, setMinuto] = useState('00');
  const [periodo, setPeriodo] = useState('AM');

  const actaForm = watch('acta');
  const libroForm = watch('libro');

  useEffect(() => {
    if (actaForm && libroForm) {
      setValue('descripcion', `ACTA ${actaForm}, LIBRO ${libroForm}`);
    } else {
      setValue('descripcion', '');
    }
  }, [actaForm, libroForm, setValue]);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && agendaAEditar) {
        let { acta, libro } = parseDescripcion(agendaAEditar.descripcion);
        
        if (agendaAEditar.acta) acta = agendaAEditar.acta;
        if (agendaAEditar.libro) libro = agendaAEditar.libro;

        const fechaHoraDB = parseISO(agendaAEditar.fecha_reunion);
        const h24 = getHours(fechaHoraDB);
        const m = getMinutes(fechaHoraDB);

        const { hora12: newHora12, periodo: newPeriodo } = convert24to12(h24);

        reset({
          titulo: agendaAEditar.titulo,
          descripcion: agendaAEditar.descripcion,
          acta: acta,
          libro: libro,
          fecha_reunion: format(fechaHoraDB, 'yyyy-MM-dd'),
          hora_reunion: `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        });

        setHora(newHora12);
        setMinuto(String(m).padStart(2, '0'));
        setPeriodo(newPeriodo);
      } else {
        reset({
          titulo: '',
          descripcion: '',
          acta: '',
          libro: '',
          fecha_reunion: getTodayDate(),
          hora_reunion: '08:00',
        });
        setHora('08');
        setMinuto('00');
        setPeriodo('AM');
      }
    }
  }, [isOpen, reset, isEditMode, agendaAEditar]);

  const handleTimeChange = (newHour: string, newMinute: string, newPeriod: string) => {
    const h24 = convert12to24(newHour, newPeriod);
    const nuevaHoraForm = `${h24}:${newMinute}`;
    setValue('hora_reunion', nuevaHoraForm, { shouldValidate: true });

    setHora(newHour);
    setMinuto(newMinute);
    setPeriodo(newPeriod);
  };

  const onSubmit = async (formData: SesionFormData) => {
    const combinedFormData = {
      ...formData,
      fecha_reunion: `${formData.fecha_reunion}T${formData.hora_reunion}:00-06:00`,
    };

    const result = isEditMode
      ? await editarAgenda(agendaAEditar!.id, combinedFormData as any)
      : await crearAgenda(combinedFormData as any);

    if (result) {
      if (!isEditMode) {
        try {
          const targetIds = await obtenerDestinatariosClave();
          
          if (targetIds.length > 0) {
            const fechaObj = parseISO(formData.fecha_reunion);
            const fechaTexto = format(fechaObj, "EEEE d 'de' MMMM", { locale: es });
            const fechaCapitalizada = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);

            await fetch('/api/push/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: '💼 Nueva Sesión de Concejo',
                message: `Se ha programado la sesión: "${formData.titulo}" para el ${fechaCapitalizada}, a las ${hora}:${minuto} ${periodo}, haz clic para ver 🤳.`,
                url: `/protected/concejo/agenda`,
                targetIds: targetIds
              })
            });
          }
        } catch (error) {
          console.error("Error enviando notificaciones:", error);
        }
      }

      onSave();
      onClose();
    }
  };

  const selectClassName = "h-10 rounded-md border border-input bg-background dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 dark:bg-black/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transition-colors"
            initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
          >
            <div className="p-8">
              <div className="mb-6 border-b border-gray-200 dark:border-neutral-800 pb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {isEditMode ? 'Editar Sesión' : 'Nueva Sesión'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Complete la información para {isEditMode ? 'actualizar' : 'programar'} la reunión.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-neutral-950/50 rounded-lg border border-gray-200 dark:border-neutral-800">
                  <div>
                    <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
                    <Input 
                      id="titulo" 
                      {...register("titulo")} 
                      placeholder="Ej. Sesión Ordinaria de enero" 
                      className={`bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:placeholder:text-gray-500 ${errors.titulo ? 'border-red-500' : ''}`} 
                    />
                    {errors.titulo && <p className="text-sm text-red-500 mt-1">{errors.titulo.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="acta" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Acta</label>
                      <Input 
                        id="acta" 
                        {...register("acta")} 
                        placeholder="Ej. 1-2025" 
                        className={`bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:placeholder:text-gray-500 ${errors.acta ? 'border-red-500' : ''}`} 
                      />
                      {errors.acta && <p className="text-sm text-red-500 mt-1">{errors.acta.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="libro" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Libro</label>
                      <Input 
                        id="libro" 
                        {...register("libro")} 
                        placeholder="Ej. 01" 
                        className={`bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:placeholder:text-gray-500 ${errors.libro ? 'border-red-500' : ''}`} 
                      />
                      {errors.libro && <p className="text-sm text-red-500 mt-1">{errors.libro.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hora de la reunión</label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="text" 
                        value={hora} 
                        onChange={(e) => handleTimeChange(e.target.value, minuto, periodo)} 
                        className="w-20 text-center bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100" 
                      />
                      <span className="dark:text-gray-100">:</span>
                      <Input 
                        type="text" 
                        value={minuto} 
                        onChange={(e) => handleTimeChange(hora, e.target.value, periodo)} 
                        className="w-20 text-center bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100" 
                      />
                      <select 
                        value={periodo} 
                        onChange={(e) => handleTimeChange(hora, minuto, e.target.value)} 
                        className={selectClassName}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                    {errors.hora_reunion && <p className="text-sm text-red-500 mt-1">{errors.hora_reunion.message}</p>}
                  </div>

                  <div>
                   <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
                    <div className="dark:text-gray-100">
                        <Calendario 
                            fechaSeleccionada={watch('fecha_reunion')} 
                            onSelectDate={(date: string) => setValue('fecha_reunion', date, { shouldValidate: true })} 
                        />
                    </div>
                    {errors.fecha_reunion && <p className="text-sm text-red-500 mt-1">{errors.fecha_reunion.message}</p>}
                  </div>

                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose} 
                    className="w-1/2 bg-white hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-1/2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                  >
                    {isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Crear Sesión')}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}