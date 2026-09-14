'use client';

import { LayoutList, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TabsYFiltrosProps {
  activeTab: 'agenda' | 'asistencia';
  setActiveTab: (tab: 'agenda' | 'asistencia') => void;
  filtrosActivos: string[];
  toggleFiltro: (estado: string) => void;
  clearFiltros: () => void;
  resumenDeEstados: Record<string, number>;
  estadoOrden: string[];
}

const statusStyles: Record<string, string> = {
  'Aprobado': 'bg-green-200 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'No aprobado': 'bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'En progreso': 'bg-blue-200 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'En comisión': 'bg-gray-300 text-gray-700 dark:bg-neutral-700 dark:text-gray-300',
  'En espera': 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'No iniciado': 'bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-gray-400',
  'Realizado': 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const getStatusClasses = (status: string) => statusStyles[status] || 'bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-gray-400';

export default function TabsYFiltros({
  activeTab,
  setActiveTab,
  filtrosActivos,
  toggleFiltro,
  clearFiltros,
  resumenDeEstados,
  estadoOrden
}: TabsYFiltrosProps) {
  
  return (
    <div className="flex flex-col md:flex-row items-center justify-between mb-4 w-full gap-4 transition-colors">
      <div className="w-full md:w-auto flex justify-start">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('agenda')}
            className={cn(
              "relative flex items-center gap-2 pb-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === 'agenda' 
                ? "text-blue-600 dark:text-blue-400" 
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            <LayoutList className="h-4 w-4" />
            <span>Agenda</span>
            {activeTab === 'agenda' && (
              <motion.div
                layoutId="activeTabTareas"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('asistencia')}
            className={cn(
              "relative flex items-center gap-2 pb-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === 'asistencia' 
                ? "text-blue-600 dark:text-blue-400" 
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            <Users className="h-4 w-4" />
            <span>Asistencia</span>
            {activeTab === 'asistencia' && (
              <motion.div
                layoutId="activeTabTareas"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        </div>
      </div>

      <div className="hidden md:flex md:flex-wrap md:items-center md:justify-end md:w-auto gap-1.5 min-w-[200px]">
        {activeTab === 'agenda' && estadoOrden.map(estado => (
          <motion.button 
            key={estado} 
            onClick={() => toggleFiltro(estado)} 
            className={`
              px-2 py-1 rounded shadow-sm text-center flex items-center justify-center gap-1
              ${getStatusClasses(estado)} 
              ${filtrosActivos.includes(estado) ? 'ring-2 ring-offset-1 ring-blue-400 dark:ring-blue-500 dark:ring-offset-neutral-950' : ''}
            `} 
            whileHover={{ y: -2 }} 
            whileTap={{ scale: 0.95 }}
          >
            <span className="font-semibold text-[10px] uppercase tracking-tight">{estado}:</span>
            <span className="text-[10px] font-bold bg-white/40 dark:bg-black/20 px-1 rounded-sm min-w-[14px]">
              {resumenDeEstados[estado] || 0}
            </span>
          </motion.button>
        ))}
        
        {activeTab === 'agenda' && (
          <AnimatePresence>
            {filtrosActivos.length > 0 && (
              <motion.button 
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 10 }} 
                onClick={clearFiltros} 
                className="ml-1 px-2 py-1 rounded shadow-sm text-center bg-gray-500 text-white text-[10px] hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                Limpiar
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}