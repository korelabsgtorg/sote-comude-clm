'use client';

import React, { Fragment, useEffect, useState, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tareaSchema, TareaFormData, CategoriaItem, Tarea as TareaType } from '../../../lib/esquemas';
import { crearTarea, editarTarea, eliminarTarea, fetchCategorias, fetchAgendaConcejoPorId } from '../../../lib/acciones';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Categorias from '../Categorias';
import Estado from './Estado';
import { X, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import useUserData from '@/hooks/sesion/useUserData';
import { obtenerDestinatariosClave } from '../../../lib/usuarios/notificaciones';

interface TareaProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  agendaConcejoId: string;
  tareaAEditar?: TareaType | null;
}

const statusStyles: Record<string, string> = {
  'Aprobado': 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50',
  'No aprobado': 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
  'En progreso': 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50',
  'En comisión': 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700',
  'En espera': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50',
  'No iniciado': 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700',
  'Realizado': 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50',
};

const votacionStyles: Record<string, string> = {
  'P1': 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
  'Unanimidad': 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50',
  'Ver Notas': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50',
  'Realizado': 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50',
  'No Emitido': 'bg-white text-gray-800 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700',
};

const getStatusClasses = (status: string) => statusStyles[status] || 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700';
const getVotacionClasses = (votacion: string) => votacionStyles[votacion] || 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700';

export default function Tarea({ isOpen, onClose, onSave, agendaConcejoId, tareaAEditar }: TareaProps) {
  const isEditing = !!tareaAEditar;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TareaFormData>({
    resolver: zodResolver(tareaSchema),
    defaultValues: isEditing && tareaAEditar ? {
      titulo_item: tareaAEditar.titulo_item,
      categoria_id: tareaAEditar.categoria?.id || '',
      estado: tareaAEditar.estado,
      votacion: tareaAEditar.votacion || '',
    } : {
      titulo_item: '',
      categoria_id: '',
      estado: 'No iniciado',
      votacion: 'No Emitido',
    },
  });

  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isEstadoModalOpen, setIsEstadoModalOpen] = useState(false);
  const [isVotacionModalOpen, setIsVotacionModalOpen] = useState(false);
  
  const { rol } = useUserData();

  useEffect(() => {
    async function loadCategorias() {
      const cats = await fetchCategorias();
      setCategorias(cats);
    }
    loadCategorias();
  }, []);

  const onSubmit = async (data: TareaFormData) => {
    try {
      if (isEditing && tareaAEditar) {
        await editarTarea(tareaAEditar.id, data);
      } else {
        await crearTarea(data, agendaConcejoId);
        
        try {
          const targetIds = await obtenerDestinatariosClave();
          
          if (targetIds.length > 0) {
            const agendaData = await fetchAgendaConcejoPorId(agendaConcejoId);
            const tituloAgenda = agendaData?.titulo || 'Agenda de Concejo';

            await fetch('/api/push/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: '📝 Nuevo Punto en Agenda',
                message: `Se ha agregado el punto: "${data.titulo_item}" a la sesion: "${tituloAgenda}", haz clic para ver 🤳.`,
                url: `/protected/concejo/agenda/${agendaConcejoId}`,
                targetIds: targetIds
              })
            });
          }
        } catch (error) {
          console.error("Error enviando notificaciones de tarea:", error);
        }
      }
      onSave();
      onClose();
    } catch (error) {
      console.error("Error al guardar la tarea:", error);
    }
  };

  const handleDelete = async () => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Está seguro?',
      text: "¡No podrá revertir esto!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
  
    if (isConfirmed && tareaAEditar) {
      await eliminarTarea(tareaAEditar.id);
      onSave();
      onClose();
    }
  };

  const categoriaIdValue = watch('categoria_id');
  const estadoValue = watch('estado');
  const votacionValue = watch('votacion');
  const categoriaSeleccionada = categorias.find(c => c.id === categoriaIdValue);
  
  const valoresActuales = watch();
  
  const tieneCambios = useMemo(() => {
    if (!isEditing || !tareaAEditar) return false;

    return (
      valoresActuales.titulo_item !== tareaAEditar.titulo_item ||
      valoresActuales.categoria_id !== (tareaAEditar.categoria?.id || '') ||
      valoresActuales.estado !== tareaAEditar.estado ||
      valoresActuales.votacion !== (tareaAEditar.votacion || '')
    );
  }, [valoresActuales, isEditing, tareaAEditar]);

  const handleSelectEstado = (estado: string) => {
    setValue('estado', estado, { shouldValidate: true });
    setIsEstadoModalOpen(false);
  };

  const handleSelectVotacion = (votacion: string) => {
    setValue('votacion', votacion, { shouldValidate: true });
    setIsVotacionModalOpen(false);
  };
  
  return (
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog onClose={onClose} className="relative z-50">
          <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/10 backdrop-blur-sm dark:bg-black/60" />
          </TransitionChild>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <DialogPanel className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-lg p-6 shadow-xl transition-colors border border-transparent dark:border-neutral-800">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="flex justify-between items-center mb-4 border-b border-transparent dark:border-neutral-800 pb-2">
                    <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {isEditing ? 'Editar Punto a Tratar' : 'Crear Nuevo Punto a Tratar'}
                    </DialogTitle>
                    <Button type="button" variant="link" onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                      Salir
                    </Button>
                  </div>

                  <div>
                    <label htmlFor="titulo_item" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Título del punto a tratar</label>
                    <Input
                      id="titulo_item"
                      {...register('titulo_item')}
                      placeholder="Ej. Nombre del punto a tratar"
                      className={`bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:placeholder:text-gray-500 ${errors.titulo_item ? 'border-red-500' : ''}`}
                    />
                    {errors.titulo_item && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.titulo_item.message}</p>}
                  </div>

                  <div className="flex gap-4">
                    <div className="w-3/5">
                      <label htmlFor="categoria_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCategoriaModalOpen(true)} 
                        className="mt-1 w-full justify-start bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:hover:bg-neutral-800"
                      >
                        {categoriaSeleccionada ? categoriaSeleccionada.nombre : 'Seleccione una categoría'}
                      </Button>
                      {errors.categoria_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.categoria_id.message}</p>}
                    </div>
                    
                    {isEditing && (
                      <div className="w-2/5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                        <Button
                          type="button"
                          className={`mt-1 w-full justify-start ${getStatusClasses(estadoValue)}`}
                          onClick={() => setIsEstadoModalOpen(true)}
                        >
                          {estadoValue || 'Seleccione un estado'}
                        </Button>
                        {errors.estado && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.estado.message}</p>}
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Votación
                      </label>
                      <Button
                        type="button"
                          className={`mt-1 w-full justify-start ${getVotacionClasses(votacionValue || '')}`}
                          onClick={() => setIsVotacionModalOpen(true)}
                        >
                          {votacionValue || 'Seleccione una votación'}
                        </Button>
                        {errors.votacion && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.votacion.message}</p>}
                    </div>
                  )}
                  
                  <hr className="my-4 border-gray-200 dark:border-neutral-800" />

                  <div className="mt-6 flex justify-between gap-2">
                    {isEditing && (rol === 'SUPER' || rol === 'SECRETARIO') && (
                      <Button
                        type="button"
                        onClick={handleDelete}
                        variant="link"
                        className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={20} className="mr-2" /> Eliminar
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || (isEditing && !tieneCambios)} 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                    >
                      {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Punto a Tratar')}
                    </Button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <Categorias
        isOpen={isCategoriaModalOpen}
        onClose={() => setIsCategoriaModalOpen(false)}
        onSelectCategoria={(cat) => {
          setValue('categoria_id', cat.id, { shouldValidate: true });
        }}
      />
      
      <Estado
        isOpen={isEstadoModalOpen}
        onClose={() => setIsEstadoModalOpen(false)}
        onSelect={handleSelectEstado}
        type="estado"
        currentValue={estadoValue}
      />

      <Estado
        isOpen={isVotacionModalOpen}
        onClose={() => setIsVotacionModalOpen(false)}
        onSelect={handleSelectVotacion}
        type="votacion"
        currentValue={votacionValue || ''}
      />
    </>
  );
}