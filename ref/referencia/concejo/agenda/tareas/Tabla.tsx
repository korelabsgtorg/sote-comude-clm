'use client';

import { useMemo, useState, type MouseEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Edit, FileText, ClipboardList, Paperclip, User } from 'lucide-react';
import { Tarea } from '../lib/esquemas';
import { Button } from '@/components/ui/button';

function BadgeConteoDocumentos({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0066cc] px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white dark:bg-blue-400 dark:text-zinc-900 dark:ring-zinc-900">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function BotonDocumentos({
  count,
  onClick,
  variant = 'icon',
}: {
  count: number;
  onClick: (e: MouseEvent) => void;
  variant?: 'icon' | 'text';
}) {
  if (variant === 'text') {
    return (
      <Button
        onClick={onClick}
        variant="outline"
        size="sm"
        className="relative bg-white hover:bg-gray-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-xs h-8 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
      >
        <span className="relative mr-1.5 inline-flex">
          <Paperclip size={14} />
          <BadgeConteoDocumentos count={count} />
        </span>
        Ver Documentos
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="relative h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30"
    >
      <Paperclip className="h-4 w-4" />
      <BadgeConteoDocumentos count={count} />
    </Button>
  );
}

const statusStyles: Record<string, string> = {
  'Aprobado': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'No aprobado': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  'En progreso': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'En comisión': 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700',
  'En espera': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  'No iniciado': 'bg-white text-gray-800 border-gray-200 dark:bg-neutral-900 dark:text-gray-300 dark:border-neutral-800',
  'Realizado': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
};

const votacionStyles: Record<string, string> = {
  'P1': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  'Unanimidad': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'Ver Notas': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  'Realizado': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
};

const celdaBadgeClass =
  'inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight';

const getEstadoBadgeClasses = (status: string | null) => {
  if (!status) return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
  return statusStyles[status] || 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
};

const getVotacionBadgeClasses = (votacion: string | null) => {
  if (!votacion) return 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500';
  return votacionStyles[votacion] || 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
};

const getStatusClasses = (status: string | null) => {
  if (!status) return 'bg-transparent';
  return statusStyles[status] || 'bg-transparent';
};

const getVotacionClasses = (votacion: string | null) => {
  if (!votacion) return 'bg-transparent';
  return votacionStyles[votacion] || 'bg-transparent';
};

interface TablaProps {
  rol: string;
  tareas: Tarea[];
  handleOpenEditModal: (tarea: Tarea) => void;
  handleOpenNotasModal: (tarea: Tarea) => void;
  handleOpenActividadesModal: (tarea: Tarea) => void;
  handleOpenDocumentosModal: (tarea: Tarea) => void;
  estadoAgenda: string;
}

export default function Tabla({ rol, tareas, handleOpenEditModal, handleOpenNotasModal, handleOpenActividadesModal, handleOpenDocumentosModal, estadoAgenda }: TablaProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const puedeEditar = ['SUPER', 'SECRETARIO', 'SEC-TECNICO'].includes(rol);

  const columns = useMemo<ColumnDef<Tarea>[]>(() => {
    const baseColumns: ColumnDef<Tarea>[] = [
      {
        accessorKey: 'id',
        header: '#',
        size: 30,
        cell: (info) => (
          <div className="flex justify-center items-center h-full text-gray-700 dark:text-gray-300">
            {info.row.index + 1}
          </div>
        ),
      },
      {
        accessorKey: 'documentos',
        header: 'Docs',
        size: 50,
        cell: info => (
          <div className="flex justify-center items-center h-full">
            <BotonDocumentos
              count={info.row.original.total_documentos ?? 0}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDocumentosModal(info.row.original);
              }}
            />
          </div>
        ),
      },
      {
        accessorKey: 'titulo_item',
        header: 'Punto a Tratar',
        size: 200,
        cell: info => <div className="flex justify-start items-center h-full text-left text-gray-800 dark:text-gray-200">{info.getValue() as string}</div>,
      },
      {
        accessorKey: 'estado',
        header: 'Estado',
        size: 108,
        cell: info => (
          <div className="flex justify-center items-center h-full px-0.5">
            <span className={`${celdaBadgeClass} ${getEstadoBadgeClasses(info.getValue() as string)}`}>
              {info.getValue() as string}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'votacion',
        header: 'Votación',
        size: 108,
        cell: info => (
          <div className="flex justify-center items-center h-full px-0.5">
            <span className={`${celdaBadgeClass} ${getVotacionBadgeClasses(info.getValue() as string | null)}`}>
              {(info.getValue() as string) || '-'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'categoria.nombre',
        header: 'Categoría',
        size: 170,
        cell: info => <div className="flex justify-start items-center h-full text-left text-gray-700 dark:text-gray-300">{info.getValue() as string}</div>,
      },
    ];

    if (estadoAgenda === 'En progreso' || estadoAgenda === 'Finalizada') {
      baseColumns.push(
        {
          accessorKey: 'notas',
          header: 'Notas',
          size: 350,
          cell: info => (
            <div className="flex flex-col gap-2 w-full justify-start items-start max-h-32 overflow-y-auto custom-scrollbar">
              {(info.getValue() as string[] | null)?.map((nota, index, array) => (
                <div key={index} className="w-full">
                  {array.length > 1 && index > 0 && <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1 w-full"></div>}
                  <p className="text-xs text-gray-600 dark:text-gray-400">{nota}</p>
                </div>
              )) || <span className="text-gray-400 dark:text-gray-600 text-xs italic"></span>}
            </div>
          ),
        },
        {
          accessorKey: 'actividades',
          header: 'Actividades asignadas',
          size: 350,
          cell: info => {
            const actividades = info.row.original.actividades || [];
            if (actividades.length === 0) {
              return <span className="text-gray-400 dark:text-gray-600 text-xs italic">Sin actividades</span>;
            }
            return (
              <ol className="flex flex-col gap-1.5 w-full justify-start items-start max-h-32 overflow-y-auto custom-scrollbar">
                {actividades.map((actividad, index) => (
                  <li key={actividad.id} className="w-full flex items-start gap-1.5">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 shrink-0">{index + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-snug">{actividad.title}</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                        <User size={10} /> {actividad.assignee_nombre}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            );
          },
        },
      );
    }

    return baseColumns;
  }, [estadoAgenda]);

  const table = useReactTable({
    data: tareas,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  });

  const toggleAccordion = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (tareas.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-neutral-800 rounded-lg bg-gray-50 dark:bg-neutral-900">
        <p className="text-gray-500 dark:text-gray-400">Aún no hay tareas creadas para esta agenda.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      
      <div className="hidden md:block w-full overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-neutral-800">
        <table className="min-w-max w-full table-fixed bg-white dark:bg-neutral-900">
          <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="p-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-neutral-800 last:border-r-0 relative"
                    style={{ width: `${header.getSize()}px` }}
                  >
                    {header.isPlaceholder ? null : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none ${
                        header.column.getIsResizing() ? 'bg-blue-500 opacity-100' : 'bg-transparent hover:bg-gray-300 dark:hover:bg-neutral-700'
                      }`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={`p-2 text-sm border-r border-gray-100 dark:border-neutral-800 last:border-r-0 
                      ${puedeEditar && cell.column.id !== 'documentos' ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-default'}
                    `}
                    style={{ width: `${cell.column.getSize()}px` }}
                    onClick={() => {
                      if (cell.column.id === 'documentos') return; 
                      
                      if (!puedeEditar) return;

                      if (cell.column.id === 'notas') {
                        handleOpenNotasModal(row.original);
                      } else if (cell.column.id === 'actividades') {
                        handleOpenActividadesModal(row.original);
                      } else {
                        handleOpenEditModal(row.original);
                      }
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col gap-3">
        {tareas.map((tarea, index) => {
          const isExpanded = expandedId === tarea.id;
          const estadoClass = getStatusClasses(tarea.estado);
          const tieneNotas = tarea.notas && tarea.notas.length > 0;
          const actividades = tarea.actividades || [];
          const tieneActividades = actividades.length > 0;

          const mostrarNotas = tieneNotas || puedeEditar;
          const mostrarActividades = tieneActividades || puedeEditar;
          
          return (
            <div 
              key={tarea.id} 
              className={`bg-white dark:bg-neutral-900 rounded-lg border transition-all duration-200 overflow-hidden ${
                isExpanded 
                  ? 'shadow-md border-blue-200 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900' 
                  : 'border-gray-200 dark:border-neutral-800 shadow-sm'
              }`}
            >
              <div 
                onClick={() => toggleAccordion(tarea.id)}
                className="p-4 flex items-start justify-between gap-3 cursor-pointer bg-white dark:bg-neutral-900 active:bg-gray-50 dark:active:bg-neutral-800"
              >
                <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500">#{index + 1}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${estadoClass}`}>
                            {tarea.estado}
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">
                        {tarea.titulo_item}
                    </p>
                </div>
                <div className="text-gray-400 dark:text-gray-500 mt-1">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-950/50">
                  
                  <div className="mt-3 flex justify-end">
                      <BotonDocumentos
                        count={tarea.total_documentos ?? 0}
                        variant="text"
                        onClick={() => handleOpenDocumentosModal(tarea)}
                      />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Categoría</span>
                        <p className="text-gray-700 dark:text-gray-300 mt-0.5">{tarea.categoria?.nombre || '-'}</p>
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Votación</span>
                        <div className={`mt-0.5 inline-block px-2 py-0.5 rounded text-xs font-medium ${getVotacionClasses(tarea.votacion || null)}`}>
                            {tarea.votacion || 'Pendiente'}
                        </div>
                    </div>
                  </div>

                  {(estadoAgenda === 'En progreso' || estadoAgenda === 'Finalizada') && (
                    <div className="mt-4 space-y-3">
                        {mostrarNotas && (
                            <div className="bg-white dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                    <FileText size={12} /> Notas
                                </p>
                                {tieneNotas ? (
                                    <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-300 space-y-1">
                                        {tarea.notas!.map((n, i) => <li key={i}>{n}</li>)}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-400 dark:text-gray-600 italic">Sin notas registradas</p>
                                )}
                            </div>
                        )}

                        {mostrarActividades && (
                            <div className="bg-white dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                                    <ClipboardList size={12} /> Actividades asignadas
                                </p>
                                {tieneActividades ? (
                                    <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
                                        {actividades.map((actividad, i) => (
                                            <li key={actividad.id} className="flex items-start gap-1.5">
                                                <span className="font-bold text-gray-400 dark:text-gray-500">{i + 1}.</span>
                                                <span className="min-w-0">
                                                    {actividad.title}
                                                    <span className="block text-[10px] text-gray-400 dark:text-gray-500">{actividad.assignee_nombre}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="text-xs text-gray-400 dark:text-gray-600 italic">Sin actividades</p>
                                )}
                            </div>
                        )}
                    </div>
                  )}

                  {puedeEditar && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 dark:border-neutral-800 pt-3">
                        <Button 
                            onClick={() => handleOpenEditModal(tarea)} 
                            variant="outline" 
                            size="sm"
                            className="flex-1 bg-white hover:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-gray-300 dark:border-neutral-700 text-xs h-8"
                        >
                            <Edit size={14} className="mr-1.5" /> Editar Estado
                        </Button>

                        {(estadoAgenda === 'En progreso' || estadoAgenda === 'Finalizada') && (
                            <>
                                <Button 
                                    onClick={() => handleOpenNotasModal(tarea)} 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1 bg-white hover:bg-yellow-50 dark:bg-neutral-800 dark:hover:bg-yellow-900/20 dark:text-gray-300 dark:border-neutral-700 text-xs h-8"
                                >
                                    <FileText size={14} className="mr-1.5" /> + Notas
                                </Button>
                                <Button 
                                    onClick={() => handleOpenActividadesModal(tarea)} 
                                    variant="outline" 
                                    size="sm"
                                    className="flex-1 bg-white hover:bg-blue-50 dark:bg-neutral-800 dark:hover:bg-blue-900/20 dark:text-gray-300 dark:border-neutral-700 text-xs h-8"
                                >
                                    <ClipboardList size={14} className="mr-1.5" /> Actividades
                                </Button>
                            </>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}