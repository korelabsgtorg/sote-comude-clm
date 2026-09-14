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
  UserPlus,
  UserMinus,
  UserRound,
  Briefcase,
  ListTree,
  Pencil,
  Building2,
  ArrowRightLeft,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodoOrganizacion } from "./lib/zod";
import {
  OrgActionButton,
  type AdminHandlers,
} from "./lib/org-actions";

export type { AdminHandlers };

const ACCORDION_EASE = [0.33, 1, 0.68, 1] as const;

const TREE_ACTION_BTN =
  "flex h-full min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center bg-celeste-trifinio/5 text-celeste-trifinio transition-colors hover:bg-celeste-trifinio/15 dark:bg-celeste-trifinio/10 dark:hover:bg-celeste-trifinio/15";

const TREE_ACTIONS_BAR =
  "flex shrink-0 self-stretch items-stretch divide-x divide-celeste-trifinio/40 overflow-visible border-l border-celeste-trifinio/40";

const TREE_ROW_PAD = "px-4 py-3 md:px-5 md:py-4";
const TREE_ROW_PAD_ROOT = "px-4 py-4 md:px-6 md:py-5";
const TREE_ROW_ACTIONS_LAYOUT = "items-stretch gap-0 py-0 pr-0 pl-0";

function TreeActionButton(props: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return <OrgActionButton {...props} />;
}

type TreeExpansionContextValue = {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  allExpanded: boolean;
  setAllExpanded: (expanded: boolean) => void;
};

const TreeExpansionContext = createContext<TreeExpansionContextValue | null>(
  null,
);

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

function collectExpandableIds(nodo: NodoOrganizacion): string[] {
  const ids: string[] = [];
  if (nodo.tipo === "raiz" && nodo.hijos?.length) ids.push(nodo.id);
  if (nodo.tipo === "nivel") ids.push(nodo.id);
  if (nodo.tipo === "unidad" && nodo.tiene_jefaturas && nodo.hijos?.length) {
    ids.push(nodo.id);
  }
  for (const hijo of nodo.hijos ?? []) {
    ids.push(...collectExpandableIds(hijo));
  }
  return ids;
}

function TreeExpansionProvider({
  estructura,
  children,
}: {
  estructura: NodoOrganizacion;
  children: ReactNode;
}) {
  const expandableIds = useMemo(
    () => collectExpandableIds(estructura),
    [estructura],
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set([estructura.id]),
  );

  useEffect(() => {
    setExpandedIds(new Set([estructura.id]));
  }, [estructura.id]);

  const isExpanded = useCallback(
    (id: string) => expandedIds.has(id),
    [expandedIds],
  );

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allExpanded = useMemo(
    () =>
      expandableIds.length > 0 &&
      expandableIds.every((id) => expandedIds.has(id)),
    [expandableIds, expandedIds],
  );

  const setAllExpanded = useCallback(
    (expanded: boolean) => {
      if (expanded) {
        setExpandedIds(new Set(expandableIds));
        return;
      }
      const rootExpandable = expandableIds.includes(estructura.id);
      setExpandedIds(rootExpandable ? new Set([estructura.id]) : new Set());
    },
    [expandableIds, estructura.id],
  );

  const value = useMemo(
    () => ({ isExpanded, toggle, allExpanded, setAllExpanded }),
    [isExpanded, toggle, allExpanded, setAllExpanded],
  );

  return (
    <TreeExpansionContext.Provider value={value}>
      {children}
    </TreeExpansionContext.Provider>
  );
}

function useTreeExpansion() {
  const ctx = useContext(TreeExpansionContext);
  if (!ctx) {
    throw new Error("useTreeExpansion debe usarse dentro de TreeExpansionProvider");
  }
  return ctx;
}

function NodoItem({
  nodo,
  depth = 0,
  variant = "default",
  admin,
  espaciadoVertical = false,
  mostrarInactivos = false,
}: {
  nodo: NodoOrganizacion;
  depth?: number;
  variant?: "root" | "default";
  admin?: AdminHandlers;
  espaciadoVertical?: boolean;
  mostrarInactivos?: boolean;
}) {
  const { isExpanded, toggle, allExpanded, setAllExpanded } = useTreeExpansion();
  const expanded = isExpanded(nodo.id);
  const hasChildren = Boolean(nodo.hijos && nodo.hijos.length > 0);
  const isInactive = nodo.activo === false;
  const isRoot = variant === "root";
  const isDepartamento = nodo.tipo === "nivel";
  const isPuesto = nodo.tipo === "unidad";
  const puestoJefatura = isPuesto && Boolean(nodo.tiene_jefaturas);
  const isJefeAccordion = puestoJefatura && hasChildren;
  const canToggle = isRoot ? hasChildren : isDepartamento || isJefeAccordion;
  const showChevron =
    (isRoot && hasChildren) || isDepartamento || isJefeAccordion;
  const showNivelActions = Boolean(admin && isDepartamento && expanded);
  const showPuestoActions = Boolean(admin && isPuesto);
  const showRootActions = Boolean(admin && isRoot);
  const hasActionBar = Boolean(
    showNivelActions || showRootActions || showPuestoActions,
  );
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      className={cn(
        depth > 0 &&
          !isPuesto &&
          "max-md:ml-0 max-md:border-0 max-md:pl-0 md:ml-3 md:border-l md:border-celeste-trifinio/25 md:pl-2",
        isPuesto && depth > 0 && puestoJefatura && "md:ml-5",
        isPuesto && depth > 0 && !puestoJefatura && "ml-3 md:ml-8",
      )}
    >
      <motion.div
        transition={{ duration: 0.35, ease: ACCORDION_EASE }}
        className={cn(
          "group w-full max-md:rounded-none rounded-xl border transition-[border-color,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
          isRoot
            ? cn(
                "flex flex-col border-celeste-trifinio/30 bg-card md:shadow-sm",
                showRootActions
                  ? "gap-0 py-0 pr-0 pl-0 md:flex-row md:items-stretch"
                  : "gap-3 px-4 py-4 md:flex-row md:items-start md:gap-3 md:px-6 md:py-5",
              )
            : cn(
                "flex bg-card",
                isPuesto && !isInactive &&
                  (puestoJefatura
                    ? "relative rounded-xl border border-zinc-200/70 border-l-[3px] border-l-amber-500/80 bg-card hover:border-amber-500/35 dark:border-zinc-700/70"
                    : "relative rounded-xl border border-zinc-200/70 border-l-[3px] border-l-emerald-500/65 bg-card hover:border-emerald-500/30 dark:border-zinc-700/70"),
                isPuesto && isInactive &&
                  "relative rounded-xl border border-zinc-200/70 border-l-[3px] border-l-zinc-400/80 bg-zinc-50/50 dark:bg-zinc-800/40 hover:border-zinc-400/50 dark:border-zinc-700/70 grayscale-[0.5] opacity-80",
                !isPuesto &&
                  "border-border/60 hover:border-celeste-trifinio/40 hover:bg-celeste-trifinio/5",
                hasActionBar
                  ? TREE_ROW_ACTIONS_LAYOUT
                  : cn("items-center", TREE_ROW_PAD),
              ),
          canToggle && "cursor-pointer",
          expanded &&
            !isRoot &&
            (isDepartamento || isJefeAccordion) &&
            "border-celeste-trifinio/30 bg-celeste-trifinio/5",
          expanded &&
            !isRoot &&
            isJefeAccordion &&
            "border-amber-500/30 bg-amber-500/5",
        )}
        onClick={() => canToggle && toggle(nodo.id)}
        onKeyDown={(e) => {
          if (canToggle && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle(nodo.id);
          }
        }}
        role={canToggle ? "button" : undefined}
        tabIndex={canToggle ? 0 : undefined}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2",
            hasActionBar &&
              (isRoot ? TREE_ROW_PAD_ROOT : TREE_ROW_PAD),
          )}
        >
          {showChevron ? (
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.35, ease: ACCORDION_EASE }}
              className={cn(
                "mt-0.5 flex shrink-0 items-center justify-center",
                isRoot ? "size-4 md:size-5" : "size-4",
              )}
            >
              <ChevronRight
                className={cn(
                  isRoot ? "size-4 md:size-5" : "size-4",
                  expanded
                    ? puestoJefatura
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-celeste-trifinio"
                    : "text-muted-foreground",
                )}
              />
            </motion.div>
          ) : isDepartamento ? (
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              <Building2 className="size-4 text-muted-foreground" />
            </span>
          ) : !isPuesto ? (
            <span className="size-4 shrink-0" />
          ) : null}

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p
                className={cn(
                  "leading-tight text-foreground",
                  isRoot && "text-lg font-black md:text-xl",
                  isDepartamento && "text-sm font-black md:text-base",
                  isPuesto && "text-sm font-semibold tracking-tight md:text-[0.9375rem]",
                  isInactive && "text-muted-foreground opacity-70"
                )}
              >
                {nodo.nombre}
              </p>
              {isPuesto && nodo.fecha && (
                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-muted-foreground/70">
                  <span className="opacity-50">·</span>
                  <CalendarDays className="size-3.5 opacity-70" />
                  {formatFechaCorto(nodo.fecha)}
                </div>
              )}
              {isInactive && (
                <span className="rounded-md bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-700/80 dark:text-zinc-300">
                  Inactivo
                </span>
              )}
            </div>
            <AnimatePresence initial={false}>
              {nodo.descripcion && !isPuesto && (
                <motion.p
                  key="descripcion"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: ACCORDION_EASE }}
                  className={cn(
                    "mt-1 overflow-hidden leading-relaxed text-celeste-trifinio/80",
                    isRoot ? "text-sm md:text-base" : "text-xs md:text-sm",
                  )}
                >
                  {nodo.descripcion}
                </motion.p>
              )}
              {nodo.titular && isPuesto && (
                <motion.div
                  key="titular"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: ACCORDION_EASE }}
                  className="mt-2 flex items-center gap-2 overflow-hidden"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full ring-1",
                      puestoJefatura
                        ? "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300"
                        : "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
                    )}
                  >
                    <UserRound className="size-3.5" />
                  </span>
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {nodo.titular}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {showRootActions && admin && (
          <div
            className={cn(
              TREE_ACTIONS_BAR,
              "w-full shrink-0 justify-end border-t border-t-celeste-trifinio/30 md:w-auto md:justify-start md:border-t-0",
            )}
            onClick={stop}
          >
            <TreeActionButton
              label="Añadir Dependencia/Unidad"
              onClick={() => admin.onAddDepartamento(null)}
            >
              <ListTree className="size-4" />
            </TreeActionButton>
            {hasChildren && (
              <TreeActionButton
                label={allExpanded ? "Cerrar todo" : "Abrir todo"}
                onClick={() => setAllExpanded(!allExpanded)}
              >
                {allExpanded ? (
                  <ChevronsUp className="size-4" />
                ) : (
                  <ChevronsDown className="size-4" />
                )}
              </TreeActionButton>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {showNivelActions && admin && (
            <motion.div
              key={`actions-${nodo.id}`}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              transition={{ duration: 0.35, ease: ACCORDION_EASE }}
              style={{ transformOrigin: "right center" }}
              className={TREE_ACTIONS_BAR}
              onClick={stop}
            >
              <TreeActionButton
                label="Añadir Dependencia/Unidad"
                onClick={() => admin.onAddDepartamento(nodo.id)}
              >
                <ListTree className="size-4" />
              </TreeActionButton>
              <TreeActionButton
                label="Añadir Puesto"
                onClick={() => admin.onAddPuesto(nodo.id)}
              >
                <Briefcase className="size-4" />
              </TreeActionButton>
              <TreeActionButton
                label="Editar"
                onClick={() => admin.onEdit("departamento", nodo.id)}
              >
                <Pencil className="size-4" />
              </TreeActionButton>
            </motion.div>
          )}
        </AnimatePresence>

        {showPuestoActions && admin && (
          <div
            className={cn(
              TREE_ACTIONS_BAR,
              "opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100",
              puestoJefatura
                ? "divide-amber-500/35 border-amber-500/25 [&_button]:bg-amber-500/5 [&_button]:text-amber-700 [&_button]:hover:bg-amber-500/12 dark:[&_button]:text-amber-300"
                : "divide-emerald-500/35 border-emerald-500/25 [&_button]:bg-emerald-500/5 [&_button]:text-emerald-700 [&_button]:hover:bg-emerald-500/12 dark:[&_button]:text-emerald-300",
            )}
            onClick={stop}
          >
            {nodo.titular ? (
              <TreeActionButton
                label="Desasignar persona"
                onClick={() =>
                  admin.onDesasignarPersona(
                    nodo.id,
                    nodo.nombre,
                    nodo.titular!,
                  )
                }
              >
                <UserMinus className="size-4" />
              </TreeActionButton>
            ) : (
              <TreeActionButton
                label="Asignar persona"
                onClick={() => admin.onAsignarPersona(nodo.id, nodo.nombre)}
              >
                <UserPlus className="size-4" />
              </TreeActionButton>
            )}
            <TreeActionButton
              label="Reubicar puesto"
              onClick={() => admin.onReubicarPuesto(nodo.id, nodo.nombre)}
            >
              <ArrowRightLeft className="size-4" />
            </TreeActionButton>
            <TreeActionButton
              label="Editar"
              onClick={() => admin.onEdit("puesto", nodo.id)}
            >
              <Pencil className="size-4" />
            </TreeActionButton>
          </div>
        )}
      </motion.div>

      <AnimatePresence initial={false}>
        {hasChildren && expanded && (
          <motion.div
            key={`children-${nodo.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.4, ease: ACCORDION_EASE },
              opacity: { duration: 0.3, ease: ACCORDION_EASE },
            }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "pb-0.5",
                espaciadoVertical
                  ? "mt-2 space-y-2.5 md:mt-6 md:space-y-5"
                  : "mt-1 space-y-1 md:mt-3 md:space-y-3",
              )}
            >
              {(nodo.hijos || [])
                .filter((h) => mostrarInactivos || h.activo !== false)
                .map((hijo, index) => (
                <motion.div
                  key={hijo.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.04,
                    ease: ACCORDION_EASE,
                  }}
                >
                  <NodoItem
                    nodo={hijo}
                    depth={depth + 1}
                    admin={admin}
                    espaciadoVertical={espaciadoVertical}
                    mostrarInactivos={mostrarInactivos}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function contarNodos(
  nodo: NodoOrganizacion,
): Record<NodoOrganizacion["tipo"], number> {
  const counts: Record<NodoOrganizacion["tipo"], number> = {
    raiz: 0,
    nivel: 0,
    institucion: 0,
    unidad: 0,
  };

  const walk = (current: NodoOrganizacion) => {
    counts[current.tipo] += 1;
    current.hijos?.forEach(walk);
  };

  walk(nodo);
  return counts;
}

export function OrganizacionTree({
  estructura,
  admin,
  espaciadoVertical = false,
  mostrarInactivos = false,
}: {
  estructura: NodoOrganizacion;
  admin?: AdminHandlers;
  espaciadoVertical?: boolean;
  mostrarInactivos?: boolean;
}) {
  return (
    <TreeExpansionProvider estructura={estructura}>
      <div className="w-full">
        <NodoItem
          nodo={estructura}
          variant="root"
          admin={admin}
          espaciadoVertical={espaciadoVertical}
          mostrarInactivos={mostrarInactivos}
        />
      </div>
    </TreeExpansionProvider>
  );
}
