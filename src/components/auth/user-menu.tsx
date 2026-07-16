"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LogOut,
  Shield,
  MonitorSmartphone,
  KeyRound,
  User as UserIcon,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

interface CurrentUser {
  id: string
  email: string
  name?: string | null
  avatarUrl?: string | null
  role?: string
}

/**
 * User dropdown menu used in the dashboard header.
 *
 * - On mount, fetches /api/me to display the user's name/email/avatar.
 * - Provides links to /account/* pages.
 * - Includes a working "Se déconnecter" button that calls /api/auth/logout
 *   and redirects to /auth/login.
 *
 * Falls back to "Mon compte" with no email when the user is not authenticated
 * (which shouldn't happen on the dashboard, but is graceful nonetheless).
 */
export function UserMenu() {
  const router = useRouter()
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loggingOut, setLoggingOut] = React.useState(false)

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        if (active && data?.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            avatarUrl: data.user.avatarUrl,
            role: data.user.role,
          })
        }
      } catch {
        // Silent: dashboard is public-ish; show fallback.
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const initials = React.useMemo(() => {
    const name = user?.name || user?.email || "U"
    const parts = name.split(/[\s@._-]+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }, [user])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
      toast.success("Déconnexion réussie", {
        description: "À bientôt sur ScrapIQ CI.",
      })
      router.push("/auth/login")
    } catch {
      toast.error("Erreur lors de la déconnexion")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Menu utilisateur"
        >
          <Avatar className="h-8 w-8">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                initials
              )}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium truncate">
              {user?.name || "Mon compte"}
            </span>
            <span className="text-xs text-muted-foreground font-normal truncate">
              {user?.email || "Chargement…"}
            </span>
            {user?.role && (
              <span className="mt-1 inline-flex w-fit items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {user.role}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/security" className="cursor-pointer">
            <Shield className="h-4 w-4 mr-2" />
            Sécurité
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/sessions" className="cursor-pointer">
            <MonitorSmartphone className="h-4 w-4 mr-2" />
            Sessions actives
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/permissions" className="cursor-pointer">
            <KeyRound className="h-4 w-4 mr-2" />
            Permissions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <UserIcon className="h-4 w-4 mr-2" />
          Mon profil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {loggingOut ? "Déconnexion…" : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Convenience wrapper: a simple logout button (no avatar).
 * Used in compact headers / account pages.
 */
export function LogoutButton({
  variant = "outline",
  size = "sm",
  className,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const handle = async () => {
    setLoading(true)
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
      toast.success("Déconnexion réussie")
      router.push("/auth/login")
    } catch {
      toast.error("Erreur lors de la déconnexion")
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handle}
      disabled={loading}
      className={className}
    >
      <LogOut className="h-4 w-4" />
      {loading ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  )
}
