"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Re-export toast for convenience ─────────────────────────────────────────
export { toast };

// ─── Modal Shell ──────────────────────────────────────────────────────────────
interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: ModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          "max-w-md w-full rounded-2xl border border-border/60 bg-background p-0 shadow-xl",
          className,
        )}
      >
        <DialogHeader className="px-4 py-1.5 border-b border-border/50">
          <DialogTitle className="text-sm font-black tracking-tight text-foreground">
            {title}
          </DialogTitle>
          {subtitle && (
            <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </DialogHeader>
        <div className="px-4 pt-1.5 pb-2.5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Form primitives ─────────────────────────────────────────────────────────
export function ModalLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      className={cn("text-xs font-bold text-foreground", className)}
      {...props}
    />
  );
}

export function ModalInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "rounded-xl border-border/60 bg-zinc-50 dark:bg-zinc-900 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function ModalTextarea({
  className,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      rows={3}
      className={cn(
        "rounded-xl border-border/60 bg-zinc-50 dark:bg-zinc-900 text-sm resize-none",
        className,
      )}
      {...props}
    />
  );
}

export function ModalSubmit({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="submit"
      className={cn(
        "w-full rounded-xl bg-celeste-trifinio font-bold text-white hover:bg-celeste-trifinio/90",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-6 flex flex-col gap-2", className)}>{children}</div>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────
interface ModalConfirmDeleteProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  loading?: boolean;
  hideConfirm?: boolean;
}

export function ModalConfirmDelete({
  open,
  onClose,
  onConfirm,
  title = "¿Eliminar?",
  description = "Esta acción no se puede deshacer.",
  loading = false,
  hideConfirm = false,
}: ModalConfirmDeleteProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl border border-border/60 bg-background p-6 shadow-xl">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50">
            <Trash2 className="size-4 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="mt-3 text-base font-black text-foreground">
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>
        <div className="mt-5 flex flex-col gap-2">
          {!hideConfirm && (
            <Button
              variant="destructive"
              className="w-full rounded-xl font-bold"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          )}
          <Button
            variant={hideConfirm ? "default" : "outline"}
            className="w-full rounded-xl font-bold"
            onClick={onClose}
            disabled={loading}
          >
            {hideConfirm ? "Entendido" : "Cancelar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ─── Helper ───────────────────────────────────────────────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "No tienes permiso para realizar esta acción.",
  FORBIDDEN: "Acceso denegado.",
  INVALID_INPUT: "Los datos ingresados no son válidos.",
  SAVE_FAILED: "No se pudo guardar. Intenta de nuevo.",
  DELETE_FAILED: "No se pudo eliminar. Intenta de nuevo.",
  CYCLE: "No se puede asignar un elemento como hijo de sí mismo.",
  HAS_CHILDREN: "No se puede eliminar porque tiene elementos dependientes.",
  LOAD_FAILED: "No se pudieron cargar los datos.",
  ASSIGN_FAILED: "No se pudo asignar. Intenta de nuevo.",
  JEFE_REQUIRED: "Esta dependencia ya tiene puestos. Debe haber un jefe antes de agregar más.",
  FIRST_PUESTO_JEFE_REQUIRED: "El primer puesto de una dependencia debe ser un jefe.",
  JEFE_REQUIRED_LEAVE: "No se puede eliminar: quedaría un equipo sin jefe.",
  DROP_ES_JEFATURA: "No se puede quitar la jefatura si el puesto es de tipo jefe.",
  JEFATURAS_SYNC_FAILED: "No se pudieron sincronizar las jefaturas.",
};

/**
 * Convierte un código de error de la API en un mensaje legible.
 * Si no hay código conocido, devuelve el fallback proporcionado.
 */
export function modalActionMessage(
  errorCode: string | undefined,
  fallback: string,
): string {
  if (!errorCode) return fallback;
  return ERROR_MESSAGES[errorCode] ?? fallback;
}
