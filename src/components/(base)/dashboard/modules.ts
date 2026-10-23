import { canManageUsers } from "@/components/(base)/(users)/usuarios/lib/permissions";

export type DashboardModule = {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  animatedIcon: string;
  href: string;
  requiresAdmin?: boolean;
  allowedRoles?: string[];
};

export const DASHBOARD_MODULES: DashboardModule[] = [
  /*
  {
    id: "observatorio",
    title: "Observatorio",
    subtitle: "Web",
    desc: "Plataforma web de visualización de datos regionales.",
    animatedIcon: "qqvpjphn",
    href: "/comude/observatorio",
    allowedRoles: ["super", "admin", "observatorio"],
  },
  */
  /*
  {
    id: "memoria-labores",
    title: "Memoria de",
    subtitle: "Labores",
    desc: "Formularios institucionales del Plan Trifinio para la memoria de labores semestral.",
    animatedIcon: "wvhscmei",
    href: "/comude/memoria-labores",
    allowedRoles: ["super", "admin", "comunicacion"],
  },
  */
  {
    id: "actividades",
    title: "Actividades",
    subtitle: "Colaborativas",
    desc: "Gestión de actividades individuales, colaborativas y acuerdos del COMUDE.",
    animatedIcon: "kthelypq",
    href: "/comude/actividades",
  },
  {
    id: "estructuras",
    title: "Estructuras",
    subtitle: "Org. y Territorial",
    desc: "Organigrama institucional y estructura territorial del municipio.",
    animatedIcon: "giblkgwf",
    href: "/comude/estructuras",
    requiresAdmin: true,
  },
  {
    id: "perfil",
    title: "Gestión de",
    subtitle: "Mi Perfil",
    desc: "Actualización de credenciales y datos personales del usuario.",
    animatedIcon: "btgcyfug",
    href: "/comude/perfil",
  },
  {
    id: "admin",
    title: "Ajustes",
    subtitle: "Admin",
    desc: "Panel de administración del sistema SOTE-COMUDE.",
    animatedIcon: "plusmrxr",
    href: "/comude/admin",
    requiresAdmin: true,
  },
];

export const OBSERVATORIO_MENU_OPTIONS = [
  {
    id: "movilidad-humana",
    title: "Movilidad Humana",
    desc: "Visualización de datos y estadísticas regionales del SOTE-COMUDE.",
    href: "/comude/observatorio",
    animatedIcon: "qqvpjphn",
  },
] as const;

export const ACTIVIDADES_MENU_OPTIONS = [
  {
    id: "mis-actividades",
    title: "Mis Actividades",
    desc: "Tus actividades personales y acuerdos asignados.",
    href: "/comude/actividades",
  },
  {
    id: "jefatura-actividades",
    title: "Actividades de mi Equipo",
    desc: "Seguimiento de miembros de tu equipo u oficina.",
    href: "/comude/actividades/jefatura",
  },
  {
    id: "supervision-actividades",
    title: "Actividades Globales",
    desc: "Actividades de todo el municipio divididas por dependencia.",
    href: "/comude/actividades/supervision",
  },
] as const;

export function isSuperRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role.toLowerCase().trim() === "super";
}

export function getVisibleActividadesOptions<T extends { id: string }>(
  options: readonly T[],
  role: string,
  esJefe: boolean = false,
): T[] {
  const isSuper = isSuperRole(role);
  const isSuperOrAdmin = isSuperOrAdminRole(role);

  return options.filter((opt) => {
    if (opt.id === "mis-actividades") return true;
    if (opt.id === "jefatura-actividades") {
      return isSuper || esJefe;
    }
    if (opt.id === "supervision-actividades") {
      return isSuperOrAdmin;
    }
    return true;
  });
}

export const PERFIL_MENU_OPTIONS = [
  {
    id: "mi-perfil",
    title: "Mi Perfil",
    desc: "Ver y editar perfil",
    animatedIcon: "btgcyfug",
  },
  {
    id: "ingreso-seguro",
    title: "Ingreso Seguro",
    desc: "Administrar dispositivos",
    animatedIcons: ["vxfekxur", "ilgzgiqi"] as const,
  },
] as const;

export function getPerfilMenuOptions(enablePasskeys: boolean) {
  return PERFIL_MENU_OPTIONS.filter(
    (option) => option.id !== "ingreso-seguro" || enablePasskeys,
  );
}

export const ADMIN_MENU_OPTIONS = [
  {
    id: "dispositivos",
    title: "Dispositivos",
    desc: "Autorizar o rechazar acceso por dispositivo.",
    href: "/comude/admin/dispositivos",
    animatedIcon: "gzqipvbr",
  },
  {
    id: "usuarios",
    title: "Usuarios",
    desc: "Cuentas, roles y permisos.",
    href: "/comude/admin/usuarios",
    animatedIcon: "vxfekxur",
  },
  {
    id: "configuraciones",
    title: "Configuraciones",
    desc: "Ajustes generales y seguridad.",
    href: "/comude/admin/configuraciones",
    animatedIcon: "plusmrxr",
  },
] as const;

export function isSuperOrAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === "super" || normalized === "admin" || normalized === "administrador";
}

export function getVisibleAdminOptions<T extends { id: string }>(
  options: readonly T[],
  role: string,
): T[] {
  if (isSuperOrAdminRole(role)) return [...options];
  return options.filter((opt) => opt.id === "usuarios");
}

export function getVisibleDashboardModules(effectiveRole: string) {
  const isSuperOrAdmin = isSuperOrAdminRole(effectiveRole);
  return DASHBOARD_MODULES.filter((mod) => {
    if (mod.id === "admin") {
      return canManageUsers(effectiveRole);
    }
    if (mod.requiresAdmin && !isSuperOrAdmin) return false;
    if (mod.allowedRoles) {
      const isAllowed =
        mod.allowedRoles.includes(effectiveRole) ||
        (mod.allowedRoles.includes("observatorio") &&
          effectiveRole.includes("observatorio"));
      if (!isAllowed) return false;
    }
    return true;
  });
}
