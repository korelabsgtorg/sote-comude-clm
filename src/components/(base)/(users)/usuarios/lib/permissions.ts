export const ROLE_LABELS: Record<string, string> = {
  cocode: "Comude",
  institucion: "Institución",
  admin: "Administrador",
  super: "Super Admin",
};

export const ROLE_ORDER = [
  "super",
  "admin",
  "cocode",
  "institucion",
] as const;

const ALL_KNOWN_ROLES = [...ROLE_ORDER];

/** Roles que contienen "observatorio" en su slug */
export function isObservatorioRole(role: string | null | undefined): boolean {
  return (role || "").includes("observatorio");
}

/** Roles que el actor puede ver y gestionar en usuarios */
export function getManageableRoles(actorRole: string): string[] {
  if (actorRole === "super") return [...ALL_KNOWN_ROLES];
  if (actorRole === "admin") return ALL_KNOWN_ROLES.filter((r) => r !== "super");
  return [];
}

export function canManageUsers(actorRole: string): boolean {
  return getManageableRoles(actorRole).length > 0;
}

export function canCreateUsers(actorRole: string): boolean {
  return canManageUsers(actorRole);
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  return getManageableRoles(actorRole).includes(targetRole);
}

export function isUserVisibleToActor(
  targetRole: string | null | undefined,
  actorRole: string,
): boolean {
  const role = targetRole || "cocode";
  return getManageableRoles(actorRole).includes(role);
}

export function orderRoles(roles: string[]): string[] {
  const set = new Set(roles);
  const ordered = ROLE_ORDER.filter((r) => set.has(r));
  const extras = roles.filter((r) => !ROLE_ORDER.includes(r as (typeof ROLE_ORDER)[number]));
  return [...ordered, ...extras];
}
