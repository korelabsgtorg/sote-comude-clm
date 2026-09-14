"use client";

import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, MoreVertical } from "lucide-react";
import { ModalShell } from "@/components/ui/general-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Swal from "sweetalert2";
import { useActualizarNotasPunto } from "../lib/hooks";

interface NotasModalProps {
  isOpen: boolean;
  onClose: () => void;
  puntoId: string;
  actComudeId: string;
  notasIniciales: string[] | null;
  canManage: boolean;
}

export default function NotasModal({
  isOpen,
  onClose,
  puntoId,
  actComudeId,
  notasIniciales,
  canManage,
}: NotasModalProps) {
  const [data, setData] = useState<string[]>([]);
  const [nuevoItem, setNuevoItem] = useState("");
  const { mutateAsync: actualizarNotas, isPending } = useActualizarNotasPunto();

  useEffect(() => {
    setData(notasIniciales || []);
  }, [notasIniciales, isOpen]);

  const handleAdd = async () => {
    if (!nuevoItem.trim()) return;
    const newData = [...data, nuevoItem.trim()];
    
    try {
      await actualizarNotas({ puntoId, notas: newData, actComudeId });
      setData(newData);
      setNuevoItem("");
    } catch (error) {
      console.error("Error agregando nota", error);
    }
  };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(data[index]);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null) return;
    
    if (editValue.trim() && editValue.trim() !== data[editingIndex]) {
      const newData = [...data];
      newData[editingIndex] = editValue.trim();
      try {
        await actualizarNotas({ puntoId, notas: newData, actComudeId });
        setData(newData);
      } catch (error) {
        console.error("Error editando nota", error);
      }
    }
    setEditingIndex(null);
    setEditValue("");
  };

  const handleDelete = async (index: number) => {
    const result = await Swal.fire({
      title: "¿Está seguro?",
      text: "Esta acción no se puede revertir.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      const newData = data.filter((_, i) => i !== index);
      try {
        await actualizarNotas({ puntoId, notas: newData, actComudeId });
        setData(newData);
      } catch (error) {
        console.error("Error eliminando nota", error);
      }
    }
  };

  return (
    <ModalShell open={isOpen} onClose={onClose} title="Notas del Punto" className="max-w-xl sm:max-w-2xl">
      <div className="flex flex-col gap-3">
        {canManage && (
          <div className="flex gap-2">
            <Input
              placeholder="Nueva nota..."
              value={nuevoItem}
              onChange={(e) => setNuevoItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="flex-grow rounded-xl bg-white dark:bg-neutral-950 dark:border-neutral-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              disabled={isPending}
            />
            <Button
              onClick={handleAdd}
              disabled={!nuevoItem.trim() || isPending}
              className="rounded-xl bg-azul-trifinio text-white hover:bg-azul-trifinio/90"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus size={16} />}
            </Button>
          </div>
        )}

        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-6 text-sm italic">
            No hay notas para este punto.
          </p>
        ) : (
          <>
            {/* Vista PC: Tabla No. || Nota || Acciones */}
            <div className="hidden sm:block max-h-[55vh] overflow-y-auto custom-scrollbar border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-muted-foreground uppercase">
                    <th className="px-3 py-1.5 text-center w-12 border-r border-zinc-200 dark:border-zinc-800">No.</th>
                    <th className="px-4 py-1.5 text-left border-r border-zinc-200 dark:border-zinc-800">Nota</th>
                    {canManage && <th className="px-3 py-1.5 text-center w-20">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 text-center text-xs font-bold text-muted-foreground border-r border-zinc-200 dark:border-zinc-800 align-top">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 align-top">
                        {editingIndex === index ? (
                          <textarea
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full text-sm bg-background border border-border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-azul-trifinio resize-y min-h-[60px]"
                          />
                        ) : (
                          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                            {item}
                          </p>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-center align-top">
                          {editingIndex === index ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleCancelEdit}
                                disabled={isPending}
                              >
                                ✕
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs bg-azul-trifinio text-white hover:bg-azul-trifinio/90"
                                onClick={handleSaveEdit}
                                disabled={!editValue.trim() || isPending}
                              >
                                Guardar
                              </Button>
                            </div>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  disabled={isPending || editingIndex !== null}
                                  title="Acciones"
                                >
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32 z-[1100]">
                                <DropdownMenuItem onClick={() => handleStartEdit(index)} className="cursor-pointer">
                                  <Pencil size={14} className="mr-2 text-blue-500" />
                                  <span>Editar</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(index)} className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                                  <Trash2 size={14} className="mr-2" />
                                  <span>Eliminar</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vista Móvil: Tarjetas */}
            <ul className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 min-h-0 sm:hidden">
              {data.map((item, index) => {
                if (editingIndex !== null && editingIndex !== index) return null;
                return (
                <li
                  key={index}
                  className="flex flex-col px-4 pt-4 rounded-xl bg-muted/30 dark:bg-neutral-800/50 transition-colors border border-border/50"
                >
                  {data.length > 1 && (
                    <div className="flex items-center w-full mb-2">
                      <div className="flex-1 h-px bg-border/50"></div>
                      <span className="flex-shrink-0 mx-3 text-[10px] text-muted-foreground font-bold tracking-widest">
                        {index + 1}
                      </span>
                      <div className="flex-1 h-px bg-border/50"></div>
                    </div>
                  )}

                  <div className="w-full flex-1 mb-4">
                    {editingIndex === index ? (
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full text-sm bg-background border border-border/60 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-azul-trifinio/50 resize-y min-h-[80px]"
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                        {item}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex justify-end gap-1 w-full border-t border-border/50 pt-2 pb-2">
                      {editingIndex === index ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted h-7"
                            onClick={handleCancelEdit}
                            disabled={isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs bg-azul-trifinio text-white hover:bg-azul-trifinio/90 h-7"
                            onClick={handleSaveEdit}
                            disabled={!editValue.trim() || isPending}
                          >
                            Guardar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 h-7"
                            onClick={() => handleStartEdit(index)}
                            disabled={isPending || editingIndex !== null}
                          >
                            <Pencil size={14} className="mr-1.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 h-7"
                            onClick={() => handleDelete(index)}
                            disabled={isPending || editingIndex !== null}
                          >
                            <Trash2 size={14} className="mr-1.5" />
                            Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </ModalShell>
  );
}
