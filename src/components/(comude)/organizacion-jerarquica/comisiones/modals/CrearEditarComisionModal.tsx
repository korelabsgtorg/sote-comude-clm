"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { comisionSchema, type ComisionFormValues, type ComisionRecord } from "../lib/zod";
import { useCrearComision, useEditarComision } from "../lib/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comisionEditar?: ComisionRecord | null;
}

export function CrearEditarComisionModal({
  open,
  onOpenChange,
  comisionEditar,
}: Props) {
  const isEditing = Boolean(comisionEditar);
  const crearMutation = useCrearComision();
  const editarMutation = useEditarComision();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ComisionFormValues>({
    resolver: zodResolver(comisionSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (comisionEditar) {
        reset({
          nombre: comisionEditar.nombre,
          descripcion: comisionEditar.descripcion ?? "",
        });
      } else {
        reset({
          nombre: "",
          descripcion: "",
        });
      }
    }
  }, [open, comisionEditar, reset]);

  const onSubmit = async (data: ComisionFormValues) => {
    try {
      if (isEditing && comisionEditar) {
        const res = await editarMutation.mutateAsync({
          id: comisionEditar.id,
          values: data,
        });
        if (res.success) {
          toast.success("Comisión actualizada con éxito.");
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Error al actualizar la comisión.");
        }
      } else {
        const res = await crearMutation.mutateAsync(data);
        if (res.success) {
          toast.success("Comisión creada con éxito.");
          onOpenChange(false);
        } else {
          toast.error(res.error ?? "Error al crear la comisión.");
        }
      }
    } catch {
      toast.error("Ocurrió un error inesperado.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Comisión" : "Nueva Comisión"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre de la Comisión</Label>
            <Input
              id="nombre"
              placeholder="Ej. Comisión de Salud"
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="text-xs font-medium text-destructive">
                {errors.nombre.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              rows={3}
              placeholder="Descripción del propósito o alcances de la comisión..."
              {...register("descripcion")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : isEditing
                ? "Guardar Cambios"
                : "Crear Comisión"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
