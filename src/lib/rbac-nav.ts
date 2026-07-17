/**
 * Configuration RBAC — contrôle d'accès par rôle pour la navigation
 *
 * Rôles hiérarchiques :
 *  OWNER  (100) — contrôle total, y compris SaaS, sécurité, facturation
 *  ADMIN  (80)  — gestion org, API, notifications, back office
 *  MANAGER(60)  — gestion équipe, jobs, exports, BI
 *  AGENT  (40)  — opérations : recherche, scraping, entreprises
 *  VIEWER (20)  — lecture seule
 *
 * Chaque section de la sidebar a un rôle minimum requis.
 * Si l'utilisateur a un rôle inférieur, la section est masquée.
 */

import type { NavKey } from "@/components/dashboard/sidebar"

export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER"

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  MANAGER: 60,
  AGENT: 40,
  VIEWER: 20,
}

/**
 * Rôle minimum requis pour chaque section de la sidebar.
 * Si l'utilisateur a un rôle avec un niveau < au minimum, la section est masquée.
 */
export const NAV_ROLE_ACCESS: Record<NavKey, UserRole> = {
  // Pilotage — accessible à tous
  dashboard: "VIEWER",
  assistant: "VIEWER",
  search: "VIEWER",
  bi: "MANAGER",

  // Données — accessible à tous en lecture
  companies: "VIEWER",
  map: "VIEWER",
  sources: "AGENT",

  // Opérations — agents et supérieurs
  jobs: "AGENT",
  scraper: "AGENT",
  exports: "AGENT",

  // Administration — managers et supérieurs
  team: "MANAGER",
  notifications: "MANAGER",
  api: "ADMIN",
  backoffice: "ADMIN",
  queue: "ADMIN",
  security: "ADMIN",
  pwa: "ADMIN",
  saas: "OWNER",

  // Paramètres — accessible à tous (pour son propre profil)
  settings: "VIEWER",
}

/**
 * Vérifie si un rôle peut accéder à une section
 */
export function canAccess(userRole: UserRole, navKey: NavKey): boolean {
  const requiredRole = NAV_ROLE_ACCESS[navKey]
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Filtre la liste des sections accessibles pour un rôle
 */
export function getAccessibleNavKeys(userRole: UserRole): NavKey[] {
  return (Object.keys(NAV_ROLE_ACCESS) as NavKey[]).filter((key) => canAccess(userRole, key))
}

/**
 * Vérifie si l'utilisateur peut effectuer une action spécifique
 */
export function canPerform(userRole: UserRole, action: string): boolean {
  const actionRoles: Record<string, UserRole> = {
    // Entreprises
    "company:create": "AGENT",
    "company:update": "AGENT",
    "company:delete": "MANAGER",
    "company:export": "AGENT",
    // Jobs
    "job:create": "AGENT",
    "job:cancel": "MANAGER",
    "job:delete": "MANAGER",
    // Équipe
    "member:invite": "MANAGER",
    "member:remove": "ADMIN",
    "member:update_role": "ADMIN",
    // Admin
    "org:settings": "ADMIN",
    "org:billing": "OWNER",
    "api_key:manage": "ADMIN",
    "audit:read": "ADMIN",
    "source:manage": "ADMIN",
    // SaaS
    "saas:manage": "OWNER",
    "saas:license": "OWNER",
    "saas:billing": "OWNER",
  }

  const requiredRole = actionRoles[action]
  if (!requiredRole) return true // action non répertoriée = autorisée
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Rôle par défaut si non authentifié ou inconnu
 */
export const DEFAULT_ROLE: UserRole = "VIEWER"

/**
 * Labels des rôles pour l'affichage
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  AGENT: "Agent",
  VIEWER: "Viewer",
}

/**
 * Couleurs des badges de rôle
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  OWNER: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  ADMIN: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  MANAGER: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  AGENT: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  VIEWER: "bg-slate-500/10 text-slate-600 border-slate-500/30",
}
