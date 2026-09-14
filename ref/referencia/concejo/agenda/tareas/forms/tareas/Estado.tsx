'use client';

import React, { Fragment } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface EstadoProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  type: 'estado' | 'votacion';
  currentValue: string;
}

const estadoOpciones = ['No iniciado', 'Aprobado', 'No aprobado', 'En progreso', 'En comisión', 'En espera', 'Realizado'];
const votacionOpciones = ['P1', 'Unanimidad', 'Ver Notas', 'Realizado', 'No Emitido'];

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

export default function Estado({ isOpen, onClose, onSelect, type, currentValue }: EstadoProps) {
  const isEstado = type === 'estado';
  const title = isEstado ? 'Seleccionar Estado' : 'Seleccionar Votación';
  const options = isEstado ? estadoOpciones : votacionOpciones;
  const getClasses = isEstado ? getStatusClasses : getVotacionClasses;

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm dark:bg-black/60" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <DialogPanel className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-sm p-6 shadow-xl flex flex-col transition-colors border border-transparent dark:border-neutral-800">
              <div className="flex justify-between items-center mb-4 border-b border-transparent dark:border-neutral-800 pb-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                <Button variant="link" onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  Salir
                </Button>
              </div>
              <div className={`grid ${isEstado ? 'grid-cols-2' : 'grid-cols-1'} gap-2 flex-grow`}>
                {options.map(option => (
                  <motion.button
                    key={option}
                    type="button"
                    onClick={() => onSelect(option)}
                    className={`w-full px-3 py-2 rounded-md shadow-sm text-center transition-colors ${getClasses(option)} ${currentValue === option ? 'border-t-4 border-blue-500 dark:border-blue-400' : ''}`}
                    whileHover={{ y: -5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="font-semibold">{option}</span>
                  </motion.button>
                ))}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}