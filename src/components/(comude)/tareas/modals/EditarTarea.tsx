'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Tarea, ActMiembro, AsignacionMiembro, Usuario } from '../lib/zod';
import { X, Save, Calendar, AlignLeft, Type, Lock, Users, Plus, Trash2, ChevronDown } from 'lucide-react'; 
import { toast } from 'react-toastify';
import { useTareaMutations } from '../lib/hooks'; 
import { useUserContext } from '@/components/(base)/providers/UserProvider'; 

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tarea: Tarea;
  esJefe: boolean;
  usuarios: Usuario[];
}

export default function EditarTarea({ isOpen, onClose, tarea, esJefe, usuarios }: Props) {
  const { actualizar, addMiembro, removeMiembro } = useTareaMutations(); 
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mencionesTextuales, setMencionesTextuales] = useState<{ userId: string; nombre: string }[]>([]);

  // ── Estado de miembros ─────────────────────────────────────────────────────
  const [miembrosActuales, setMiembrosActuales] = useState<ActMiembro[]>([]);


  const formatDateForInput = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (isOpen && tarea) {
      setTitle(tarea.title);
      setDescription(tarea.description || '');
      setDueDate(formatDateForInput(tarea.due_date));
      setMiembrosActuales(tarea.miembros || []);

      if (tarea.description) {
        const initialMentions = usuarios
          .filter(u => tarea.description?.includes(`@${u.nombre}`))
          .map(u => ({ userId: u.user_id, nombre: u.nombre }));
        setMencionesTextuales(initialMentions);
      } else {
        setMencionesTextuales([]);
      }
    }
  }, [isOpen, tarea, usuarios]);

  if (!isOpen) return null;

  const isSubmitting = actualizar.isPending;

  const { effectiveRole } = useUserContext();
  const isSuper = effectiveRole === 'super';

  const usuariosDisponibles = useMemo(() => {
    if (isSuper) return usuarios;
    return usuarios.filter((u) => u.rol !== 'super');
  }, [usuarios, isSuper]);

  // ── Helpers mentions ─────────────────────────────────────────────────────
  const usuariosParaMencion = usuariosDisponibles.filter(u => 
    u.activo &&
    u.nombre.toLowerCase().includes(mentionSearchTerm.toLowerCase()) &&
    u.user_id !== tarea.assigned_to
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      const el = e.target as HTMLTextAreaElement;
      const cursor = el.selectionStart;
      if (cursor === el.selectionEnd && cursor > 0) {
        const textBeforeCursor = description.slice(0, cursor);
        for (const m of mencionesTextuales) {
          const mentionText = `@${m.nombre}`;
          if (textBeforeCursor.endsWith(mentionText)) {
            e.preventDefault();
            const newDescription = description.slice(0, cursor - mentionText.length) + description.slice(cursor);
            setDescription(newDescription);
            setMencionesTextuales(prev => prev.filter(x => x.userId !== m.userId));
            setTimeout(() => {
              el.setSelectionRange(cursor - mentionText.length, cursor - mentionText.length);
            }, 0);
            return;
          }
        }
      }
    }

    if (showMentionDropdown && usuariosParaMencion.length === 1) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        insertMention(usuariosParaMencion[0]);
      }
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);
    
    setMencionesTextuales(prev => prev.filter(m => val.includes(`@${m.nombre}`)));

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^@\n]*)$/);
    if (mentionMatch && mentionMatch[1].length >= 3) {
      setShowMentionDropdown(true);
      setMentionSearchTerm(mentionMatch[1]);
      setMentionPosition(cursor - mentionMatch[1].length);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (user: Usuario) => {
    const val = description;
    const cursor = mentionPosition; 
    const beforeAt = val.slice(0, cursor - 1); 
    const textAfterCursor = val.slice(cursor + mentionSearchTerm.length);
    
    const newDescription = `${beforeAt}@${user.nombre} ${textAfterCursor}`;
    setDescription(newDescription);
    setShowMentionDropdown(false);
    
    if (!mencionesTextuales.some(m => m.userId === user.user_id)) {
      setMencionesTextuales(prev => [...prev, { userId: user.user_id, nombre: user.nombre }]);
    }
  };

  const renderHighlightedText = () => {
    if (!description) return null;
    if (mencionesTextuales.length === 0) return description;

    const sortedMiembros = [...mencionesTextuales].sort((a, b) => b.nombre.length - a.nombre.length);
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const names = sortedMiembros.map(m => `@${escapeRegExp(m.nombre)}`);
    const regex = new RegExp(`(${names.join('|')})`, 'g');
    
    const parts = description.split(regex);
    
    return parts.map((part, i) => {
      if (sortedMiembros.some(m => `@${m.nombre}` === part)) {
        return <span key={i} className="text-blue-500 dark:text-blue-400">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const isoDate = dueDate ? new Date(dueDate).toISOString() : null;
      const fechaOriginal = formatDateForInput(tarea.due_date);
      const fechaCambio = dueDate !== fechaOriginal;
      const estabaCompletada = tarea.status === 'Completado';
      const estabaVencida = new Date(tarea.due_date) < new Date();

      const datosActualizados: any = {
        title,
        description,
        due_date: isoDate
      };

      if (fechaCambio && (estabaCompletada || estabaVencida)) {
        datosActualizados.status = 'Asignado';
        if (estabaCompletada) {
          datosActualizados.updated_at = null;
        }
      }

      await actualizar.mutateAsync({ id: tarea.id, updates: datosActualizados });

      toast.success('Actividad actualizada correctamente');
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error('Error al actualizar la actividad');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed -inset-[100vmax] bg-black/5 dark:bg-black/20 backdrop-blur-md -z-10 pointer-events-none" />
      <div className="bg-white dark:bg-neutral-900 w-full rounded-none sm:rounded-2xl shadow-2xl sm:max-w-2xl lg:max-w-3xl flex flex-col transition-colors duration-200 h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-gray-100">
            Editar Actividad
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          
          {/* Título */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
               <span className="flex items-center gap-2"><Type size={14}/> Título</span>
               {!esJefe && <span className="text-[10px] text-orange-500 flex items-center gap-1"><Lock size={10}/> Solo lectura</span>}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!esJefe} 
              className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-base font-medium
                ${!esJefe 
                  ? 'bg-gray-100 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 text-gray-500 cursor-not-allowed opacity-70' 
                  : 'bg-gray-50 dark:bg-neutral-800 border-gray-100 dark:border-neutral-700 text-gray-700 dark:text-gray-100'
                }`}
              required
            />
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span className="flex items-center gap-2"><Calendar size={14} /> Fecha y Hora Límite</span>
              {!esJefe && <span className="text-[10px] text-orange-500 flex items-center gap-1"><Lock size={10}/> Solo lectura</span>}
            </label>
            <input
              type="datetime-local" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!esJefe} 
              className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base dark:[color-scheme:dark]
                ${!esJefe 
                  ? 'bg-gray-100 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 text-gray-500 cursor-not-allowed opacity-70' 
                  : 'bg-gray-50 dark:bg-neutral-800 border-gray-100 dark:border-neutral-700 text-gray-700 dark:text-gray-100'
                }`}
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2 relative">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <AlignLeft size={14} /> Descripción
            </label>
            <div className="relative bg-gray-50 dark:bg-neutral-800 border-gray-100 dark:border-neutral-700 border rounded-xl">
              <div 
                ref={backdropRef}
                className="absolute inset-0 border border-transparent p-3 text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words overflow-hidden pointer-events-none rounded-xl"
                style={{ 
                  letterSpacing: 'normal',
                  wordSpacing: 'normal',
                  color: 'var(--tw-text-opacity) == 1 ? currentColor : "transparent"',
                }}
                aria-hidden="true"
              >
                <div className={`w-full h-full text-gray-700 dark:text-gray-100 ${!description ? 'opacity-0' : 'opacity-100'}`}>
                  {renderHighlightedText()}
                  {description.endsWith('\n') ? <br /> : null}
                </div>
              </div>
              <textarea 
                value={description} 
                onChange={handleDescriptionChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                placeholder="Añade detalles o actualizaciones... (Usa @ para mencionar usuarios)" 
                rows={4}
                className={`w-full p-3 bg-transparent border-transparent focus:border-transparent focus:ring-0 outline-none text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words resize-none relative z-10 custom-scrollbar ${description ? 'text-transparent' : 'text-gray-700 dark:text-gray-100'}`}
                style={{ caretColor: '#3b82f6', letterSpacing: 'normal', wordSpacing: 'normal' }}
              />
              {showMentionDropdown && usuariosParaMencion.length > 0 && (
                <div className="absolute z-50 w-full bottom-full mb-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto ring-1 ring-black/5 dark:ring-white/10">
                  {usuariosParaMencion.map(u => (
                    <button key={u.user_id} type="button" onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-100 text-sm border-b border-slate-200 dark:border-slate-700/50 last:border-0 transition-colors">
                      {u.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* Botones */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 sm:py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}