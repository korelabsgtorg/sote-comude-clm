"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { TipoLugar } from "./zod";

export type TerritorialAdminHandlers = {
  onAddComunidad: (parentId: string | null, tipo: TipoLugar) => void;
  onAddPuesto: (comunidadId: string, comunidadNombre: string) => void;
  onEditComunidad: (id: string, nombre: string, tipo: TipoLugar, tieneHijos: boolean, parentId: string | null) => void;
  onDeleteComunidad: (id: string, nombre: string, tipo: TipoLugar, tieneHijos: boolean) => void;
  onAsignarPersona?: (puestoId: string, puestoNombre: string) => void;
  onDesasignarPersona?: (puestoId: string, puestoNombre: string, titularNombre: string) => void;
  onReubicarPuesto?: (puestoId: string, puestoNombre: string) => void;
  onEditPuesto?: (puestoId: string) => void;
  onGestionarAcreditaciones?: (puestoId: string, puestoNombre: string) => void;
  onGestionarResolucion?: (comunidadId: string, comunidadNombre: string) => void;
};

export const ORG_ACTION_BTN =
  "flex h-full min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/20";

export const ORG_ACTIONS_BAR =
  "flex shrink-0 items-stretch divide-x divide-emerald-500/30 overflow-visible rounded-lg border border-emerald-500/30 bg-card shadow-sm";

export const ORG_ACTIONS_HOVER =
  "absolute left-full top-1/2 z-10 ml-1.5 hidden -translate-y-1/2 before:absolute before:right-full before:top-0 before:h-full before:w-3 before:content-[''] md:flex md:pointer-events-none md:opacity-0 md:transition-opacity md:group-hover/node:pointer-events-auto md:group-hover/node:opacity-100 md:group-focus-within/node:pointer-events-auto md:group-focus-within/node:opacity-100";

function TreeActionTooltip({
  label,
  anchor,
}: {
  label: string;
  anchor: DOMRect;
}) {
  return createPortal(
    <span
      role="tooltip"
      style={{
        position: "fixed",
        left: anchor.left + anchor.width / 2,
        top: anchor.top - 8,
        transform: "translate(-50%, -100%)",
      }}
      className="pointer-events-none z-[300] whitespace-nowrap rounded-lg border border-border/50 bg-zinc-100 px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-foreground shadow-md dark:bg-zinc-800"
    >
      {label}
    </span>,
    document.body,
  );
}

export function OrgActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltip, setTooltip] = useState<DOMRect | null>(null);

  const showTooltip = () => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setTooltip(rect);
  };

  const hideTooltip = () => setTooltip(null);

  return (
    <div className="relative flex h-full self-stretch">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        className={ORG_ACTION_BTN}
        onClick={onClick}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </button>
      {tooltip ? <TreeActionTooltip label={label} anchor={tooltip} /> : null}
    </div>
  );
}
