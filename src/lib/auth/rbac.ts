/**
 * RBAC : vérification des permissions basée sur les rôles
 * - Héritage hiérarchique (OWNER > ADMIN > MANAGER > AGENT > VIEWER)
 * - Permissions granulaires par rôle
 * - Override possible au niveau membre (permissions additionnelles)
 */
import { ROLE_PERMISSIONS, ROLE_HIERARCHY, type Role, type Permission } from "./config"

/**
 * Récupère toutes les permissions effectives d'un membre
 * (permissions du rôle + overrides individuels)
 */
export function getEffectivePermissions(
  role: Role,
  customPermissions: string[] = []
): Permission[] {
  const rolePerms = ROLE_PERMISSIONS[role] || []
  const custom = customPermissions.filter(
    (p): p is Permission => Object.values(PERMISSIONS_SET).includes(p as Permission)
  )
  return Array.from(new Set([...rolePerms, ...custom]))
}

// Set local pour lookup rapide
const PERMISSIONS_SET: Record<string, string> = Object.fromEntries(
  Object.values(ROLE_PERMISSIONS)
    .flat()
    .map((p) => [p, p])
)

/**
 * Vérifie si un rôle possède une permission
 */
export function hasPermission(
  role: Role,
  permission: Permission,
  customPermissions: string[] = []
): boolean {
  const effective = getEffectivePermissions(role, customPermissions)
  return effective.includes(permission)
}

/**
 * Vérifie plusieurs permissions (toutes requises)
 */
export function hasAllPermissions(
  role: Role,
  permissions: Permission[],
  customPermissions: string[] = []
): boolean {
  return permissions.every((p) => hasPermission(role, p, customPermissions))
}

/**
 * Vérifie au moins une permission
 */
export function hasAnyPermission(
  role: Role,
  permissions: Permission[],
  customPermissions: string[] = []
): boolean {
  return permissions.some((p) => hasPermission(role, p, customPermissions))
}

/**
 * Vérifie la hiérarchie : est-ce que roleA a au moins le niveau de roleB ?
 */
export function isAtLeast(roleA: Role, roleB: Role): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB]
}

/**
 * Vérifie si un utilisateur peut agir sur un autre (basé sur la hiérarchie)
 */
export function canManageUser(
  actorRole: Role,
  targetRole: Role
): boolean {
  // On ne peut pas gérer quelqu'un de rôle supérieur ou égal au sien (sauf owner)
  if (actorRole === "OWNER") return true
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole]
}
