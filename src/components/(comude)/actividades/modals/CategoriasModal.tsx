"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Loader2 } from "lucide-react";
import { ModalShell } from "@/components/ui/general-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Swal from "sweetalert2";
import { ActComudeCategoria } from "../lib/zod";
import { useCategorias, useCrearCategoria } from "../lib/hooks";
import { createClient } from "@/utils/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

interface CategoriasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategoria: (categoriaId: string | null) => void;
  selectedCategoriaId?: string | null;
}

export default function CategoriasModal({ isOpen, onClose, onSelectCategoria, selectedCategoriaId }: CategoriasModalProps) {
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');
  const { data: categorias = [], isLoading } = useCategorias();
  const { mutateAsync: crearCategoria, isPending: creando } = useCrearCategoria();
  const queryClient = useQueryClient();

  const categoriasOrdenadas = [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const handleCrearCategoria = async () => {
    if (nuevaCategoriaNombre.trim() !== '') {
      try {
        await crearCategoria(nuevaCategoriaNombre.trim());
        setNuevaCategoriaNombre('');
      } catch (e) {
        toast.error("Error al crear la categoría");
      }
    }
  };

  const handleEditarCategoria = async (categoria: ActComudeCategoria) => {
    const { value: nombre } = await Swal.fire({
      title: 'Editar Categoría',
      input: 'text',
      inputValue: categoria.nombre,
      showCancelButton: true,
      confirmButtonText: 'Guardar Cambios',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Debe tener al menos 3 caracteres';
        }
      }
    });

    if (nombre && nombre.trim() !== categoria.nombre) {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("act_comude_categorias")
          .update({ nombre: nombre.trim() })
          .eq("id", categoria.id);
        
        if (error) throw error;
        toast.success("Categoría actualizada");
        queryClient.invalidateQueries({ queryKey: ["categorias-comude"] });
      } catch (e) {
        toast.error("Error al actualizar la categoría");
      }
    }
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Categorías"
    >
      <div className="flex flex-col max-h-[50vh]">
        <div className="flex gap-2 mb-4 shrink-0">
          <Input
            type="text"
            placeholder="Escriba aquí la nueva categoría..."
            value={nuevaCategoriaNombre}
            onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCrearCategoria();
              }
            }}
            className="flex-grow rounded-xl"
            disabled={creando}
          />
          <Button 
            onClick={handleCrearCategoria} 
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl" 
            size="icon"
            disabled={creando || nuevaCategoriaNombre.trim() === ''}
          >
            {creando ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle size={20} />}
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto min-h-0 custom-scrollbar pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="space-y-1">
              <li className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer ${selectedCategoriaId === null ? 'bg-muted/70 ring-1 ring-border/50' : 'hover:bg-muted/50'}`}
                  onClick={() => {
                    onSelectCategoria(null);
                    onClose();
                  }}>
                <span className={`italic ${selectedCategoriaId === null ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Sin categoría</span>
              </li>
              {categoriasOrdenadas.map(cat => {
                const isSelected = selectedCategoriaId === cat.id;
                return (
                  <li key={cat.id} className={`flex items-center justify-between p-2 rounded-xl transition-colors group ${isSelected ? 'bg-muted/70 ring-1 ring-border/50' : 'hover:bg-muted/50'}`}>
                    <span
                      className={`flex-grow cursor-pointer ${isSelected ? 'text-foreground font-semibold' : 'text-foreground font-medium'}`}
                      onClick={() => {
                        onSelectCategoria(cat.id);
                        onClose();
                      }}
                    >
                      {cat.nombre}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditarCategoria(cat);
                      }}
                      className="p-1.5 text-muted-foreground opacity-0 md:opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted rounded-lg transition-all"
                    >
                      <Pencil size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
