"use client";

import { useState, useMemo, Fragment, useEffect } from "react";
import { useUsers } from "./lib/hooks";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import {
  canCreateUsers,
  canManageUsers,
  getManageableRoles,
  isUserVisibleToActor,
  orderRoles,
  ROLE_LABELS,
} from "./lib/permissions";
import {
  Loader2,
  UserX,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import VerPerfil from "@/components/(base)/(users)/profile/VerPerfil";
import SignUp from "@/components/(base)/(auth)/signup/SignUp";
import { cn } from "@/lib/utils";

type UserItem = {
  id: string;
  nombre: string | null;
  rol: string | null;
};

function UsuariosSkeleton() {
  return (
    <div className="w-full mx-auto max-w-3xl lg:max-w-7xl pt-5 pb-10 px-4 animate-pulse">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-6 w-48 bg-slate-200 dark:bg-neutral-800 rounded-lg" />
            <div className="h-3.5 w-32 bg-slate-100 dark:bg-neutral-800/60 rounded" />
          </div>
          <div className="h-9 w-32 bg-slate-200 dark:bg-neutral-800 rounded-lg shrink-0" />
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="h-9 flex-1 bg-slate-100 dark:bg-neutral-800/60 rounded-lg border border-border/40" />
          <div className="hidden lg:block h-9 w-32 bg-slate-100 dark:bg-neutral-800/60 rounded-md shrink-0" />
        </div>
      </div>

      {/* Grid of Role Cards */}
      <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((col) => (
          <div
            key={col}
            className="border border-border rounded-xl bg-card overflow-hidden flex flex-col"
          >
            <div className="bg-muted/60 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
              <div className="h-4 w-28 bg-slate-200 dark:bg-neutral-800 rounded" />
              <div className="h-3.5 w-6 bg-slate-200 dark:bg-neutral-800 rounded-full" />
            </div>
            <div className="divide-y divide-border/40">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="px-4 py-3 flex items-center gap-3">
                  <div className="size-8 rounded-full bg-slate-200 dark:bg-neutral-800 shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="h-3.5 bg-slate-200 dark:bg-neutral-800 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 dark:bg-neutral-800/60 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile View */}
      <div className="lg:hidden border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/40">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="p-4 flex items-center gap-3">
            <div className="size-9 rounded-full bg-slate-200 dark:bg-neutral-800 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded w-3/5" />
              <div className="h-3 bg-slate-100 dark:bg-neutral-800/60 rounded w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerUsuarios() {
  const { effectiveRole } = useUserContext();

  const { data: users, isLoading, isError, refetch } = useUsers(effectiveRole);

  const manageableRoles = useMemo(
    () => getManageableRoles(effectiveRole),
    [effectiveRole],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLargeScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (roleFilter !== "all" && !manageableRoles.includes(roleFilter)) {
      setRoleFilter("all");
    }
  }, [effectiveRole, roleFilter, manageableRoles]);

  const handleUserClick = (id: string) => {
    setSelectedUserId(id);
    setIsProfileOpen(true);
  };

  const handleCloseSignUp = () => {
    setIsSignUpOpen(false);
    refetch();
  };

  const roleLabels = ROLE_LABELS;

  const availableRoles = useMemo(() => {
    if (!users) return manageableRoles;
    const fromData = Array.from(new Set(users.map((u) => u.rol))).filter(
      Boolean,
    ) as string[];
    return orderRoles(
      fromData.filter((role) => manageableRoles.includes(role)),
    );
  }, [users, manageableRoles]);

  const sortUsers = (list: UserItem[]) =>
    [...list].sort((a, b) => {
      const nameA = a.nombre || "";
      const nameB = b.nombre || "";
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB, "es", { sensitivity: "base" })
        : nameB.localeCompare(nameA, "es", { sensitivity: "base" });
    });

  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return sortUsers(
      users.filter((u) => {
        const matchesSearch = (u.nombre || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesRole =
          isLargeScreen ||
          roleFilter === "all" ||
          (u.rol || "user") === roleFilter;
        return (
          matchesSearch &&
          matchesRole &&
          isUserVisibleToActor(u.rol, effectiveRole)
        );
      }),
    );
  }, [users, searchQuery, sortOrder, roleFilter, isLargeScreen, effectiveRole]);

  const usersByRole = useMemo(() => {
    if (!isLargeScreen) return [];

    const groups = new Map<string, UserItem[]>();
    for (const userItem of filteredUsers) {
      const role = userItem.rol || "sin-rol";
      const list = groups.get(role) || [];
      list.push(userItem);
      groups.set(role, list);
    }

    const orderedRoles = orderRoles(
      Array.from(groups.keys()).filter((role) =>
        manageableRoles.includes(role),
      ),
    );

    return orderedRoles.map((role) => ({
      role,
      users: groups.get(role) || [],
    }));
  }, [filteredUsers, isLargeScreen, manageableRoles]);

  const totalUsers = filteredUsers.length;
  const isAll = pageSize === "all";
  const totalPages = isAll ? 1 : Math.ceil(totalUsers / (pageSize as number));

  const paginatedUsers = useMemo(() => {
    if (isAll) return filteredUsers;
    const size = pageSize as number;
    return filteredUsers.slice((currentPage - 1) * size, currentPage * size);
  }, [filteredUsers, isAll, currentPage, pageSize]);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPageSize(val === "all" ? "all" : Number(val));
    setCurrentPage(1);
  };

  if (!canManageUsers(effectiveRole)) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-muted-foreground px-4 text-center">
        <UserX className="h-8 w-8" />
        <p className="text-sm">No tienes permisos para gestionar usuarios.</p>
      </div>
    );
  }

  if (isLoading) {
    return <UsuariosSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-destructive">
        <UserX className="h-8 w-8" />
        <p>Error al cargar usuarios</p>
      </div>
    );
  }

  const canCreateUser = canCreateUsers(effectiveRole);

  const paginationControls = (
    <div className="flex items-center gap-2 shrink-0 lg:hidden">
      {!isAll && (
        <>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono text-muted-foreground min-w-[28px] text-center font-bold">
            {currentPage}/{totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={currentPage === totalPages}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
      <select
        value={pageSize}
        onChange={handlePageSizeChange}
        className="h-9 rounded-md border border-border bg-card px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value="all">Todos</option>
      </select>
    </div>
  );

  const desktopSortControl = (
    <select
      value={sortOrder}
      onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
      className="hidden lg:block h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shrink-0"
    >
      <option value="asc">Ordenar (A-Z)</option>
      <option value="desc">Ordenar (Z-A)</option>
    </select>
  );

  const renderMobileUserRows = () =>
    paginatedUsers.map((userItem, index) => {
      const firstLetter = (userItem.nombre || "#").charAt(0).toUpperCase();
      const prevFirstLetter =
        index > 0
          ? (paginatedUsers[index - 1].nombre || "#").charAt(0).toUpperCase()
          : null;
      const showSeparator = firstLetter !== prevFirstLetter;

      return (
        <Fragment key={userItem.id}>
          {showSeparator && (
            <tr>
              <td
                colSpan={2}
                className="bg-muted/30 px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-y border-border/50"
              >
                {firstLetter}
              </td>
            </tr>
          )}
          <tr
            onClick={() => handleUserClick(userItem.id)}
            className="group hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <td className="px-4 py-2.5 font-medium group-hover:text-primary transition-colors border-b border-border/40 align-top">
              <span className="block break-words">
                {userItem.nombre || "Sin Nombre"}
              </span>
            </td>
            <td className="px-4 py-2.5 border-b border-border/40 text-right align-top">
              <span className="inline-block capitalize text-[10px] font-bold bg-primary/5 px-2 py-0.5 rounded border border-primary/10 whitespace-nowrap">
                {userItem.rol
                  ? roleLabels[userItem.rol] || userItem.rol
                  : "Sin Rol"}
              </span>
            </td>
          </tr>
        </Fragment>
      );
    });

  return (
    <>
      <div className="w-full mx-auto max-w-3xl lg:max-w-7xl pt-5 pb-10 px-4">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm xl:text-xl font-bold tracking-tight text-foreground">
                Gestión de Usuarios
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rol Actual:{" "}
                <span className="text-[10px] underline font-bold uppercase text-foreground">
                  {roleLabels[effectiveRole] || effectiveRole}
                </span>
              </p>
            </div>
            {canCreateUser && !isSignUpOpen && (
              <button
                onClick={() => setIsSignUpOpen(true)}
                className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 cursor-pointer shrink-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Nuevo Usuario</span>
                <span className="sm:hidden">Nuevo</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground h-9"
              />
            </div>
            {desktopSortControl}
            {paginationControls}
          </div>
        </div>

        {/* Desktop: una tabla por rol */}
        <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {usersByRole.length === 0 ? (
            <div className="col-span-full border border-border rounded-xl bg-card p-12 text-center text-muted-foreground text-xs uppercase font-medium">
              {searchQuery
                ? "No se encontraron coincidencias."
                : "No hay usuarios disponibles."}
            </div>
          ) : (
            usersByRole.map(({ role, users: roleUsers }) => (
              <div
                key={role}
                className="border border-border rounded-xl bg-card overflow-hidden flex flex-col min-w-0"
              >
                <div className="bg-muted/60 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
                    {roleLabels[role] || role}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                    {roleUsers.length}
                  </span>
                </div>
                <table className="w-full text-sm text-left">
                  <tbody>
                    {roleUsers.map((userItem) => (
                      <tr
                        key={userItem.id}
                        onClick={() => handleUserClick(userItem.id)}
                        className="group hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-medium group-hover:text-primary transition-colors border-b border-border/40 last:border-b-0 align-top">
                          <span className="block line-clamp-2 leading-snug break-words">
                            {userItem.nombre || "Sin Nombre"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {/* Móvil: tabla única agrupada por letra */}
        <div className="lg:hidden border border-border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm text-left border-separate border-spacing-0 table-fixed">
            <thead className="bg-muted/60">
              <tr>
                <th colSpan={2} className="px-2 py-2 border-b border-border">
                  <div className="flex flex-col gap-2">
                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "asc" | "desc")
                      }
                      className="w-full bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer hover:text-primary transition-colors uppercase text-[10px] tracking-wide"
                    >
                      <option value="asc">Ordenar (A-Z)</option>
                      <option value="desc">Ordenar (Z-A)</option>
                    </select>
                    <select
                      value={roleFilter}
                      onChange={(e) => {
                        setRoleFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-transparent text-foreground focus:outline-none cursor-pointer hover:text-primary transition-colors text-[10px] font-medium"
                    >
                      <option value="all">Rol: Todos</option>
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role] || role}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {renderMobileUserRows()}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-xs uppercase font-medium">
              {searchQuery
                ? "No se encontraron coincidencias."
                : "No hay usuarios disponibles con estos filtros."}
            </div>
          )}
        </div>
      </div>

      <VerPerfil
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={selectedUserId}
      />

      {isSignUpOpen && canCreateUser && (
        <SignUp
          isOpen
          onClose={handleCloseSignUp}
          onSuccess={() => refetch()}
          presentation={isLargeScreen ? "modal" : "fullscreen"}
        />
      )}
    </>
  );
}
