'use client';

import { useState, useEffect, useRef } from 'react';
import { AsignacionMiembro } from './lib/zod';
import { toast } from 'react-toastify';
import { Check, Loader2, MessageSquare, CheckCircle2, Edit2, Trash2, Plus } from 'lucide-react';
import { useTareaMutations } from './lib/hooks';
import Swal from 'sweetalert2';

interface Props {
  miembroId: string;
  asignaciones: AsignacionMiembro[];
  isReadOnly: boolean;
  comentario?: string | null;
  completedAt?: string | null;
}

export default function MiembroChecklist({
  miembroId,
  asignaciones,
  isReadOnly,
  comentario,
  completedAt,
}: Props) {
  const { actualizarAsignaciones, actualizarComentario, completarParteMiembro } = useTareaMutations();

  const [pendingIndices, setPendingIndices] = useState<number[]>([]);
  const [localAsignaciones, setLocalAsignaciones] = useState<AsignacionMiembro[]>(asignaciones);
  const latestAsignaciones = useRef<AsignacionMiembro[]>(asignaciones);
  
  const [comentarioLocal, setComentarioLocal] = useState(comentario || '');
  const [guardandoComentario, setGuardandoComentario] = useState(false);
  const [marcandoCompletado, setMarcandoCompletado] = useState(false);

  const [newItemText, setNewItemText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [editingStepText, setEditingStepText] = useState('');

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSyncPaused, setIsSyncPaused] = useState(false);

  const pauseSync = () => {
      setIsSyncPaused(true);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setIsSyncPaused(false), 2000);
  };

  useEffect(() => {
    if (pendingIndices.length === 0 && !isSyncPaused && !isAdding && editingStepIndex === null) {
      setLocalAsignaciones(asignaciones);
      latestAsignaciones.current = asignaciones;
    }
  }, [asignaciones, pendingIndices.length, isSyncPaused, isAdding, editingStepIndex]);

  const total = localAsignaciones.length;
  const completados = localAsignaciones.filter(a => a.is_complete).length;
  const porcentaje = total === 0 ? 0 : Math.round((completados / total) * 100);
  const puedeCompletar = completados === total;

  const sortedAsignaciones = localAsignaciones.map((item, index) => ({ ...item, originalIndex: index }));

  // CRUD Operations

  const toggleCheck = async (idx: number) => {
    if (editingStepIndex !== null || isReadOnly || pendingIndices.includes(idx)) return;

    pauseSync();
    setPendingIndices(prev => [...prev, idx]);

    const actuales = [...latestAsignaciones.current];
    actuales[idx] = { ...actuales[idx], is_complete: !actuales[idx].is_complete };
    
    latestAsignaciones.current = actuales;
    setLocalAsignaciones(actuales);

    try {
      await actualizarAsignaciones.mutateAsync({ miembroId, asignaciones: actuales });
    } catch {
      actuales[idx] = { ...actuales[idx], is_complete: !actuales[idx].is_complete };
      latestAsignaciones.current = actuales;
      setLocalAsignaciones([...actuales]);
      toast.error('Error al actualizar');
    } finally {
      setPendingIndices(prev => prev.filter(i => i !== idx));
    }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim() || isReadOnly) return;
    pauseSync();
    setIsAdding(true);
    const newItem: AsignacionMiembro = { title: newItemText, is_complete: false };
    
    const actuales = [...latestAsignaciones.current, newItem];
    latestAsignaciones.current = actuales;
    setLocalAsignaciones(actuales);
    
    const previousText = newItemText;
    setNewItemText('');
    
    try {
        await actualizarAsignaciones.mutateAsync({ miembroId, asignaciones: actuales });
        toast.success('actividad agregada');
    } catch (error) { 
        setNewItemText(previousText);
        latestAsignaciones.current = asignaciones;
        setLocalAsignaciones(asignaciones);
        toast.error('Error'); 
    } finally { setIsAdding(false); }
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
    const actuales = latestAsignaciones.current.filter((_, i) => i !== idx);
    latestAsignaciones.current = actuales;
    setLocalAsignaciones(actuales);

    try {
        await actualizarAsignaciones.mutateAsync({ miembroId, asignaciones: actuales });
        toast.success('Eliminada correctamente');
    } catch (error) {
        latestAsignaciones.current = asignaciones;
        setLocalAsignaciones(asignaciones);
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
    const actuales = [...latestAsignaciones.current];
    actuales[idx] = { ...actuales[idx], title: editingStepText };
    
    latestAsignaciones.current = actuales;
    setLocalAsignaciones(actuales);

    const prevIndex = editingStepIndex;
    const prevText = editingStepText;
    setEditingStepIndex(null);
    setEditingStepText('');

    try {
        await actualizarAsignaciones.mutateAsync({ miembroId, asignaciones: actuales });
        toast.success('Modificada correctamente');
    } catch (error) { 
        setEditingStepIndex(prevIndex);
        setEditingStepText(prevText);
        latestAsignaciones.current = asignaciones;
        setLocalAsignaciones(asignaciones);
        toast.error('Error al guardar'); 
    }
  };

  const handleGuardarComentario = async () => {
    if (guardandoComentario) return;
    setGuardandoComentario(true);
    try {
      await actualizarComentario.mutateAsync({ miembroId, comentario: comentarioLocal });
      toast.success('Comentario guardado');
    } catch {
      toast.error('Error al guardar comentario');
    } finally {
      setGuardandoComentario(false);
    }
  };

  const handleCompletarParte = async () => {
    if (marcandoCompletado || !puedeCompletar) return;
    
    // Auto save the comment if there is one changed
    if (comentarioLocal !== (comentario || '')) {
      await handleGuardarComentario();
    }

    setMarcandoCompletado(true);
    try {
      await completarParteMiembro.mutateAsync(miembroId);
      toast.success('¡Tu parte ha sido completada!');
    } catch (error) {
      console.error("Detalle del error al completar:", error);
      toast.error('Error al completar');
    } finally {
      setMarcandoCompletado(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full relative">
      {/* Indicador de completado */}
      {completedAt && (
        <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle2 size={14} />
          Parte completada el {new Date(completedAt).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </div>
      )}

      {/* Lista de actividades */}
      <ul className="space-y-2 flex-1 overflow-y-auto min-h-[50px]">
        {total === 0 ? (
          <p className="text-sm text-slate-400 dark:text-gray-500 italic py-6 text-center">
            Sin actividades asignadas.
          </p>
        ) : (
          sortedAsignaciones.map((item) => {
            const idx = item.originalIndex;
            const isPending = pendingIndices.includes(idx);

            return (
              <li
                key={idx}
                className={`
                  flex items-start sm:items-center justify-between text-sm p-2 rounded-lg transition-all duration-300 border
                  ${item.is_complete
                    ? 'bg-slate-50/50 dark:bg-neutral-800/30 border-transparent'
                    : 'hover:bg-slate-50 dark:hover:bg-neutral-800 border-transparent hover:border-slate-100 dark:hover:border-neutral-700'
                  }
                `}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Checkbox */}
                  <div
                    onClick={() => toggleCheck(idx)}
                    className={`
                      mt-0.5 min-w-[20px] w-[20px] h-[20px] rounded flex items-center justify-center border shrink-0
                      transition-all duration-200 ease-in-out
                      ${!isReadOnly && !isPending ? 'cursor-pointer active:scale-75' : ''}
                      ${isReadOnly ? 'cursor-default opacity-60' : ''}
                      ${item.is_complete
                        ? 'bg-green-500 border-green-500 shadow-sm'
                        : 'bg-white dark:bg-neutral-800 border-slate-300 dark:border-neutral-600 hover:border-blue-400'
                      }
                      
                    `}
                  >
                    <Check
                      size={14}
                      className={`text-white transition-all duration-200 ${item.is_complete ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                      strokeWidth={4}
                    />
                  </div>

                  {/* Title / Editor */}
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
                        leading-tight select-none flex-1 break-words transition-all duration-200
                        ${isReadOnly || isPending ? 'cursor-default' : 'cursor-pointer'}
                        text-slate-700 dark:text-gray-200
                      `}
                    >
                      {item.title}
                    </span>
                  )}
                </div>

                {/* Actions */}
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
            );
          })
        )}
        
        {/* Fake checklist item para completar todo */}
        {!isReadOnly && !completedAt && (
          <li
            className={`
              flex items-start sm:items-center justify-between text-sm p-2 rounded-lg transition-all duration-300 border border-transparent mt-2
              ${!puedeCompletar ? 'bg-slate-50 dark:bg-neutral-800/50 opacity-70' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'}
            `}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                onClick={() => puedeCompletar && handleCompletarParte()}
                className={`
                  mt-0.5 min-w-[20px] w-[20px] h-[20px] rounded flex items-center justify-center border shrink-0 transition-all duration-200
                  ${!puedeCompletar ? 'bg-slate-100 border-slate-200 dark:bg-neutral-800 dark:border-neutral-700 cursor-not-allowed' : 'bg-white border-blue-400 dark:bg-neutral-800 hover:border-blue-500 cursor-pointer shadow-sm'}
                `}
              >
                {marcandoCompletado && <Loader2 size={12} className="animate-spin text-blue-500" />}
              </div>
              <span
                onClick={() => puedeCompletar && handleCompletarParte()}
                className={`
                  leading-tight select-none flex-1 break-words transition-all duration-200
                  ${!puedeCompletar ? 'text-slate-400 dark:text-gray-500 cursor-not-allowed' : 'text-blue-700 dark:text-blue-400 font-medium cursor-pointer'}
                `}
              >
                Completar todas mis actividades asignadas
              </span>
            </div>
          </li>
        )}
      </ul>

      {/* Add Subtask Input */}
      {!isReadOnly && (
          <div className="flex gap-2">
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

      {/* Campo de comentario (solo editable si no es lectura y no completado) */}
      {!isReadOnly && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-gray-500 tracking-wider">
            <MessageSquare size={11} />
            Comentario final
          </label>
          <textarea
            value={comentarioLocal}
            onChange={(e) => setComentarioLocal(e.target.value)}
            placeholder="Agrega un comentario sobre tu parte (opcional)..."
            rows={2}
            className="w-full text-sm p-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder-gray-500 text-slate-700 dark:text-gray-100 resize-none"
          />
        </div>
      )}

      {/* Comentario en modo lectura o ya completado */}
      {(isReadOnly) && comentario && (
        <div className="mt-1 bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-slate-100 dark:border-neutral-800">
          <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-gray-500 tracking-wider mb-1.5 flex items-center gap-1">
            <MessageSquare size={10} /> Comentario
          </p>
          <p className="text-sm text-slate-600 dark:text-gray-300 whitespace-pre-line">{comentario}</p>
        </div>
      )}

    </div>
  );
}
