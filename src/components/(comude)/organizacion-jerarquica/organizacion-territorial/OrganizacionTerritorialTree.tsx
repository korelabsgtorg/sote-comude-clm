"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Layers,
  TreePine,
  Home,
  Plus,
  Pencil,
  MapPin,
  Briefcase,
  Crown,
  UserPlus,
  UserMinus,
  UserRound,
  ArrowRightLeft,
  FileText,
  CalendarDays,
  FileCheck,
  Scroll,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodoTerritorial, TipoLugar } from "./lib/zod";
import { TIPO_LABELS, TIPOS_HIJOS } from "./lib/zod";
import {
  OrgActionButton,
  ORG_ACTIONS_BAR,
  ORG_ACTIONS_HOVER,
  type TerritorialAdminHandlers,
} from "./lib/org-actions";

function formatFechaCorto(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso + (iso.includes("T") ? "" : "T12:00:00"));
  if (isNaN(d.getTime())) return "";
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dayName = days[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dayName} ${dd}/${mm}/${yy}`;
}

const ACCORDION_EASE = [0.33, 1, 0.68, 1] as const;

const TIPO_STYLES: Record<
  TipoLugar,
  { icon: typeof Layers; border: string; bg: string; text: string; dot: string }
> = {
  microrregion: {
    icon: Layers,
    border: "border-blue-400/40 dark:border-blue-500/30",
    bg: "bg-blue-50/60 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  aldea: {
    icon: TreePine,
    border: "border-emerald-400/40 dark:border-emerald-500/30",
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  caserio: {
    icon: Home,
    border: "border-amber-400/40 dark:border-amber-500/30",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};

type ExpansionContextValue = {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  allExpanded: boolean;
  setAllExpanded: (expanded: boolean) => void;
};

const ExpansionContext = createContext<ExpansionContextValue | null>(null);

function collectExpandableIds(nodos: NodoTerritorial[]): string[] {
  const ids: string[] = [];
  for (const n of nodos) {
    if (n.hijos && n.hijos.length > 0) {
      ids.push(n.id);
      ids.push(...collectExpandableIds(n.hijos));
    }
    if (n.puestos && n.puestos.length > 0) {
      ids.push(`puestos-${n.id}`);
    }
  }
  return ids;
}

function ExpansionProvider({
  nodos,
  children,
}: {
  nodos: NodoTerritorial[];
  children: ReactNode;
}) {
  const expandableIds = useMemo(() => collectExpandableIds(nodos), [nodos]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(expandableIds.filter((id) => !id.startsWith("puestos-"))),
  );

  useEffect(() => {
    setExpandedIds(
      new Set(expandableIds.filter((id) => !id.startsWith("puestos-"))),
    );
  }, [expandableIds]);

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allExpanded =
    expandableIds.length > 0 &&
    expandableIds.every((id) => expandedIds.has(id));

  const setAllExpanded = useCallback(
    (expanded: boolean) => {
      setExpandedIds(expanded ? new Set(expandableIds) : new Set());
    },
    [expandableIds],
  );

  return (
    <ExpansionContext.Provider
      value={{ isExpanded, toggle, allExpanded, setAllExpanded }}
    >
      {children}
    </ExpansionContext.Provider>
  );
}

function useExpansion() {
  const ctx = useContext(ExpansionContext);
  if (!ctx) throw new Error("useExpansion debe usarse dentro de ExpansionProvider");
  return ctx;
}

export function ToolbarExpansionTerritorial() {
  const { allExpanded, setAllExpanded } = useExpansion();

  return (
    <button
      type="button"
      onClick={() => setAllExpanded(!allExpanded)}
      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {allExpanded ? (
        <>
          <ChevronsUp className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Colapsar todo</span>
        </>
      ) : (
        <>
          <ChevronsDown className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Expandir todo</span>
        </>
      )}
    </button>
  );
}

export type { TerritorialAdminHandlers };

function RowAccionesNode({
  nodo,
  adminHandlers,
  parentId,
}: {
  nodo: NodoTerritorial;
  adminHandlers?: TerritorialAdminHandlers;
  parentId: string | null;
}) {
  if (!adminHandlers) return null;

  return (
    <div className="flex shrink-0 self-stretch items-stretch divide-x divide-emerald-500/30 overflow-visible border-l border-emerald-500/30">
      {TIPOS_HIJOS[nodo.tipo] && (
        <OrgActionButton
          label={`Agregar ${TIPO_LABELS[TIPOS_HIJOS[nodo.tipo]!]}`}
          onClick={() =>
            adminHandlers.onAddComunidad(nodo.id, TIPOS_HIJOS[nodo.tipo]!)
          }
        >
          <Plus className="size-4" strokeWidth={2.25} />
        </OrgActionButton>
      )}

      {(nodo.tipo === "aldea" || nodo.tipo === "caserio") && adminHandlers.onGestionarResolucion && (
        <OrgActionButton
          label="Resolución COCODE"
          onClick={() => adminHandlers.onGestionarResolucion!(nodo.id, nodo.nombre)}
        >
          <Scroll className="size-4" strokeWidth={2.25} />
        </OrgActionButton>
      )}

      {(nodo.tipo === "aldea" || nodo.tipo === "caserio") && adminHandlers.onAddPuesto && (
        <OrgActionButton
          label="Agregar Puesto"
          onClick={() => adminHandlers.onAddPuesto(nodo.id, nodo.nombre)}
        >
          <Briefcase className="size-4" strokeWidth={2.25} />
        </OrgActionButton>
      )}

      <OrgActionButton
        label="Editar"
        onClick={() => adminHandlers.onEditComunidad(nodo.id, nodo.nombre, nodo.tipo, nodo.hijos.length > 0, parentId)}
      >
        <Pencil className="size-4" strokeWidth={2.25} />
      </OrgActionButton>
    </div>
  );
}

function NodoItem({
  nodo,
  adminHandlers,
  parentId = null,
  depth = 0,
}: {
  nodo: NodoTerritorial;
  adminHandlers?: TerritorialAdminHandlers;
  parentId?: string | null;
  depth?: number;
}) {
  const { isExpanded, toggle } = useExpansion();
  const tieneHijos = nodo.hijos.length > 0;
  const tienePuestos = Boolean(nodo.puestos && nodo.puestos.length > 0);
  const expanded = isExpanded(nodo.id);
  const puestosExpanded = isExpanded(`puestos-${nodo.id}`);
  const styles = TIPO_STYLES[nodo.tipo];
  const Icon = styles.icon;

  const canToggleHijos = tieneHijos && nodo.tipo === "microrregion";
  const canTogglePuestos = tienePuestos;
  const canToggle = canToggleHijos || canTogglePuestos;

  const onChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canTogglePuestos) {
      toggle(`puestos-${nodo.id}`);
    } else if (canToggleHijos) {
      toggle(nodo.id);
    }
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          "group/node relative flex min-w-0 items-stretch overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md",
          styles.border,
        )}
      >
        {/* Área clickeable para expandir/colapsar */}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-stretch transition-colors",
            canToggle && "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
          )}
          onClick={canToggle ? onChevronClick : undefined}
          role={canToggle ? "button" : undefined}
        >
          {/* Icono Expandir (Microrregiones o Puestos) */}
          {canToggle ? (
            <div
              className={cn(
                "flex min-h-12 w-11 shrink-0 items-center justify-center",
                styles.text,
              )}
              title={
                canTogglePuestos
                  ? puestosExpanded
                    ? "Ocultar puestos"
                    : "Mostrar puestos"
                  : expanded
                  ? "Colapsar"
                  : "Expandir"
              }
            >
              <motion.div
                animate={{
                  rotate: canTogglePuestos
                    ? puestosExpanded
                      ? 90
                      : 0
                    : expanded
                    ? 90
                    : 0,
                }}
                transition={{ duration: 0.25, ease: ACCORDION_EASE }}
              >
                <ChevronRight className="size-4" strokeWidth={2.5} />
              </motion.div>
            </div>
          ) : (
            <div className="w-4 shrink-0" />
          )}

          {/* Info del Nodo */}
          <div className="flex min-w-0 flex-1 items-center justify-between py-3 pr-3 pl-1">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  styles.bg,
                  styles.text,
                )}
              >
                <Icon className="size-4" strokeWidth={2.25} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-foreground">
                    {nodo.nombre}
                  </p>
                  {(nodo.tipo === "aldea" || nodo.tipo === "caserio") && (
                    nodo.resolucion_vigente ? (
                      nodo.resolucion_vigente.estado_vigencia === "vencido" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                          <XCircle className="size-3" /> Vencido
                        </span>
                      ) : nodo.resolucion_vigente.estado_vigencia === "por_vencer" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="size-3" /> Por Vencer ({nodo.resolucion_vigente.dias_restantes}d)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="size-3" /> Vigente
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                        <Clock className="size-3" /> Sin Resolución
                      </span>
                    )
                  )}
                </div>
                <p className={cn("text-[10px] font-bold uppercase tracking-wider", styles.text)}>
                  {TIPO_LABELS[nodo.tipo]}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones del Nodo */}
        <RowAccionesNode nodo={nodo} adminHandlers={adminHandlers} parentId={parentId} />
      </div>

      {/* Renderizado de Puestos de la Comunidad (ocultos como acordeón) */}
      <AnimatePresence initial={false}>
        {nodo.puestos && nodo.puestos.length > 0 && puestosExpanded && (
          <motion.div
            key={`puestos-${nodo.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: ACCORDION_EASE }}
            className="overflow-hidden mt-2 space-y-2.5"
          >
            {nodo.puestos.map((puesto) => {
              const esJefe = puesto.jefatura_ids.length > 0;
              const tieneTitular = Boolean(puesto.titular);
              return (
                <div
                  key={puesto.id}
                  className={cn(
                    "group/puesto relative flex min-w-0 items-stretch overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md",
                    !esJefe && "ml-4 md:ml-6",
                    esJefe
                      ? "border-purple-500/50 bg-card"
                      : "border-border/60 bg-card"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 md:px-5 md:py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p
                          className={cn(
                            "leading-tight text-foreground text-sm font-semibold tracking-tight md:text-[0.9375rem]",
                            !puesto.activo && "text-muted-foreground opacity-70"
                          )}
                        >
                          {puesto.nombre}
                        </p>

                        {puesto.fecha && (
                          <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-muted-foreground/70">
                            <span className="opacity-50">·</span>
                            <CalendarDays className="size-3.5 opacity-70" />
                            {formatFechaCorto(puesto.fecha)}
                          </div>
                        )}

                        {Boolean(puesto.acreditaciones?.length) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                            <FileCheck className="size-3" />
                            Acreditado
                          </span>
                        )}

                        {!puesto.activo && (
                          <span className="rounded-md bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-700/80 dark:text-zinc-300">
                            Inactivo
                          </span>
                        )}
                      </div>

                      <AnimatePresence initial={false}>
                        {puesto.titular ? (
                          <motion.div
                            key="titular"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: ACCORDION_EASE }}
                            className="mt-1.5 flex items-center gap-2 overflow-hidden"
                          >
                            <span
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full ring-1",
                                esJefe
                                  ? "bg-purple-500/20 text-purple-600 ring-purple-500/30 dark:text-purple-300"
                                  : "bg-zinc-500/12 text-muted-foreground ring-zinc-500/20"
                              )}
                            >
                              <UserRound className="size-3" />
                            </span>
                            <span className="truncate text-xs font-medium text-muted-foreground">
                              {puesto.titular}
                            </span>
                          </motion.div>
                        ) : (
                          <motion.p
                            key="sin-persona"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-1 text-[11px] text-muted-foreground/60 italic"
                          >
                            Sin persona asignada
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Acciones del Puesto */}
                  {adminHandlers && (
                    <div
                      className={cn(
                        "flex shrink-0 self-stretch items-stretch divide-x overflow-visible border-l",
                        esJefe
                          ? "divide-purple-500/35 border-purple-500/25 [&_button]:bg-purple-500/5 [&_button]:text-purple-700 [&_button]:hover:bg-purple-500/12 dark:[&_button]:text-purple-300"
                          : "divide-emerald-500/35 border-emerald-500/25 [&_button]:bg-emerald-500/5 [&_button]:text-emerald-700 [&_button]:hover:bg-emerald-500/12 dark:[&_button]:text-emerald-300"
                      )}
                    >
                      {tieneTitular && adminHandlers.onDesasignarPersona ? (
                        <OrgActionButton
                          label="Desasignar persona"
                          onClick={() => adminHandlers.onDesasignarPersona!(puesto.id, puesto.nombre, puesto.titular!)}
                        >
                          <UserMinus className="size-4" />
                        </OrgActionButton>
                      ) : adminHandlers.onAsignarPersona ? (
                        <OrgActionButton
                          label="Asignar persona"
                          onClick={() => adminHandlers.onAsignarPersona!(puesto.id, puesto.nombre)}
                        >
                          <UserPlus className="size-4" />
                        </OrgActionButton>
                      ) : null}

                      {adminHandlers.onReubicarPuesto && (
                        <OrgActionButton
                          label="Reubicar puesto"
                          onClick={() => adminHandlers.onReubicarPuesto!(puesto.id, puesto.nombre)}
                        >
                          <ArrowRightLeft className="size-4" />
                        </OrgActionButton>
                      )}

                      {adminHandlers.onEditPuesto && (
                        <OrgActionButton
                          label="Editar puesto"
                          onClick={() => adminHandlers.onEditPuesto!(puesto.id)}
                        >
                          <Pencil className="size-4" />
                        </OrgActionButton>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nodos Hijos Anidados (Siempre expandidos si es Aldea o si su nodo está en expanded) */}
      <AnimatePresence initial={false}>
        {tieneHijos && (nodo.tipo === "aldea" || expanded) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: ACCORDION_EASE }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "mt-2 space-y-2",
                nodo.tipo === "microrregion"
                  ? "border-l-2 border-emerald-500/20 pl-3 md:pl-5"
                  : "pl-0"
              )}
            >
              {nodo.hijos.map((hijo) => (
                <NodoItem
                  key={hijo.id}
                  nodo={hijo}
                  adminHandlers={adminHandlers}
                  parentId={nodo.id}
                  depth={depth + 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OrganizacionTerritorialTree({
  nodos,
  municipioNombre,
  adminHandlers,
}: {
  nodos: NodoTerritorial[];
  municipioNombre?: string;
  adminHandlers?: TerritorialAdminHandlers;
}) {
  return (
    <ExpansionProvider nodos={nodos}>
      <div className="space-y-4">
        {/* Contenedor principal de la estructura */}
        <div className="rounded-3xl border border-border/60 bg-zinc-100 p-4 shadow-sm md:p-6 lg:p-8 dark:bg-zinc-800">
          {/* Card Raíz del Municipio */}
          <div className="mb-4 overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4 shadow-sm dark:bg-emerald-950/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    Municipio
                  </p>
                  <h3 className="text-sm font-black text-foreground md:text-base leading-tight">
                    {municipioNombre ?? "Estructura de Cocodes y Territorio del Municipio"}
                  </h3>
                </div>
              </div>

              {adminHandlers && (
                <button
                  type="button"
                  onClick={() => adminHandlers.onAddComunidad(null, "microrregion")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <Plus className="size-3.5" />
                  <span>
                    <span className="hidden sm:inline">Nueva </span>
                    Microrregión
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Lista de Microrregiones con scroll horizontal en móviles */}
          {nodos.length === 0 ? (
            <div className="py-8 text-center text-xs font-medium text-muted-foreground">
              No hay microrregiones registradas. Crea la primera con el botón de arriba.
            </div>
          ) : (
            <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[600px] space-y-2">
                {nodos.map((nodo) => (
                  <NodoItem
                    key={nodo.id}
                    nodo={nodo}
                    adminHandlers={adminHandlers}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar de expansión incorporado dentro del provider */}
        {nodos.length > 0 && (
          <div className="flex items-center justify-between">
            <ToolbarExpansionTerritorial />
          </div>
        )}
      </div>
    </ExpansionProvider>
  );
}
