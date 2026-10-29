'use client';

import { useState, useEffect, useRef } from 'react';
import { ChecklistItem } from './lib/zod';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { Check, Edit2, Trash2, Plus, Loader2, CheckSquare, Square, X } from 'lucide-react';
import { useTareaMutations } from './lib/hooks'; 

interface Props {
  tareaId: string;
  checklist: ChecklistItem[];
  isReadOnly: boolean; 
  onComplete?: () => void;
  canComplete?: boolean;
  isCompleting?: boolean;
}

export default function TareaChecklist({ tareaId, checklist, isReadOnly, onComplete, canComplete, isCompleting }: Props) {
  const { actualizarChecklist } = useTareaMutations(); 

  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>(checklist);
  const latestChecklist = useRef<ChecklistItem[]>(checklist);

  const [newItemText, setNewItemText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [editingStepText, setEditingStepText] = useState('');
  const [pendingIndices, setPendingIndices] = useState<number[]>([]);
  const [isTogglingAll, setIsTogglingAll] = useState(false);

  // Mecanismo para evitar que react-query sobrescriba la UI con caché viejo justo después de mutar
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSyncPaused, setIsSyncPaused] = useState(false);

  const pauseSync = () => {
      setIsSyncPaused(true);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setIsSyncPaused(false), 2000);
  };

  useEffect(() => {
    // Sincronizar solo si no hay operaciones en curso y no estamos en pausa (evita parpadeos de caché)
    if (pendingIndices.length === 0 && !isTogglingAll && !isAdding && editingStepIndex === null && !isSyncPaused) {
      setLocalChecklist(checklist);
      latestChecklist.current = checklist;
    }
  }, [checklist, pendingIndices.length, isTogglingAll, isAdding, editingStepIndex, isSyncPaused]);

  const allCompleted = localChecklist.length > 0 && localChecklist.every(item => item.is_completed);

  const sortedChecklist = localChecklist
    .map((item, index) => ({ ...item, originalIndex: index }));

  const toggleAll = async () => {
    if (isReadOnly || isTogglingAll || localChecklist.length === 0) return;

    const actionText = allCompleted ? 'desmarcar' : 'completar';
    const result = await Swal.fire({
        title: `¿${allCompleted ? 'Desmarcar' : 'Completar'} todas las actividades?`,
        text: `¿Estás seguro de que deseas ${actionText} todas las actividades de la lista?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    pauseSync();
    setIsTogglingAll(true);
    const newState = !allCompleted;
    
    // UI Optimista a prueba de carreras
    const actuales = latestChecklist.current.map(item => ({ ...item, is_completed: newState }));
    latestChecklist.current = actuales;
    setLocalChecklist(actuales);

    try {
        await actualizarChecklist.mutateAsync({ id: tareaId, items: actuales });
        toast.success(newState ? 'Todos completados' : 'Todos desmarcados');
    } catch (error) {
        // En caso de error extremo revierte al estado del servidor original
        latestChecklist.current = checklist;
        setLocalChecklist(checklist); 
        toast.error('Error al actualizar todos');
    } finally {
        setIsTogglingAll(false);
    }
  };

  const toggleCheck = async (idx: number) => {
    if (editingStepIndex !== null || isReadOnly || pendingIndices.includes(idx)) return;

    pauseSync();
    setPendingIndices(prev => [...prev, idx]);

    // UI Optimista robusta
    const actuales = [...latestChecklist.current];
    actuales[idx] = { ...actuales[idx], is_completed: !actuales[idx].is_completed };
    
    latestChecklist.current = actuales;
    setLocalChecklist(actuales);

    try { 
        await actualizarChecklist.mutateAsync({ id: tareaId, items: actuales });
    } catch (error) { 
        actuales[idx].is_completed = !actuales[idx].is_completed;
        latestChecklist.current = actuales;
        setLocalChecklist([...actuales]);
        toast.error('Error al actualizar'); 
    } finally {
        setPendingIndices(prev => prev.filter(i => i !== idx));
    }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim() || isReadOnly) return;
    pauseSync();
    setIsAdding(true);
    const newItem: ChecklistItem = { title: newItemText, is_completed: false };
    
    const actuales = [...latestChecklist.current, newItem];
    latestChecklist.current = actuales;
    setLocalChecklist(actuales);
    
    const previousText = newItemText;
    setNewItemText('');

    try {
        await actualizarChecklist.mutateAsync({ id: tareaId, items: actuales });
        toast.success('Actividad agregada');
    } catch (error) { 
        setNewItemText(previousText);
        latestChecklist.current = checklist;
        setLocalChecklist(checklist);
        toast.error('Error al agregar actividad'); 
    } finally { 
        setIsAdding(false); 
    }
  };

  const handleDeleteItem = async (idx: number) => {
    if (isReadOnly) return;
    const result = await Swal.fire({
        title: '¿Eliminar actividad?',
        text: "No podrás revertir esta acción",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    pauseSync();
    const actuales = latestChecklist.current.filter((_, i) => i !== idx);
    latestChecklist.current = actuales;
    setLocalChecklist(actuales);

    try {
        await actualizarChecklist.mutateAsync({ id: tareaId, items: actuales });
        toast.success('Actividad eliminada');
    } catch (error) {
        latestChecklist.current = checklist;
        setLocalChecklist(checklist);
        toast.error('Error al eliminar');
    }
  };

  const startEditingStep = (idx: number, currentText: string) => {
    if (isReadOnly) return;
    setEditingStepIndex(idx);
    setEditingStepText(currentText);
  };

  const saveStepEdit = async (idx: number) => {
    if (!editingStepText.trim()) {
        setEditingStepIndex(null);
        return;
    }
    
    pauseSync();
    const actuales = [...latestChecklist.current];
    actuales[idx] = { ...actuales[idx], title: editingStepText };
    
    latestChecklist.current = actuales;
    setLocalChecklist(actuales);

    const prevIndex = editingStepIndex;
    const prevText = editingStepText;
    setEditingStepIndex(null);
    setEditingStepText('');

    try {
        await actualizarChecklist.mutateAsync({ id: tareaId, items: actuales });
        toast.success('Actividad guardada');
    } catch (error) { 
        setEditingStepIndex(prevIndex);
        setEditingStepText(prevText);
        latestChecklist.current = checklist;
        setLocalChecklist(checklist);
        toast.error('Error al guardar'); 
    }
  };

  return (
    <div className="
        max-h-[70vh] sm:max-h-[450px] 
        overflow-y-auto 
        pr-1 sm:pr-2 
        mb-5
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700
        [&::-webkit-scrollbar-thumb]:rounded-full
    ">
        {!isReadOnly && checklist.length > 1 && (
            <div className="mb-3 flex justify-start">
                <button
                    onClick={toggleAll}
                    disabled={isTogglingAll}
                    className={`
                        flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-all
                        ${allCompleted 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40' 
                            : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40'}
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {isTogglingAll ? (
                        <Loader2 size={11} className="animate-spin" />
                    ) : allCompleted ? (
                        <Square size={11} strokeWidth={2} />
                    ) : (
                        <CheckSquare size={11} strokeWidth={2} />
                    )}
                    {allCompleted ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
            </div>
        )}

        <ul className="space-y-2 pb-2">
            {sortedChecklist.map((item) => {
                const idx = item.originalIndex; 
                const isPending = pendingIndices.includes(idx);
                
                return (
                <li key={idx} 
                    className={`
                        flex items-start sm:items-center justify-between text-sm p-2 rounded-lg transition-all duration-300 group border
                        ${item.is_completed
                            ? 'bg-slate-50/50 dark:bg-neutral-800/30 border-transparent' 
                            : 'hover:bg-slate-50 dark:hover:bg-neutral-800 hover:border-slate-100 dark:hover:border-neutral-700 border-transparent'}
                    `}
                >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div 
                            onClick={() => toggleCheck(idx)}
                            className={`
                                mt-0.5 min-w-[20px] w-[20px] h-[20px] rounded flex items-center justify-center border shrink-0
                                transition-all duration-200 ease-in-out transform
                                ${!isReadOnly && !isPending ? 'active:scale-75 active:bg-slate-200 cursor-pointer' : ''}
                                ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}
                                ${item.is_completed 
                                    ? 'bg-green-500 border-green-500 shadow-sm rotate-0' 
                                    : 'bg-white dark:bg-neutral-800 border-slate-300 dark:border-neutral-600 hover:border-blue-400 dark:hover:border-blue-500 rotate-0'
                                }
                                
                            `}
                        >
                            <Check 
                                size={14} 
                                className={`text-white transition-all duration-200 ${item.is_completed ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} 
                                strokeWidth={4} 
                            />
                        </div>
                        
                        {editingStepIndex === idx ? (
                            <div className="flex-1 flex gap-2 animate-in fade-in duration-200 min-w-0">
                                <input 
                                    type="text" 
                                    value={editingStepText}
                                    onChange={(e) => setEditingStepText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveStepEdit(idx)}
                                    autoFocus
                                    className="w-full text-base bg-white dark:bg-neutral-900 border border-blue-400 dark:border-blue-500 rounded px-2 py-1 focus:outline-none shadow-sm dark:text-gray-100"
                                />
                                <button onClick={() => saveStepEdit(idx)} className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 p-2 rounded shrink-0">
                                    <Check size={18} />
                                </button>
                            </div>
                        ) : (
                            <span 
                                onClick={() => toggleCheck(idx)}
                                className={`
                                    leading-tight select-none flex-1 transition-all break-words duration-200
                                    ${(isReadOnly || isPending) ? 'cursor-default' : 'cursor-pointer'}
                                    text-slate-700 dark:text-gray-200
                                `}
                            >
                                {item.title}
                            </span>
                        )}
                    </div>

                    {editingStepIndex !== idx && !isReadOnly && !isPending && (
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                            <button 
                                onClick={() => startEditingStep(idx, item.title)} 
                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button 
                                onClick={() => handleDeleteItem(idx)} 
                                className="p-2 text-slate-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                )}
                </li>
            )})}
            
            {/* Fake checklist item para finalizar la actividad */}
            {onComplete && !isReadOnly && (
              <li
                className={`
                  flex items-start sm:items-center justify-between text-sm p-2 rounded-lg transition-all duration-300 border border-transparent mt-2
                  ${!canComplete ? 'bg-slate-50 dark:bg-neutral-800/50 opacity-70' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'}
                `}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    onClick={() => canComplete && onComplete()}
                    className={`
                      mt-0.5 min-w-[20px] w-[20px] h-[20px] rounded flex items-center justify-center border shrink-0 transition-all duration-200
                      ${!canComplete ? 'bg-slate-100 border-slate-200 dark:bg-neutral-800 dark:border-neutral-700 cursor-not-allowed' : 'bg-white border-blue-400 dark:bg-neutral-800 hover:border-blue-500 cursor-pointer shadow-sm'}
                    `}
                  >
                    {isCompleting && <Loader2 size={12} className="animate-spin text-blue-500" />}
                  </div>
                  <span
                    onClick={() => canComplete && onComplete()}
                    className={`
                      leading-tight select-none flex-1 break-words transition-all duration-200
                      ${!canComplete ? 'text-slate-400 dark:text-gray-500 cursor-not-allowed' : 'text-blue-700 dark:text-blue-400 font-medium cursor-pointer'}
                    `}
                  >
                    Finalizar Actividad
                  </span>
                </div>
              </li>
            )}
        </ul>

        {!isReadOnly && (
            <div className="flex gap-2 mt-2 sticky bottom-0 pt-2 pb-1">
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        value={newItemText} 
                        onChange={(e) => setNewItemText(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItem()} 
                        placeholder="Escribe una nueva actividad..."
                        disabled={isAdding} 
                        className="w-full text-base pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder-gray-500 text-slate-700 dark:text-gray-100" 
                    />
                    <Plus size={16} className="absolute left-3 top-3.5 text-slate-400 dark:text-gray-500" />
                </div>
                <button 
                    onClick={handleAddItem} 
                    disabled={!newItemText.trim() || isAdding} 
                    className="bg-blue-600 text-white hover:bg-blue-700 px-4 rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed shadow-sm shadow-blue-200 dark:shadow-none active:scale-95"
                >
                    {isAdding ? <Loader2 size={18} className="animate-spin"/> : "Añadir"}
                </button>
            </div>
        )}
    </div>
  );
}
