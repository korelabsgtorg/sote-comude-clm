"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import {
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Globe,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  Network,
  Settings,
  ShieldAlert,
  Smartphone,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { AuroraText } from "@/components/ui/aurora-text";
import {
  ACTIVIDADES_MENU_OPTIONS,
  ADMIN_MENU_OPTIONS,
  OBSERVATORIO_MENU_OPTIONS,
  getPerfilMenuOptions,
  getVisibleActividadesOptions,
  getVisibleAdminOptions,
  getVisibleDashboardModules,
  type DashboardModule,
} from "@/components/(base)/dashboard/modules";
import { useAppSettings } from "@/components/(base)/(settings)/hooks";
import VerPerfil from "@/components/(base)/(users)/profile/VerPerfil";
import PassKeysModal from "@/components/(base)/layout/modals/PassKeysModal";
import ManualUsuarioModal from "@/components/(base)/layout/modals/ManualUsuarioModal";
import { GlobalMunicipioSelector } from "./GlobalMunicipioSelector";
import { ROLE_LABELS } from "@/components/(base)/(users)/usuarios/lib/permissions";

const MENU_OPTION_ICONS: Record<string, LucideIcon> = {
  "mis-actividades": ClipboardList,
  "jefatura-actividades": Users,
  "supervision-actividades": Building2,
  "movilidad-humana": Globe,
  "mi-perfil": User,
  "ingreso-seguro": KeyRound,
  dispositivos: Smartphone,
  usuarios: Users,
  configuraciones: Settings,
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  actividades: ClipboardList,
  tareas: ClipboardList,
  observatorio: Globe,
  perfil: User,
  admin: Settings,
  "memoria-labores": FileText,
  estructuras: Network,
};

type MenuAccordionOption = {
  id: string;
  title: string;
  desc: string;
  href?: string;
};

function MenuAccordionIcon({
  optionId,
  variant = "modules",
}: {
  optionId: string;
  variant?: MenuSectionVariant;
}) {
  const Icon = MENU_OPTION_ICONS[optionId] ?? User;
  const iconColor =
    variant === "actividades"
      ? "text-blue-600 dark:text-blue-400"
      : variant === "account"
        ? "text-violet-600 dark:text-violet-400"
        : "text-celeste-trifinio";

  return <Icon className={cn("size-4 shrink-0", iconColor)} strokeWidth={2} aria-hidden />;
}

type MenuSectionVariant = "modules" | "account" | "admin" | "actividades";

const MENU_SECTION_STYLES: Record<
  MenuSectionVariant,
  { label: string; dot: string; panel: string; item: string; itemHover: string; itemActive: string }
> = {
  modules: {
    label: "text-foreground",
    dot: "bg-celeste-trifinio",
    panel: "bg-white/90 dark:bg-zinc-900/90 ring-1 ring-zinc-200/80 dark:ring-zinc-700/60",
    item: "bg-white dark:bg-zinc-900",
    itemHover: "hover:bg-zinc-50 dark:hover:bg-zinc-800/80",
    itemActive: "bg-celeste-trifinio/12 dark:bg-celeste-trifinio/20 ring-1 ring-inset ring-celeste-trifinio/30",
  },
  account: {
    label: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    panel: "bg-violet-50/90 dark:bg-violet-950/40 ring-1 ring-violet-200/70 dark:ring-violet-800/50",
    item: "bg-white/80 dark:bg-violet-950/50",
    itemHover: "hover:bg-violet-100/80 dark:hover:bg-violet-900/40",
    itemActive: "bg-violet-100 dark:bg-violet-900/50 ring-1 ring-inset ring-violet-300/60 dark:ring-violet-600/50",
  },
  admin: {
    label: "text-celeste-trifinio",
    dot: "bg-celeste-trifinio",
    panel: "bg-sky-50/90 dark:bg-sky-950/35 ring-1 ring-celeste-trifinio/25 dark:ring-celeste-trifinio/30",
    item: "bg-white/85 dark:bg-sky-950/45",
    itemHover: "hover:bg-sky-100/70 dark:hover:bg-sky-900/35",
    itemActive: "bg-celeste-trifinio/15 dark:bg-celeste-trifinio/25 ring-1 ring-inset ring-celeste-trifinio/35",
  },
  actividades: {
    label: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    panel: "bg-blue-50/80 dark:bg-blue-950/35 ring-1 ring-blue-200/60 dark:ring-blue-800/40",
    item: "bg-white/85 dark:bg-blue-950/45",
    itemHover: "hover:bg-blue-100/70 dark:hover:bg-blue-900/35",
    itemActive: "bg-blue-100/80 dark:bg-blue-900/50 ring-1 ring-inset ring-blue-300/60 dark:ring-blue-600/50",
  },
};

function MenuActiveIndicator({
  active,
  variant = "modules",
}: {
  active: boolean;
  variant?: MenuSectionVariant;
}) {
  const accent =
    variant === "actividades"
      ? "bg-blue-500"
      : variant === "account"
        ? "bg-violet-500"
        : "bg-celeste-trifinio";

  return (
    <span
      className={cn(
        "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-300 ease-out",
        accent,
        active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
      )}
    />
  );
}

function MenuSection({
  label,
  children,
  variant = "modules",
}: {
  label: string;
  children: ReactNode;
  variant?: MenuSectionVariant;
}) {
  const styles = MENU_SECTION_STYLES[variant];

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2.5 px-0.5">
        <span className={cn("size-2 shrink-0 rounded-full", styles.dot)} />
        <h3 className={cn("text-[11px] font-black uppercase tracking-[0.18em]", styles.label)}>
          {label}
        </h3>
        <div className="h-px flex-1 bg-border/70" />
      </div>
      <div className={cn("space-y-2 rounded-2xl p-2", styles.panel)}>{children}</div>
    </section>
  );
}

function MenuItemShell({
  id,
  variant = "modules",
  active = false,
  className,
  children,
}: {
  id?: string;
  variant?: MenuSectionVariant;
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const styles = MENU_SECTION_STYLES[variant];

  return (
    <div
      id={id}
      className={cn(
        "overflow-hidden rounded-xl transition-colors duration-200",
        styles.item,
        active ? styles.itemActive : styles.itemHover,
        className,
      )}
    >
      {children}
    </div>
  );
}

function MenuAccordion({
  id,
  title,
  subtitle,
  desc,
  options,
  pathname,
  open,
  onToggle,
  isRouteActive,
  onNavigate,
  onOptionClick,
  variant = "modules",
  icon: HeaderIcon = User,
}: {
  id: string;
  title: string;
  subtitle?: string;
  desc: string;
  options: readonly MenuAccordionOption[];
  pathname: string;
  open: boolean;
  onToggle: () => void;
  isRouteActive: boolean;
  onNavigate: () => void;
  onOptionClick?: (optionId: string) => void;
  variant?: MenuSectionVariant;
  icon?: LucideIcon;
}) {
  const isExpanded = open || isRouteActive;
  const styles = MENU_SECTION_STYLES[variant];
  const titleAccent =
    variant === "actividades"
      ? isExpanded
        ? "text-blue-600 dark:text-blue-400"
        : "text-foreground"
      : variant === "account"
        ? isExpanded
          ? "text-violet-700 dark:text-violet-300"
          : "text-foreground"
        : isExpanded
          ? "text-celeste-trifinio"
          : "text-foreground";

  return (
    <MenuItemShell variant={variant} active={isExpanded} id={id}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="relative flex w-full items-center gap-3 px-3.5 py-3 text-left cursor-pointer"
      >
        <MenuActiveIndicator active={isExpanded} variant={variant} />
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            isExpanded
              ? variant === "actividades"
                ? "bg-blue-500/15 dark:bg-blue-500/25"
                : variant === "account"
                  ? "bg-violet-500/15 dark:bg-violet-500/25"
                  : "bg-celeste-trifinio/15 dark:bg-celeste-trifinio/25"
              : "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <HeaderIcon
            className={cn(
              "size-4",
              variant === "actividades"
                ? "text-blue-600 dark:text-blue-400"
                : variant === "account"
                  ? "text-violet-600 dark:text-violet-300"
                  : "text-celeste-trifinio",
            )}
            strokeWidth={2.25}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-black uppercase leading-tight transition-colors", titleAccent)}>
            {title}
            {subtitle ? ` ${subtitle}` : ""}
          </p>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            {desc}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("mx-2 mb-2 space-y-1.5 rounded-xl p-1.5", styles.panel)}>
            {options.map((opt, index) => {
              const isActive = opt.href
                ? pathname === opt.href || pathname.startsWith(`${opt.href}/`)
                : false;

              const itemClassName = cn(
                "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 cursor-pointer",
                open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                isActive ? styles.itemActive : styles.itemHover,
                styles.item,
              );

              const itemContent = (
                <>
                  <MenuActiveIndicator active={isActive} variant={variant} />
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      variant === "actividades"
                        ? "bg-blue-500/10 dark:bg-blue-500/20"
                        : variant === "account"
                          ? "bg-violet-500/10 dark:bg-violet-500/20"
                          : "bg-celeste-trifinio/10 dark:bg-celeste-trifinio/15",
                    )}
                  >
                    <MenuAccordionIcon optionId={opt.id} variant={variant} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight text-foreground">{opt.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug truncate mt-0.5">
                      {opt.desc}
                    </p>
                  </div>
                </>
              );

              if (opt.href) {
                return (
                  <Link
                    key={opt.id}
                    id={`${id}-${opt.id}`}
                    href={opt.href}
                    onClick={onNavigate}
                    style={{ transitionDelay: open ? `${index * 40}ms` : "0ms" }}
                    className={itemClassName}
                  >
                    {itemContent}
                  </Link>
                );
              }

              return (
                <button
                  key={opt.id}
                  id={`${id}-${opt.id}`}
                  type="button"
                  onClick={() => {
                    onOptionClick?.(opt.id);
                    onNavigate();
                  }}
                  style={{ transitionDelay: open ? `${index * 40}ms` : "0ms" }}
                  className={itemClassName}
                >
                  {itemContent}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MenuItemShell>
  );
}

interface MenuProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: any;
}

function MenuHomeLink({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  const isActive = pathname === "/comude";

  return (
    <MenuItemShell variant="modules" active={isActive}>
      <Link
        id="menu-inicio"
        href="/comude"
        onClick={onNavigate}
        className="relative flex items-center gap-3 px-3.5 py-3 cursor-pointer"
      >
        <MenuActiveIndicator active={isActive} variant="modules" />
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            isActive
              ? "bg-celeste-trifinio/15 dark:bg-celeste-trifinio/25"
              : "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <Home className="size-4 text-celeste-trifinio" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-black uppercase leading-tight transition-colors",
              isActive ? "text-celeste-trifinio" : "text-foreground",
            )}
          >
            Inicio
          </p>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            Panel principal y acceso a los módulos del sistema.
          </p>
        </div>
      </Link>
    </MenuItemShell>
  );
}

function MenuModuleLink({
  mod,
  pathname,
  onNavigate,
}: {
  mod: DashboardModule;
  pathname: string;
  onNavigate: () => void;
}) {
  const isActive = pathname === mod.href || pathname.startsWith(`${mod.href}/`);
  const Icon = MODULE_ICONS[mod.id] ?? User;

  return (
    <MenuItemShell variant="modules" active={isActive}>
      <Link
        id={`menu-${mod.id}`}
        href={mod.href}
        onClick={onNavigate}
        className="relative flex items-center gap-3 px-3.5 py-3 cursor-pointer"
      >
        <MenuActiveIndicator active={isActive} variant="modules" />
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            isActive
              ? "bg-celeste-trifinio/15 dark:bg-celeste-trifinio/25"
              : "bg-zinc-100 dark:bg-zinc-800",
          )}
        >
          <Icon className="size-4 text-celeste-trifinio" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-black uppercase leading-tight transition-colors",
              isActive ? "text-celeste-trifinio" : "text-foreground",
            )}
          >
            {mod.title}
            {mod.subtitle ? ` ${mod.subtitle}` : ""}
          </p>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            {mod.desc}
          </p>
        </div>
      </Link>
    </MenuItemShell>
  );
}

type MenuAccordionId = "observatorio" | "perfil" | "admin" | "actividades";

export default function Menu({ isOpen, setIsOpen, user }: MenuProps) {
  const pathname = usePathname();
  const { realRole, effectiveRole, simulatedRole, setSimulatedRole, esJefe } = useUserContext();
  const { data: appSettings } = useAppSettings();
  const [openAccordionId, setOpenAccordionId] = useState<MenuAccordionId | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasskeysOpen, setIsPasskeysOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const menuTop =
    "top-[calc(var(--banner-height,0px)+var(--mobile-header-height)+var(--mobile-breadcrumb-height)+env(safe-area-inset-top))] md:top-[calc(var(--banner-height,0px)+3.5rem+env(safe-area-inset-top))]";
  const menuHeight =
    "h-[calc(100dvh-var(--banner-height,0px)-var(--mobile-header-height)-var(--mobile-breadcrumb-height)-env(safe-area-inset-top))] md:h-[calc(100dvh-var(--banner-height,0px)-3.5rem-env(safe-area-inset-top))]";

  const metadata = user?.user_metadata || {};
  const usuario = metadata.username || user?.email?.split("@")[0] || "—";
  const nombre = metadata.nombre || "—";

  const visibleModules = user ? getVisibleDashboardModules(effectiveRole) : [];
  const mainModules = visibleModules.filter(
    (mod) =>
      mod.id !== "admin" &&
      mod.id !== "observatorio" &&
      mod.id !== "perfil" &&
      mod.id !== "actividades" &&
      mod.id !== "tareas",
  );
  const adminModule = visibleModules.find((mod) => mod.id === "admin");
  const observatorioModule = visibleModules.find((mod) => mod.id === "observatorio");
  const perfilModule = visibleModules.find((mod) => mod.id === "perfil");
  const isAdminRoute = pathname.startsWith("/comude/admin");
  const isObservatorioRoute = pathname.startsWith("/comude/observatorio");
  const isActividadesRoute =
    pathname.startsWith("/comude/actividades") || pathname.startsWith("/comude/tareas");
  const effectiveEsJefe = simulatedRole ? false : esJefe;
  const visibleActividadesOptions = user
    ? getVisibleActividadesOptions(ACTIVIDADES_MENU_OPTIONS, effectiveRole, effectiveEsJefe)
    : [];
  const passkeysEnabled = appSettings?.enable_passkeys ?? false;
  const perfilMenuOptions = getPerfilMenuOptions(passkeysEnabled);
  const manualUsuarioPath = appSettings?.manual_usuario_url ?? null;
  const canManageManual = realRole === "super";

  const toggleAccordion = (id: MenuAccordionId) => {
    setOpenAccordionId((current) => (current === id ? null : id));
  };

  useEffect(() => {
    if (isActividadesRoute) setOpenAccordionId("actividades");
  }, [isActividadesRoute]);

  useEffect(() => {
    if (isAdminRoute) setOpenAccordionId("admin");
  }, [isAdminRoute]);

  useEffect(() => {
    if (isObservatorioRoute) setOpenAccordionId("observatorio");
  }, [isObservatorioRoute]);

  useEffect(() => {
    if (!passkeysEnabled && isPasskeysOpen) setIsPasskeysOpen(false);
  }, [passkeysEnabled, isPasskeysOpen]);

  useEffect(() => {
    if (isProfileOpen || (isPasskeysOpen && passkeysEnabled)) setOpenAccordionId("perfil");
  }, [isProfileOpen, isPasskeysOpen, passkeysEnabled]);

  const handlePerfilOptionClick = (optionId: string) => {
    if (optionId === "mi-perfil") setIsProfileOpen(true);
    if (optionId === "ingreso-seguro" && passkeysEnabled) setIsPasskeysOpen(true);
  };

  const handleLogout = async () => {
    setIsOpen(false);
    const isDark = document.documentElement.classList.contains("dark");
    const result = await Swal.fire({
      title: "¿Cerrar sesión?",
      text: "Se cerrará tu sesión actual.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: isDark ? "#2c5f9b" : "#2563eb",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
      background: isDark ? "#252526" : "#ffffff",
      color: isDark ? "#cccccc" : "#000000",
    });

    if (result.isConfirmed) {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.replace("/");
    }
  };

  return (
    <>
      {mounted &&
        createPortal(
          <>
            {isOpen && (
              <div
                className="fixed inset-0 z-[99] bg-background/40"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />
            )}

            <aside
              className={cn(
                "fixed right-0 z-[110] pointer-events-auto w-full sm:w-100 bg-zinc-100/95 dark:bg-zinc-950 border-l border-border/50 transition-transform duration-500 overflow-y-auto flex flex-col",
                menuTop,
                menuHeight,
                isOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
              )}
            >
        {user ? (
          <div className="shrink-0 border-b border-celeste-trifinio/15 bg-gradient-to-b from-celeste-trifinio/12 via-celeste-trifinio/5 to-transparent dark:from-celeste-trifinio/20 dark:via-celeste-trifinio/8 dark:to-transparent">
            <div className="flex w-full items-center justify-start px-5 h-[var(--mobile-breadcrumb-height)] md:h-auto md:pt-5 md:pb-3">
              <button
                type="button"
                onClick={handleLogout}
                className="group flex items-center justify-center gap-2 text-red-500 dark:text-red-400 cursor-pointer transition-colors duration-300 active:scale-95"
              >
                <LogOut className="size-4 md:size-5 shrink-0 rotate-180 transition-transform duration-500 ease-out group-hover:scale-125 group-hover:-translate-x-0.5" />
                <span className="text-sm font-bold bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_2px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 ease-out group-hover:bg-[length:100%_2px]">
                  Cerrar Sesión
                </span>
              </button>
            </div>

            <div className="px-5 pb-4">
              <div className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 p-4 shadow-sm ring-1 ring-white/60 dark:ring-zinc-700/60">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Usuario
                    </p>
                    <p className="font-bold leading-tight text-celeste-trifinio truncate">{usuario}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Rol
                    </p>
                    <p className="font-bold leading-tight text-celeste-trifinio uppercase truncate">
                      {ROLE_LABELS[effectiveRole]?.toUpperCase() || effectiveRole.toUpperCase()}
                    </p>
                  </div>
                  <div className="col-span-2 min-w-0 border-t border-border/40 pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Nombre
                    </p>
                    <p className="font-bold leading-tight text-foreground truncate">{nombre}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsManualOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-celeste-trifinio/40 bg-white/50 dark:bg-zinc-900/40 px-4 py-2.5 text-left transition-colors duration-200 hover:border-celeste-trifinio hover:bg-white/80 dark:hover:bg-zinc-900/70 cursor-pointer active:scale-[0.99]"
              >
                <BookOpen className="size-4 text-celeste-trifinio shrink-0" strokeWidth={2.25} />
                <span className="text-xs font-bold text-celeste-trifinio">Manual de Usuario</span>
              </button>

              {effectiveRole === "super" && (pathname === "/" || pathname === "/comude") && (
                <div className="mt-3 p-3 bg-white/90 dark:bg-zinc-900/90 rounded-2xl ring-1 ring-white/60 dark:ring-zinc-700/60 flex justify-center">
                  <GlobalMunicipioSelector />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6" />
        )}

        <div className="flex flex-col flex-1 px-4 py-6 pb-8">
          {user ? (
            <>
              <nav className="mb-6 flex flex-col gap-7">
                <MenuSection label="Inicio" variant="modules">
                  <MenuHomeLink
                    pathname={pathname}
                    onNavigate={() => setIsOpen(false)}
                  />
                </MenuSection>

                {visibleActividadesOptions.length > 0 && (
                  <MenuSection label="Actividades" variant="actividades">
                    <MenuAccordion
                      id="menu-actividades"
                      title="Actividades"
                      subtitle="Colaborativas"
                      desc="Gestión de actividades individuales, colaborativas y acuerdos del COMUDE."
                      options={visibleActividadesOptions}
                      pathname={pathname}
                      open={openAccordionId === "actividades"}
                      onToggle={() => toggleAccordion("actividades")}
                      isRouteActive={isActividadesRoute}
                      onNavigate={() => setIsOpen(false)}
                      variant="actividades"
                      icon={ClipboardList}
                    />
                  </MenuSection>
                )}

                {(observatorioModule || mainModules.length > 0) && (
                    <MenuSection label="Módulos SOTE-COMUDE" variant="modules">
                      {observatorioModule && (
                        <MenuAccordion
                          id="menu-observatorio"
                          title={observatorioModule.title}
                          subtitle={observatorioModule.subtitle}
                          desc={observatorioModule.desc}
                          options={OBSERVATORIO_MENU_OPTIONS}
                          pathname={pathname}
                          open={openAccordionId === "observatorio"}
                          onToggle={() => toggleAccordion("observatorio")}
                          isRouteActive={isObservatorioRoute}
                          onNavigate={() => setIsOpen(false)}
                          variant="modules"
                          icon={Globe}
                        />
                      )}
                      {mainModules.map((mod) => (
                        <MenuModuleLink
                          key={mod.id}
                          mod={mod}
                          pathname={pathname}
                          onNavigate={() => setIsOpen(false)}
                        />
                      ))}
                    </MenuSection>
                  )}

                  {perfilModule && (
                    <MenuSection label="Mi Cuenta" variant="account">
                      <MenuAccordion
                        id="menu-perfil"
                        title={perfilModule.title}
                        subtitle={perfilModule.subtitle}
                        desc={perfilModule.desc}
                        options={perfilMenuOptions}
                        pathname={pathname}
                        open={openAccordionId === "perfil"}
                        onToggle={() => toggleAccordion("perfil")}
                        isRouteActive={isProfileOpen || (isPasskeysOpen && passkeysEnabled)}
                        onNavigate={() => setIsOpen(false)}
                        onOptionClick={handlePerfilOptionClick}
                        variant="account"
                        icon={User}
                      />
                    </MenuSection>
                  )}

                  {adminModule && (
                    <MenuSection label="Administración" variant="admin">
                      <MenuAccordion
                        id="menu-admin"
                        title={adminModule.title}
                        subtitle={adminModule.subtitle}
                        desc={adminModule.desc}
                        options={getVisibleAdminOptions(ADMIN_MENU_OPTIONS, effectiveRole)}
                        pathname={pathname}
                        open={openAccordionId === "admin"}
                        onToggle={() => toggleAccordion("admin")}
                        isRouteActive={isAdminRoute}
                        onNavigate={() => setIsOpen(false)}
                        variant="admin"
                        icon={Settings}
                      />
                    </MenuSection>
                  )}
                </nav>
            </>
          ) : (
            <div className="mb-8 mt-2">
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="group flex items-center justify-center gap-2 w-full text-celeste-trifinio hover:text-celeste-trifinio/80 cursor-pointer transition-colors duration-300 active:scale-95 py-2"
              >
                <LogIn className="size-5 md:size-6 shrink-0 transition-transform duration-500 ease-out group-hover:scale-125 group-hover:translate-x-0.5" />
                <span className="text-sm font-bold transition-transform duration-500 ease-out group-hover:translate-x-0.5">
                  Iniciar Sesión
                </span>
              </Link>
            </div>
          )}
        </div>

        {user && realRole === "super" && (
          <div className="mt-auto px-6 pb-3">
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/50 p-3 rounded-xl">
              <ShieldAlert className="size-5 text-yellow-600 shrink-0" />
              <select
                value={simulatedRole || ""}
                onChange={(e) => setSimulatedRole(e.target.value || null)}
                className="bg-transparent text-xs font-bold text-yellow-700 outline-none cursor-pointer w-full"
              >
                <option value="">Rol Real: {realRole.toUpperCase()}</option>
                <option value="admin">Simular: ADMINISTRADOR</option>
                <option value="comude">Simular: COMUDE</option>
                <option value="institucion">Simular: INSTITUCIÓN</option>
              </select>
            </div>
          </div>
        )}
        <div className={cn("px-6 py-4", !(user && realRole === "super") && "mt-auto")}>
          <div className="flex flex-col items-center justify-center gap-1">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              © 2026 SOTE-COMUDE
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 flex items-center gap-1 mt-1">
              Powered by{" "}
              <a
                href="https://www.oscar27jimenez.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline cursor-pointer transition-all inline-flex items-center text-zinc-900 dark:text-zinc-100"
              >
                <AuroraText className="text-xs whitespace-nowrap">
                  Kore | Ing. de Software
                </AuroraText>
              </a>
            </div>
          </div>
        </div>
      </aside>
          </>,
          document.body,
        )}

      {user && (
        <>
          <VerPerfil
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            userId={null}
          />
          {passkeysEnabled && (
            <PassKeysModal
              isOpen={isPasskeysOpen}
              onClose={() => setIsPasskeysOpen(false)}
              user={user}
            />
          )}
          <ManualUsuarioModal
            isOpen={isManualOpen}
            onClose={() => setIsManualOpen(false)}
            manualPath={manualUsuarioPath}
            canManage={canManageManual}
          />
        </>
      )}
    </>
  );
}
