'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Usuario, AsignacionMiembro, Tarea } from '../lib/zod';
import { X, Plus, Calendar, User, AlignLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTareaMutations } from '../lib/hooks';
import { useUserContext } from '@/components/(base)/providers/UserProvider';

interface NuevoMiembro {
  userId: string;
  nombre: string;
  asignaciones: AsignacionMiembro[];
}

interface NewTareaProps {
  tareaOriginal: Tarea | null | undefined;
  isOpen: boolean;
  onClose: () => void;
  usuarios: Usuario[];
  usuarioActual: string;
  esJefe: boolean;
}

export default function DuplicateTarea({ isOpen, onClose, usuarios, usuarioActual, esJefe, tareaOriginal }: NewTareaProps) {
  const { duplicar } = useTareaMutations();
  const { effectiveRole } = useUserContext();
  const isSuper = effectiveRole === 'super';

  const usuariosDisponibles = useMemo(() => {
    if (isSuper) return usuarios;
    return usuarios.filter((u) => u.rol !== 'super');
  }, [usuarios, isSuper]);

  const obtenerFechaPorDefecto = () => {
    const d = new Date();
    d.setHours(16, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [error, setError] = useState('');
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(obtenerFechaPorDefecto);

  // Encargado
  const [assignedTo, setAssignedTo] = useState(usuarioActual);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Miembros (Mentions)
  const [miembros, setMiembros] = useState<NuevoMiembro[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState(-1);
  
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const renderHighlightedText = () => {
    if (!description) return null;
    
    if (miembros.length === 0) {
      return description;
    }

    const sortedMiembros = [...miembros].sort((a, b) => b.nombre.length - a.nombre.length);
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

  const isSubmitting = duplicar.isPending;

  // ── Helpers encargado ────────────────────────────────────────────────────
  const filteredUsuarios = usuariosDisponibles.filter(u =>
    u.activo && u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  
  useEffect(() => {
    if (isOpen && tareaOriginal) {
      setTitle(tareaOriginal.title + ' (Copia)');
      setDescription(tareaOriginal.description || '');
      const d = new Date(tareaOriginal.due_date);
      setDueDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`);
      setAssignedTo(tareaOriginal.assigned_to || usuarioActual);
      
      const assignedUser = usuarios.find(u => u.user_id === tareaOriginal.assigned_to);
      if (assignedUser) setSearchTerm(assignedUser.nombre);
      else if (tareaOriginal.assigned_to === usuarioActual) setSearchTerm('(A mí mismo)');
      
      const initialMentions = usuarios
          .filter(u => tareaOriginal.description?.includes(`@${u.nombre}`))
          .map(u => ({ userId: u.user_id, nombre: u.nombre, asignaciones: [] }));
      setMiembros(initialMentions);
    } else if (isOpen) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setAssignedTo(usuarioActual);
      setSearchTerm("");
      setMiembros([]);
    }
  }, [isOpen, tareaOriginal, usuarios, usuarioActual]);

  const handleSelectEncargado = (userId: string, nombre: string) => {
    setAssignedTo(userId);
    setSearchTerm(nombre);
    setShowDropdown(false);
    // Si el encargado cambia y era miembro, quitarlo de la lista
    setMiembros(prev => prev.filter(m => m.userId !== userId));
  };

  // ── Helpers mentions ─────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      const el = e.target as HTMLTextAreaElement;
      const cursor = el.selectionStart;
      if (cursor === el.selectionEnd && cursor > 0) {
        const textBeforeCursor = description.slice(0, cursor);
        for (const m of miembros) {
          const mentionText = `@${m.nombre}`;
          if (textBeforeCursor.endsWith(mentionText)) {
            e.preventDefault();
            const newDescription = description.slice(0, cursor - mentionText.length) + description.slice(cursor);
            setDescription(newDescription);
            setMiembros(prev => prev.filter(x => x.userId !== m.userId));
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
    
    setMiembros(prev => prev.filter(m => val.includes(`@${m.nombre}`)));

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    
    // Buscar si estamos escribiendo una mención (ej: "@Juan Perez")
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
    const beforeAt = val.slice(0, cursor - 1); // everything before '@'
    const textAfterCursor = val.slice(cursor + mentionSearchTerm.length);
    
    const newDescription = `${beforeAt}@${user.nombre} ${textAfterCursor}`;
    setDescription(newDescription);
    setShowMentionDropdown(false);
    
    if (!miembros.some(m => m.userId === user.user_id) && user.user_id !== assignedTo) {
      setMiembros(prev => [...prev, { userId: user.user_id, nombre: user.nombre, asignaciones: [] }]);
    }
  };

  const usuariosParaMencion = usuariosDisponibles.filter(u => 
    u.activo &&
    u.nombre.toLowerCase().includes(mentionSearchTerm.toLowerCase()) &&
    u.user_id !== assignedTo &&
    !miembros.some(m => m.userId === u.user_id)
  );

  const sendPushNotification = async (titulo: string, mensaje: string, userIds: string[]) => {
    try {
      if (userIds.length === 0) return;
      await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titulo,
          message: mensaje,
          url: '/comude/actividades',
          targetIds: userIds,
        }),
      });
    } catch (error) {
      console.error('Error enviando notificación push:', error);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !dueDate) {
      setError('Por favor completa el título y la fecha.');
      toast.warning('Faltan datos obligatorios');
      return;
    }
    
    try {
      const asignadoA = esJefe ? assignedTo : usuarioActual;
      const tituloActividad = title.trim();
      const nombreAsignador = usuarios.find((u) => u.user_id === usuarioActual)?.nombre || 'Alguien';
      const esAutoAsignada = asignadoA === usuarioActual;
      const esGrupal = miembros.length > 0;

      await duplicar.mutateAsync({
        title: tituloActividad,
        description,
        due_date: new Date(dueDate).toISOString(),
        assigned_to: asignadoA,
        checklist: tareaOriginal?.checklist || [],
        status: 'Asignado',
        comision_id: tareaOriginal?.comision_id || null,
        miembros: esGrupal
          ? miembros.map(m => ({ userId: m.userId, asignaciones: m.asignaciones }))
          : undefined,
      });

      // Notificar al encargado
      sendPushNotification(
        esAutoAsignada ? '📋 Actividad auto-asignada' : '📋 Nueva Actividad Asignada',
        esAutoAsignada
          ? `✅ Te asignaste una actividad: "${tituloActividad}".`
          : `✅ ${nombreAsignador} te asignó una actividad: "${tituloActividad}".`,
        [asignadoA]
      );

      // Notificar a los miembros grupales
      if (esGrupal) {
        sendPushNotification(
          '👥 Nueva Actividad Grupal',
          `Se te ha asignado como participante en: "${tituloActividad}"`,
          miembros.map(m => m.userId)
        );
      }

      toast.success('¡Actividad creada correctamente!');
       // Clear cache after success
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la actividad');
      toast.error(err.message || 'Error al guardar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed -inset-[100vmax] bg-black/5 dark:bg-black/20 backdrop-blur-md -z-10 pointer-events-none" />
      <div className="bg-white dark:bg-neutral-900 w-full sm:max-w-lg lg:max-w-xl rounded-none sm:rounded-2xl shadow-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto flex flex-col transition-colors duration-200">

        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-500">Duplicar Actividad</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-col gap-5">
            {/* Título */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Título de la actividad</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Revisar documentación..."
                className="w-full p-3 sm:p-4 bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base text-gray-700 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                autoFocus
              />
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <Calendar size={14} /> Fecha Límite
              </label>
              <input
                type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base text-gray-700 dark:text-gray-100 dark:[color-scheme:dark]"
              />
            </div>

            {/* Encargado */}
            <div className="space-y-2 relative">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <User size={14} /> Encargado
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={!esJefe ? '(Auto-asignado a mí)' : searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); if (!e.target.value.trim()) setAssignedTo(usuarioActual); }}
                  onFocus={() => esJefe && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  disabled={!esJefe}
                  placeholder={esJefe ? "Escribe un nombre..." : "(Auto-asignado a mí)"}
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base transition-colors
                    ${esJefe ? 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-100 placeholder-gray-400' : 'bg-gray-100 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 text-gray-400 cursor-not-allowed'}`}
                />
                {esJefe && showDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    <button type="button" onClick={() => handleSelectEncargado(usuarioActual, '(A mí mismo)')}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm text-blue-600 dark:text-blue-400 font-medium border-b border-gray-50 dark:border-neutral-700">
                      Asignarme a mí
                    </button>
                    {filteredUsuarios.filter(u => u.user_id !== usuarioActual).map(u => (
                      <button key={u.user_id} type="button" onMouseDown={(e) => { e.preventDefault(); handleSelectEncargado(u.user_id, u.nombre); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 text-sm transition-colors border-b border-gray-50 dark:border-neutral-700/50 last:border-0">
                        {u.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {esJefe && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
                  {searchTerm.trim() === '' ? '* Vacío = Se te asigna a ti.' : 'Selecciona de la lista.'}
                </p>
              )}
            </div>

            {/* Descripción */}
            <div className="space-y-2 relative">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <AlignLeft size={14} /> Descripción
              </label>
              <div className="relative">
                <div 
                  ref={backdropRef}
                  className="absolute inset-0 border border-transparent p-3 sm:p-4 text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words overflow-hidden pointer-events-none rounded-xl"
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
                  placeholder="Detalles adicionales... (Usa @ para mencionar usuarios)" 
                  rows={4}
                  className={`w-full p-3 sm:p-4 bg-transparent border border-gray-100 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words placeholder-gray-400 dark:placeholder-gray-500 resize-none relative z-10 custom-scrollbar ${description ? 'text-transparent' : 'text-gray-700 dark:text-gray-100'}`}
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

          </div>

          {/* Footer */}
          <div className="flex flex-col items-center justify-center gap-4 pt-4 mt-2 border-t border-gray-100 dark:border-neutral-800">
            {error && (
              <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900 flex items-center justify-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}
            <div className="w-full pb-2">
              <button type="submit" disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 sm:py-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base">
                {isSubmitting ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Duplicando...</>
                ) : (
                  <><Plus size={20} /> Crear Actividad</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}