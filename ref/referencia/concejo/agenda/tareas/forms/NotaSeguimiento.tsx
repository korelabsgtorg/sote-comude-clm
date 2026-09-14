'use client';

import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { actualizarNotas, actualizarSeguimiento } from '../../lib/acciones'; 
import { Tarea } from '../../lib/esquemas'; 
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';

interface NotaSeguimientoProps {
  isOpen: boolean;
  onClose: (hasChanged: boolean) => void;
  tarea: Tarea;
  estadoAgenda: string;
  tipo: 'notas' | 'seguimiento'; 
}

export default function NotaSeguimiento({ isOpen, onClose, tarea, estadoAgenda, tipo }: NotaSeguimientoProps) {
  const [data, setData] = useState<string[]>([]);
  const [nuevoItem, setNuevoItem] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const isAgendaFinalizada = estadoAgenda === 'Finalizada';

  const tituloModal = tipo === 'notas' ? `Notas` : `Seguimiento`;
  const placeholder = tipo === 'notas' ? 'Nueva nota...' : 'Nuevo seguimiento...';

  useEffect(() => {
    if (tipo === 'notas') {
      setData(tarea.notas || []);
    } else {
      setData(tarea.seguimiento || []);
    }
  }, [tarea, tipo]);

  const handleAdd = async () => {
    if (!nuevoItem.trim()) return;
    setIsSubmitting(true);
    const newData = [...data, nuevoItem];
    
    if(tipo === 'notas') {
      await actualizarNotas(tarea.id, newData);
    } else {
      await actualizarSeguimiento(tarea.id, newData);
    }
    
    setData(newData);
    setNuevoItem('');
    setHasChanged(true);
    setIsSubmitting(false);
  };

  const handleEdit = async (index: number) => {
    const { value: itemEditado } = await Swal.fire({
      title: tipo === 'notas' ? 'Editar Nota' : 'Editar Seguimiento',
      input: 'textarea',
      inputValue: data[index],
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
    });

    if (itemEditado && itemEditado.trim() !== data[index]) {
      setIsSubmitting(true);
      const dataActualizada = [...data];
      dataActualizada[index] = itemEditado;
      if (tipo === 'notas') {
        await actualizarNotas(tarea.id, dataActualizada);
      } else {
        await actualizarSeguimiento(tarea.id, dataActualizada);
      }
      setData(dataActualizada);
      setHasChanged(true);
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (index: number) => {
    Swal.fire({
      title: '¿Está seguro?',
      text: 'Esta acción no se puede revertir.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsSubmitting(true);
        const dataFiltrada = data.filter((_, i) => i !== index);
        if (tipo === 'notas') {
          await actualizarNotas(tarea.id, dataFiltrada);
        } else {
          await actualizarSeguimiento(tarea.id, dataFiltrada);
        }
        setData(dataFiltrada);
        setHasChanged(true);
        setIsSubmitting(false);
        Swal.fire('Eliminado!', `El ${tipo} ha sido eliminado.`, 'success');
      }
    });
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={() => onClose(hasChanged)} className="relative z-50">
        <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm dark:bg-black/60" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <DialogPanel className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-xl p-8 shadow-xl transition-colors border border-transparent dark:border-neutral-800">
              
              <div className="flex justify-between items-center pb-2 mb-6 border-b border-transparent dark:border-neutral-800">
                <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {tituloModal}
                </DialogTitle>
                <Button onClick={() => onClose(hasChanged)} variant="link" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  Cerrar
                </Button>
              </div>

              <div className="space-y-4">
                {!isAgendaFinalizada && (
                  <div className="flex gap-2">
                    <Input 
                      placeholder={placeholder}
                      value={nuevoItem}
                      onChange={(e) => setNuevoItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAdd();
                        }
                      }}
                      className="bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                    <Button onClick={handleAdd} disabled={!nuevoItem.trim() || isSubmitting}>
                      <Plus size={16} />
                    </Button>
                  </div>
                )}
                
                {data.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay {tipo} para esta tarea.</p>
                ) : (
                  <ul className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {data.map((item, index) => (
                      <li key={index} className="flex flex-col px-4 pt-4 rounded-lg bg-gray-100 dark:bg-neutral-800 transition-colors">
                      {data.length > 1 && (
                          <div className="flex items-center w-full mb-2">
                            <div className="flex-1 h-px bg-gray-300 dark:bg-neutral-700"></div>
                            <span className="flex-shrink-0 mx-2 text-xs text-gray-500 dark:text-gray-400 font-semibold">{index + 1}</span>
                            <div className="flex-1 h-px bg-gray-300 dark:bg-neutral-700"></div>
                          </div>
                        )}
                        
                        <div className="w-full flex-1 mb-4">
                            <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200">{item}</p>
                        </div>
                        
                        {!isAgendaFinalizada && (
                          <div className="flex justify-end gap-1 md:space-x-2 w-full border-t border-gray-200 dark:border-neutral-700 pt-2 pb-2">
                            <Button 
                              variant="link" 
                              className="w-1/2 flex items-center justify-center space-x-2 p-0 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" 
                              onClick={() => handleEdit(index)} 
                              disabled={isSubmitting}
                            >
                              <Pencil size={16} />
                              <span>Editar</span>
                            </Button>
                            <Button 
                              variant="link" 
                              className="w-1/2 flex items-center justify-center space-x-2 p-0 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" 
                              onClick={() => handleDelete(index)} 
                              disabled={isSubmitting}
                            >
                              <Trash2 size={16} />
                              <span>Eliminar</span>
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}