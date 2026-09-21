"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Building2, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { isSuperOrAdminRole } from "@/components/(base)/dashboard/modules";
import { OrganizacionJerarquica } from "./OrganizacionJerarquica";
import { OrganizacionTerritorial } from "../organizacion-territorial/OrganizacionTerritorial";

type TipoEstructura = "organizacional" | "territorial";

const OPCIONES: {
  id: TipoEstructura;
  label: string;
  desc: string;
  icon: typeof Building2;
  color: string;
  colorActive: string;
  dotColor: string;
}[] = [
  {
    id: "organizacional",
    label: "Organizacional",
    desc: "Organigrama institucional · Departamentos y puestos",
    icon: Building2,
    color:
      "border-celeste-trifinio/30 text-celeste-trifinio hover:bg-celeste-trifinio/5",
    colorActive:
      "border-celeste-trifinio bg-celeste-trifinio/10 text-celeste-trifinio dark:bg-celeste-trifinio/20",
    dotColor: "bg-celeste-trifinio",
  },
  {
    id: "territorial",
    label: "Cocodes y Territorio",
    desc: "Mapa geográfico · Microrregiones, Aldeas y Caseríos",
    icon: Map,
    color:
      "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5 dark:text-emerald-400",
    colorActive:
      "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
];

export function EstructurasPage() {
  const router = useRouter();
  const { effectiveRole } = useUserContext();
  const [activa, setActiva] = useState<TipoEstructura>("organizacional");

  useEffect(() => {
    if (!isSuperOrAdminRole(effectiveRole)) {
      router.replace("/comude");
    }
  }, [effectiveRole, router]);

  if (!isSuperOrAdminRole(effectiveRole)) return null;

  return (
    <div className="relative w-full min-h-0 px-0 pt-2 pb-12 md:min-h-[calc(100vh-4rem)] md:px-8 md:pt-6 md:pb-16 lg:px-12">
      {/* Fondo punteado decorativo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] bg-size-[24px_24px] opacity-50 dark:bg-[radial-gradient(oklch(36%_0_0)_1px,transparent_1px)] dark:opacity-40" />

      <div className="relative z-10 mx-auto w-full max-w-[min(100%,1600px)] space-y-4 md:space-y-6">
        {/* Header con selector */}
        <div className="flex flex-col gap-4 px-4 md:px-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              SOTE-COMUDE
            </p>
            <h1 className="text-2xl font-black tracking-tight text-foreground md:text-4xl">
              Estructuras
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona el tipo de estructura que deseas gestionar.
            </p>
          </div>

          {/* Selector de tipo */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
            {OPCIONES.map((op) => {
              const Icon = op.icon;
              const isActive = activa === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  id={`selector-estructura-${op.id}`}
                  onClick={() => setActiva(op.id)}
                  className={cn(
                    "relative flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 px-5 py-3.5 text-left transition-all duration-200",
                    isActive ? op.colorActive : op.color,
                  )}
                >
                  {/* Indicador activo */}
                  {isActive && (
                    <span
                      className={cn(
                        "absolute top-3 bottom-3 w-1",
                        op.id === "organizacional"
                          ? "right-0 rounded-l-full"
                          : "left-0 rounded-r-full",
                        op.dotColor,
                      )}
                    />
                  )}

                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive
                        ? op.id === "organizacional"
                          ? "bg-celeste-trifinio/20 dark:bg-celeste-trifinio/30"
                          : "bg-emerald-500/20 dark:bg-emerald-500/30"
                        : "bg-zinc-100 dark:bg-zinc-800",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2.25} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wider">
                      {op.label}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium leading-snug text-muted-foreground">
                      {op.desc}
                    </p>
                  </div>

                  {isActive && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white",
                        op.dotColor,
                      )}
                    >
                      Activa
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Separador visual */}
        <div className="h-px w-full bg-border/50 px-4 md:px-0" />

        {/* Contenido de la estructura activa */}
        {activa === "organizacional" ? (
          <OrganizacionJerarquica />
        ) : (
          <OrganizacionTerritorial />
        )}
      </div>
    </div>
  );
}
