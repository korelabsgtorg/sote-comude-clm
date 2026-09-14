'use client';

import React, { Fragment, useEffect, useState, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { fetchCategorias, crearCategoria, editarCategoria } from '../../lib/acciones';
import { CategoriaItem } from '../../lib/esquemas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Pencil, PlusCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import CargandoAnimacion from '@/components/ui/animations/Cargando';

interface CategoriasProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategoria: (categoria: CategoriaItem) => void;
}

export default function Categorias({ isOpen, onClose, onSelectCategoria }: CategoriasProps) {
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');

  const cargarCategorias = async () => {
    setLoading(true);
    const cats = await fetchCategorias();
    setCategorias(cats);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      cargarCategorias();
    }
  }, [isOpen]);

  const categoriasOrdenadas = useMemo(() =>
    [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre))
  , [categorias]);

  const handleCrearCategoria = async () => {
    if (nuevaCategoriaNombre.trim() !== '') {
      await crearCategoria(nuevaCategoriaNombre);
      setNuevaCategoriaNombre('');
      cargarCategorias();
    }
  };

  const handleEditarCategoria = async (categoria: CategoriaItem) => {
    const { value: nombre } = await Swal.fire({
      title: 'Editar Categoría',
      input: 'text',
      inputValue: categoria.nombre,
      showCancelButton: true,
      confirmButtonText: 'Guardar Cambios',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return '¡El nombre no puede estar vacío!';
        }
      }
    });

    if (nombre && nombre !== categoria.nombre) {
      await editarCategoria(categoria.id, nombre);
      cargarCategorias();
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/60" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <DialogPanel className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-md p-6 shadow-xl flex flex-col h-[600px] transition-colors border border-transparent dark:border-neutral-800">
              
              <div className="flex justify-between items-center mb-4 border-b border-transparent dark:border-neutral-800 pb-2">
                <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Categorías
                </DialogTitle>
                <Button onClick={onClose} variant="link" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  Cerrar
                </Button>
              </div>

              <div className="flex gap-2 mb-4">
                <Input
                  type="text"
                  placeholder="Escriba aquí la nueva categoría..."
                  value={nuevaCategoriaNombre}
                  onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCrearCategoria();
                    }
                  }}
                  className="flex-grow bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                <Button onClick={handleCrearCategoria} className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 text-white" size="icon">
                  <PlusCircle size={20} />
                </Button>
              </div>

              <div className="flex-grow overflow-y-auto custom-scrollbar">
                {loading ? <CargandoAnimacion texto="Cargando..." /> : (
                  <ul className="space-y-2">
                    {categoriasOrdenadas.map(cat => (
                      <li key={cat.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors group">
                        <span
                          className="flex-grow cursor-pointer text-gray-700 dark:text-gray-300"
                          onClick={() => {
                            onSelectCategoria(cat);
                            onClose();
                          }}
                        >
                          {cat.nombre}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditarCategoria(cat)}
                          className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700"
                        >
                          <Pencil size={16} />
                        </Button>
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