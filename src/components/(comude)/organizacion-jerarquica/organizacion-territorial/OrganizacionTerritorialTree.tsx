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
  ChevronDown,
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
  Search,
  X,
  Sparkles,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodoTerritorial, TipoLugar } from "./lib/zod";
import { TIPO_LABELS, TIPOS_HIJOS, normalizeText } from "./lib/zod";
import {
  OrgActionButton,
  ORG_ACTIONS_BAR,
  ORG_ACTIONS_HOVER,
  type TerritorialAdminHandlers,
} from "./lib/org-actions";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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
  autoExpandIds,
  children,
}: {
  nodos: NodoTerritorial[];
  autoExpandIds?: Set<string>;
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

  useEffect(() => {
    if (autoExpandIds && autoExpandIds.size > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of autoExpandIds) {
          next.add(id);
        }
        return next;
      });
    }
  }, [autoExpandIds]);

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

function filtrarArbolTerritorial(
  nodos: NodoTerritorial[],
  term: string,
  tipoFiltro: TipoLugar | "todos" = "todos",
  microrregionId: string | "todas" = "todas",
): {
  filtered: NodoTerritorial[];
  matchingIds: Set<string>;
  ancestorIds: Set<string>;
  totalMatches: number;
} {
  const normTerm = normalizeText(term);
  const matchingIds = new Set<string>();
  const ancestorIds = new Set<string>();
  let totalMatches = 0;

  // Si hay filtro por microrregión específica, reducimos el conjunto base
  const nodosBase =
    microrregionId === "todas"
      ? nodos
      : nodos.filter((n) => n.id === microrregionId);

  // Si solo estamos seleccionando una microrregión sin término de búsqueda ni filtro de tipo (aldea/caserío),
  // devolvemos la microrregión intacta con todos sus hijos.
  if (!normTerm && tipoFiltro === "todos") {
    return {
      filtered: nodosBase,
      matchingIds,
      ancestorIds,
      totalMatches: 0,
    };
  }

  // Si el filtro es exclusivamente 'caserio', extraemos todos los caseríos de cada microrregión
  // y los mostramos directamente bajo su microrregión correspondiente, omitiendo las aldeas intermedias.
  if (tipoFiltro === "caserio") {
    const filtered: NodoTerritorial[] = [];

    for (const microrreg of nodosBase) {
      const caseriosDeMicrorreg: NodoTerritorial[] = [];

      function recolectarCaserios(item: NodoTerritorial) {
        if (item.tipo === "caserio") {
          const matchTerm = !normTerm || normalizeText(item.nombre).includes(normTerm);
          if (matchTerm) {
            caseriosDeMicrorreg.push(item);
            matchingIds.add(item.id);
            totalMatches++;
          }
        }
        if (item.hijos && item.hijos.length > 0) {
          for (const h of item.hijos) {
            recolectarCaserios(h);
          }
        }
      }

      recolectarCaserios(microrreg);

      if (caseriosDeMicrorreg.length > 0) {
        ancestorIds.add(microrreg.id);
        filtered.push({
          ...microrreg,
          hijos: caseriosDeMicrorreg,
        });
      }
    }

    return { filtered, matchingIds, ancestorIds, totalMatches };
  }

  function walk(
    node: NodoTerritorial,
    ancestors: string[],
  ): { node: NodoTerritorial; matches: boolean } | null {
    const matchesSearch = !normTerm || normalizeText(node.nombre).includes(normTerm);
    const matchesTipo = tipoFiltro === "todos" || node.tipo === tipoFiltro;

    // Solo marcamos como resaltado visual (directMatch) si el usuario buscó por texto o filtró por un tipo específico (aldea/caserio)
    const tieneCriterioResaltado = Boolean(normTerm) || tipoFiltro !== "todos";
    const isDirectMatch = tieneCriterioResaltado && matchesSearch && matchesTipo;

    if (isDirectMatch) {
      matchingIds.add(node.id);
      totalMatches++;
      ancestors.forEach((id) => ancestorIds.add(id));
    }

    const filteredChildren: NodoTerritorial[] = [];
    if (node.hijos && node.hijos.length > 0) {
      for (const child of node.hijos) {
        const res = walk(child, [...ancestors, node.id]);
        if (res) {
          filteredChildren.push(res.node);
        }
      }
    }

    if (isDirectMatch || filteredChildren.length > 0) {
      if (filteredChildren.length > 0) {
        ancestorIds.add(node.id);
      }
      return {
        node: {
          ...node,
          hijos:
            filteredChildren.length > 0
              ? filteredChildren
              : isDirectMatch && tipoFiltro === "todos"
              ? node.hijos
              : [],
        },
        matches: true,
      };
    }

    return null;
  }

  const filtered: NodoTerritorial[] = [];
  for (const n of nodosBase) {
    const res = walk(n, []);
    if (res) {
      filtered.push(res.node);
    }
  }

  return { filtered, matchingIds, ancestorIds, totalMatches };
}

function NodoItem({
  nodo,
  adminHandlers,
  parentId = null,
  depth = 0,
  matchingIds,
}: {
  nodo: NodoTerritorial;
  adminHandlers?: TerritorialAdminHandlers;
  parentId?: string | null;
  depth?: number;
  matchingIds?: Set<string>;
}) {
  const { isExpanded, toggle } = useExpansion();
  const tieneHijos = nodo.hijos.length > 0;
  const tienePuestos = Boolean(nodo.puestos && nodo.puestos.length > 0);
  const expanded = isExpanded(nodo.id);
  const puestosExpanded = isExpanded(`puestos-${nodo.id}`);
  const isDirectMatch = Boolean(matchingIds?.has(nodo.id));
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
          isDirectMatch && "!border-2 !border-emerald-500 shadow-md bg-emerald-50/20 dark:bg-emerald-950/20",
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
                "mt-2.5 mb-1 space-y-2.5 pb-1",
                nodo.tipo === "microrregion"
                  ? "border-l-2 border-emerald-500/20 pl-3 md:pl-5 pr-1"
                  : "pl-0 pr-1"
              )}
            >
              {nodo.hijos.map((hijo) => (
                <NodoItem
                  key={hijo.id}
                  nodo={hijo}
                  adminHandlers={adminHandlers}
                  parentId={nodo.id}
                  depth={depth + 1}
                  matchingIds={matchingIds}
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
  counts,
  municipioNombre,
  adminHandlers,
}: {
  nodos: NodoTerritorial[];
  counts?: { microrregiones: number; aldeas: number; caserios: number };
  municipioNombre?: string;
  adminHandlers?: TerritorialAdminHandlers;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoLugar | "todos">("todos");
  const [microrregionId, setMicrorregionId] = useState<string | "todas">("todas");

  const toggleTipoFiltro = (tipo: TipoLugar) => {
    setTipoFiltro((prev) => (prev === tipo ? "todos" : tipo));
  };

  const { filtered, matchingIds, ancestorIds, totalMatches } = useMemo(
    () => filtrarArbolTerritorial(nodos, searchTerm, tipoFiltro, microrregionId),
    [nodos, searchTerm, tipoFiltro, microrregionId],
  );

  const microrregionesList = useMemo(
    () => nodos.filter((n) => n.tipo === "microrregion"),
    [nodos],
  );

  const microrregionSeleccionada = useMemo(
    () => microrregionesList.find((m) => m.id === microrregionId),
    [microrregionesList, microrregionId],
  );

  // Conteo dinámico: Si hay una microrregión seleccionada, contamos solo sus aldeas y caseríos
  const activeCounts = useMemo(() => {
    if (!microrregionSeleccionada) {
      return counts ?? { microrregiones: 0, aldeas: 0, caserios: 0 };
    }
    let aldeas = 0;
    let caserios = 0;

    function walkCounts(node: NodoTerritorial) {
      if (node.tipo === "aldea") aldeas++;
      else if (node.tipo === "caserio") caserios++;
      if (node.hijos && node.hijos.length > 0) {
        for (const h of node.hijos) walkCounts(h);
      }
    }

    walkCounts(microrregionSeleccionada);
    return {
      microrregiones: 1,
      aldeas,
      caserios,
    };
  }, [counts, microrregionSeleccionada]);

  const isSearching =
    searchTerm.trim().length > 0 ||
    tipoFiltro !== "todos" ||
    microrregionId !== "todas";

  return (
    <ExpansionProvider nodos={nodos} autoExpandIds={ancestorIds}>
      <div className="space-y-4">
        {/* Jerarquía Territorial (Contadores) + Buscador */}
        <div className="space-y-3 px-4 md:px-0">
          <div className="flex items-center justify-between lg:hidden">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Jerarquía Territorial
            </p>
            {(tipoFiltro !== "todos" || microrregionId !== "todas") && (
              <button
                type="button"
                onClick={() => {
                  setTipoFiltro("todos");
                  setMicrorregionId("todas");
                }}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Quitar filtros
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Barra de Búsqueda (A la izquierda en PC, debajo en móvil) */}
            <div className="order-2 lg:order-1 flex items-center gap-2 w-full lg:flex-1 lg:max-w-lg">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    microrregionSeleccionada
                      ? `En ${microrregionSeleccionada.nombre}...`
                      : tipoFiltro === "aldea"
                      ? "Buscando en Aldeas..."
                      : tipoFiltro === "caserio"
                      ? "Buscando en Caseríos..."
                      : "Buscar lugar registrado..."
                  }
                  className="h-10 rounded-2xl border-border/70 bg-card pl-10 pr-10 text-xs sm:text-sm shadow-sm transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                {isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setTipoFiltro("todos");
                      setMicrorregionId("todas");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800 cursor-pointer"
                    title="Limpiar búsqueda y filtros"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Jerarquía Territorial: Microrregiones, Aldeas, Caseríos */}
            {counts && (
              <div className="order-1 lg:order-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:items-center lg:gap-3 lg:shrink-0">
                {/* Microrregión (Dropdown Select natural) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title={
                        microrregionSeleccionada
                          ? `Filtrado por: ${microrregionSeleccionada.nombre}`
                          : "Elegir microrregión para ver"
                      }
                      className={cn(
                        "relative flex items-stretch justify-between overflow-hidden rounded-xl border-2 lg:w-[320px] xl:w-[340px] cursor-pointer text-left transition-all bg-blue-50/50 dark:bg-blue-950/20",
                        microrregionId !== "todas"
                          ? "border-blue-600 shadow-md ring-2 ring-blue-500/30 dark:border-blue-400"
                          : "border-blue-500/40 hover:bg-blue-500/15 hover:border-blue-500/70 dark:hover:bg-blue-950/30",
                      )}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        {/* Celda del icono al ras */}
                        <div
                          className={cn(
                            "flex self-stretch shrink-0 items-center justify-center px-3 border-r bg-blue-500/20 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:bg-blue-500/25 transition-colors",
                            microrregionId !== "todas" && "border-blue-500/50",
                          )}
                        >
                          <Layers className="size-4.5" />
                        </div>

                        {/* Texto */}
                        <div className="min-w-0 flex-1 px-2.5 py-1.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <h3 className="truncate text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                              {microrregionSeleccionada
                                ? microrregionSeleccionada.nombre
                                : counts.microrregiones === 1
                                ? "Microrregión"
                                : "Microrregiones"}
                            </h3>
                            <ChevronDown className="size-3 shrink-0 text-blue-600/70 dark:text-blue-400/70" />
                          </div>
                          <p className="text-[10px] lg:text-[9px] font-semibold text-muted-foreground leading-none">
                            {microrregionId !== "todas" ? "Filtrado" : "Nivel 1"}
                          </p>
                        </div>
                      </div>

                      {/* Badge Contador */}
                      <div className="flex shrink-0 items-center pr-2.5 pl-1 py-1.5">
                        <div
                          className={cn(
                            "flex items-center rounded-lg px-2 py-0.5 transition-colors",
                            microrregionId !== "todas"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
                          )}
                        >
                          <span className="text-xs font-black tracking-tight">
                            {microrregionId !== "todas" ? "1" : counts.microrregiones}
                          </span>
                        </div>
                      </div>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="center"
                    sideOffset={8}
                    className="w-[calc(100vw-2.5rem)] max-w-xs sm:w-72 rounded-2xl border-border/80 bg-card p-1.5 shadow-xl"
                  >
                    <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Seleccionar Microrregión
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-1 bg-border/60" />

                    <DropdownMenuItem
                      onClick={() => setMicrorregionId("todas")}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors",
                        microrregionId === "todas"
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-blue-600 dark:text-blue-400" />
                        <span>Todas las microrregiones</span>
                      </div>
                      {microrregionId === "todas" && (
                        <Check className="size-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </DropdownMenuItem>

                    {microrregionesList.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => setMicrorregionId(m.id)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
                          microrregionId === m.id
                            ? "bg-blue-500/15 text-blue-700 font-bold dark:text-blue-300"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="size-2 shrink-0 rounded-full bg-blue-500" />
                          <span className="truncate">{m.nombre}</span>
                        </div>
                        {microrregionId === m.id && (
                          <Check className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Aldea (Filtro interactivo) */}
                <button
                  type="button"
                  onClick={() => toggleTipoFiltro("aldea")}
                  title={tipoFiltro === "aldea" ? "Quitar filtro de Aldeas" : "Filtrar por Aldeas"}
                  className={cn(
                    "relative flex items-stretch justify-between overflow-hidden rounded-xl border-2 lg:w-[195px] cursor-pointer text-left transition-all bg-emerald-50/50 dark:bg-emerald-950/20",
                    tipoFiltro === "aldea"
                      ? "border-emerald-600 shadow-md ring-2 ring-emerald-500/30 dark:border-emerald-400"
                      : "border-emerald-500/40 hover:bg-emerald-500/15 hover:border-emerald-500/70 dark:hover:bg-emerald-950/30",
                  )}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    {/* Celda del icono al ras */}
                    <div
                      className={cn(
                        "flex self-stretch shrink-0 items-center justify-center px-3 border-r bg-emerald-500/20 text-emerald-600 border-emerald-500/30 dark:text-emerald-400 dark:bg-emerald-500/25 transition-colors",
                        tipoFiltro === "aldea" && "border-emerald-500/50",
                      )}
                    >
                      <TreePine className="size-4.5" />
                    </div>

                    {/* Texto */}
                    <div className="min-w-0 flex-1 px-2.5 py-1.5">
                      <h3 className="truncate text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {activeCounts.aldeas === 1 ? "Aldea" : "Aldeas"}
                      </h3>
                      <p className="text-[10px] lg:text-[9px] font-semibold text-muted-foreground leading-none">
                        {tipoFiltro === "aldea" ? "Filtrado" : "Nivel 2"}
                      </p>
                    </div>
                  </div>

                  {/* Badge Contador */}
                  <div className="flex shrink-0 items-center pr-2.5 pl-1 py-1.5">
                    <div
                      className={cn(
                        "flex items-center rounded-lg px-2 py-0.5 transition-colors",
                        tipoFiltro === "aldea"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
                      )}
                    >
                      <span className="text-xs font-black tracking-tight">
                        {activeCounts.aldeas}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Caserío (Filtro interactivo) */}
                <button
                  type="button"
                  onClick={() => toggleTipoFiltro("caserio")}
                  title={tipoFiltro === "caserio" ? "Quitar filtro de Caseríos" : "Filtrar por Caseríos"}
                  className={cn(
                    "relative flex items-stretch justify-between overflow-hidden rounded-xl border-2 lg:w-[195px] cursor-pointer text-left transition-all bg-amber-50/50 dark:bg-amber-950/20",
                    tipoFiltro === "caserio"
                      ? "border-amber-600 shadow-md ring-2 ring-amber-500/30 dark:border-amber-400"
                      : "border-amber-500/40 hover:bg-amber-500/15 hover:border-amber-500/70 dark:hover:bg-amber-950/30",
                  )}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    {/* Celda del icono al ras */}
                    <div
                      className={cn(
                        "flex self-stretch shrink-0 items-center justify-center px-3 border-r bg-amber-500/20 text-amber-600 border-amber-500/30 dark:text-amber-400 dark:bg-amber-500/25 transition-colors",
                        tipoFiltro === "caserio" && "border-amber-500/50",
                      )}
                    >
                      <Home className="size-4.5" />
                    </div>

                    {/* Texto */}
                    <div className="min-w-0 flex-1 px-2.5 py-1.5">
                      <h3 className="truncate text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        {activeCounts.caserios === 1 ? "Caserío" : "Caseríos"}
                      </h3>
                      <p className="text-[10px] lg:text-[9px] font-semibold text-muted-foreground leading-none">
                        {tipoFiltro === "caserio" ? "Filtrado" : "Nivel 3"}
                      </p>
                    </div>
                  </div>

                  {/* Badge Contador */}
                  <div className="flex shrink-0 items-center pr-2.5 pl-1 py-1.5">
                    <div
                      className={cn(
                        "flex items-center rounded-lg px-2 py-0.5 transition-colors",
                        tipoFiltro === "caserio"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
                      )}
                    >
                      <span className="text-xs font-black tracking-tight">
                        {activeCounts.caserios}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

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
          ) : isSearching && filtered.length === 0 ? (
            <div className="my-4 rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40 space-y-2">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>
              <p className="text-sm font-bold text-foreground">
                No existe ningún lugar registrado como &ldquo;{searchTerm}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                El nombre está completamente libre y disponible para registrarse en el municipio.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-1 pt-1 pb-4">
              <div className="min-w-[600px] space-y-3 p-1">
                {filtered.map((nodo) => (
                  <NodoItem
                    key={nodo.id}
                    nodo={nodo}
                    adminHandlers={adminHandlers}
                    matchingIds={matchingIds}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar de expansión al final */}
        {nodos.length > 0 && (
          <div className="flex items-center justify-between px-4 md:px-0">
            <ToolbarExpansionTerritorial />
          </div>
        )}
      </div>
    </ExpansionProvider>
  );
}
