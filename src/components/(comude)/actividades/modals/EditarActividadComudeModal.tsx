'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ActividadComudeConContexto, UsuarioAsignablePunto } from '../lib/zod';
import {
  editarActividadPunto,
  obtenerUsuariosAsignablesMunicipio,
} from '../lib/actividadesPuntoActions';
import {
  ModalFooter,
  ModalInput,
  ModalLabel,
  ModalShell,
} from '@/components/ui/general-modal';
import { Button } from '@/components/ui/button';

export function formatearFechaBitacora(fecha: Date | string = new Date()) {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return '';
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const diaSemana = dias[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  let hora = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const period = hora >= 12 ? 'PM' : 'AM';
  hora = hora % 12;
  hora = hora ? hora : 12;
  const horaStr = String(hora).padStart(2, '0');
  return `${diaSemana} ${day}/${month}/${year}, ${horaStr}:${minutos} ${period}`;
}

export function componerBitacoraActividad({
  nota,
  anterior,
  cambios = [],
}: {
  nota?: string;
  anterior: string | null | undefined;
  cambios?: string[];
}) {
  const notaLimpia = nota?.trim() ?? '';
  const cambiosLimpios = cambios.map((c) => c.trim()).filter(Boolean);
  const previa = anterior?.trim() ?? '';

  if (!notaLimpia && cambiosLimpios.length === 0) return previa;

  const cuerpo = [notaLimpia, ...cambiosLimpios].filter(Boolean).join('\n');
  const entrada = `${formatearFechaBitacora()}\n${cuerpo}`;
  return previa ? `${entrada}\n\n${previa}` : entrada;
}

const formatearFechaInput = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

type EditarActividadComudeModalProps = {
  open: boolean;
  actividad: ActividadComudeConContexto | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditarActividadComudeModal({
  open,
  actividad,
  onClose,
  onSaved,
}: EditarActividadComudeModalProps) {
  const [title, setTitle] = useState('');
  const [notaNueva, setNotaNueva] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Menciones @
  const [usuarios, setUsuarios] = useState<UsuarioAsignablePunto[]>([]);
  const [miembros, setMiembros] = useState<{ userId: string; nombre: string; asignaciones: any[] }[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState(-1);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    obtenerUsuariosAsignablesMunicipio().then(setUsuarios).catch(console.error);
  }, [open]);

  useEffect(() => {
    if (!open || !actividad) return;
    setTitle(actividad.titulo);
    setNotaNueva('');
    setDueDate(formatearFechaInput(actividad.fecha_limite));
    setMiembros(
      (actividad.miembros || []).map((m) => ({
        userId: m.usuario_id,
        nombre: m.nombre_usuario,
        asignaciones: m.asignaciones || [],
      }))
    );
    setShowMentionDropdown(false);
    setMentionPosition(-1);
    setMentionSearchTerm('');
  }, [open, actividad]);

  const usuariosParaMencion = useMemo(() => {
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(mentionSearchTerm.toLowerCase()) &&
        u.id !== actividad?.encargado_id &&
        !miembros.some((m) => m.userId === u.id),
    );
  }, [usuarios, mentionSearchTerm, actividad?.encargado_id, miembros]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const renderHighlightedText = () => {
    if (!notaNueva) return null;

    if (miembros.length === 0) {
      return notaNueva;
    }

    const sortedMiembros = [...miembros].sort((a, b) => b.nombre.length - a.nombre.length);
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const names = sortedMiembros.map((m) => `@${escapeRegExp(m.nombre)}`);
    const regex = new RegExp(`(${names.join('|')})`, 'g');

    const parts = notaNueva.split(regex);

    return parts.map((part, i) => {
      if (sortedMiembros.some((m) => `@${m.nombre}` === part)) {
        return (
          <span key={i} className="text-blue-500 dark:text-blue-400 font-semibold">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      const el = e.target as HTMLTextAreaElement;
      const cursor = el.selectionStart;
      if (cursor === el.selectionEnd && cursor > 0) {
        const textBeforeCursor = notaNueva.slice(0, cursor);
        for (const m of miembros) {
          const mentionText = `@${m.nombre}`;
          if (textBeforeCursor.endsWith(mentionText)) {
            e.preventDefault();
            const newNota = notaNueva.slice(0, cursor - mentionText.length) + notaNueva.slice(cursor);
            setNotaNueva(newNota);
            setMiembros((prev) => prev.filter((x) => x.userId !== m.userId));
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
    setNotaNueva(val);

    setMiembros((prev) => prev.filter((m) => val.includes(`@${m.nombre}`)));

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

  const insertMention = (user: UsuarioAsignablePunto) => {
    const val = notaNueva;
    const cursor = mentionPosition;
    const beforeAt = val.slice(0, cursor - 1);
    const textAfterCursor = val.slice(cursor + mentionSearchTerm.length);

    const newNota = `${beforeAt}@${user.nombre} ${textAfterCursor}`;
    setNotaNueva(newNota);
    setShowMentionDropdown(false);

    if (!miembros.some((m) => m.userId === user.id) && user.id !== actividad?.encargado_id) {
      setMiembros((prev) => [...prev, { userId: user.id, nombre: user.nombre, asignaciones: [] }]);
    }
  };

  const guardar = async () => {
    if (!actividad) return;
    if (!title.trim() || !dueDate) {
      toast.warn('Completa el título y la fecha de la actividad.');
      return;
    }
    if (!actividad.encargado_id) {
      toast.warn('La actividad no tiene encargado asignado.');
      return;
    }

    const fechaAnterior = formatearFechaInput(actividad.fecha_limite);
    if (fechaAnterior !== dueDate && new Date(dueDate) < new Date()) {
      toast.warn('La fecha límite no puede quedar en el pasado.');
      return;
    }

    setGuardando(true);
    try {
      const dueIso = new Date(dueDate).toISOString();
      const cambios: string[] = [];
      if (fechaAnterior !== dueDate) {
        cambios.push(
          `Fecha límite: ${formatearFechaBitacora(actividad.fecha_limite)} → ${formatearFechaBitacora(dueIso)}`,
        );
      }

      const descripcion = componerBitacoraActividad({
        nota: notaNueva,
        anterior: actividad.descripcion,
        cambios,
      });

      const res = await editarActividadPunto(actividad.id, {
        titulo: title.trim(),
        descripcion,
        fechaLimite: dueIso,
        encargadoId: actividad.encargado_id,
        checklist: actividad.checklist,
        miembros: miembros.map((m) => ({ userId: m.userId, asignaciones: m.asignaciones })),
      });

      if (!res.success) {
        throw new Error(res.error || 'Error al guardar');
      }

      toast.success('Actividad actualizada.');
      onSaved();
      onClose();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Error al guardar la actividad.';
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Editar actividad"
      subtitle={actividad?.titulo}
    >
      <div className="space-y-4">
        <div>
          <ModalLabel htmlFor="actividad-titulo">Título de la actividad</ModalLabel>
          <ModalInput
            id="actividad-titulo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <ModalLabel htmlFor="actividad-fecha">Fecha límite</ModalLabel>
          <ModalInput
            id="actividad-fecha"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => {
              const valor = e.target.value;
              const original = actividad ? formatearFechaInput(actividad.fecha_limite) : '';
              if (valor !== original && new Date(valor) < new Date()) {
                toast.warn('La fecha límite no puede quedar en el pasado.');
                return;
              }
              setDueDate(valor);
            }}
            className="dark:[color-scheme:dark]"
          />
        </div>

        <div>
          <ModalLabel htmlFor="actividad-asignado">Encargado</ModalLabel>
          <ModalInput
            id="actividad-asignado"
            value={actividad?.encargado_nombre || ''}
            readOnly
            disabled
          />
        </div>

        <div className="space-y-2 relative">
          <ModalLabel htmlFor="actividad-descripcion">Nueva nota</ModalLabel>
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
              <div className={`w-full h-full text-zinc-900 dark:text-zinc-100 ${!notaNueva ? 'opacity-0' : 'opacity-100'}`}>
                {renderHighlightedText()}
                {notaNueva.endsWith('\n') ? <br /> : null}
              </div>
            </div>
            <textarea
              id="actividad-descripcion"
              value={notaNueva}
              onChange={handleDescriptionChange}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              placeholder="Escribe una nueva nota para la bitácora... (Usa @ para mencionar usuarios)"
              rows={4}
              className={`w-full p-3 sm:p-4 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base font-sans leading-normal tracking-normal whitespace-pre-wrap break-words placeholder-zinc-400 dark:placeholder-zinc-500 resize-none relative z-10 custom-scrollbar ${notaNueva ? 'text-transparent' : 'text-zinc-900 dark:text-zinc-100'}`}
              style={{ caretColor: '#3b82f6', letterSpacing: 'normal', wordSpacing: 'normal' }}
            />
            {showMentionDropdown && usuariosParaMencion.length > 0 && (
              <div className="absolute z-50 w-full bottom-full mb-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto ring-1 ring-black/5 dark:ring-white/10">
                {usuariosParaMencion.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(u);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-100 text-sm border-b border-slate-200 dark:border-slate-700/50 last:border-0 transition-colors"
                  >
                    {u.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Al guardar se agrega sola la fecha y hora actual, como bitácora.
          </p>
          {actividad?.descripcion?.trim() ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Bitácora
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {actividad.descripcion}
              </p>
            </div>
          ) : null}
        </div>

        <ModalFooter className="flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={guardando}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="rounded-xl bg-azul-trifinio text-white hover:bg-azul-trifinio/90"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </ModalFooter>
      </div>
    </ModalShell>
  );
}
