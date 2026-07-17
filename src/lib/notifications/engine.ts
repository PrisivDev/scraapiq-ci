/**
 * Notification engine — orchestration des envois multi-canal
 *
 * - sendNotification()      : crée une Notification + dispatch via provider
 * - sendMultiChannel()      : envoi sur plusieurs canaux (ex: email + in_app + webhook)
 * - getNotificationStats()  : agrégations par canal, statut, priorité
 * - markAsRead()            : notif in_app marquée comme lue
 * - listNotifications()     : liste paginée avec filtres
 */

import { db } from "@/lib/db"
import {
  getProvider,
  type NotificationChannel,
  type SendParams,
  type SendResult,
} from "./providers"

// Re-export so consumers (alerts.ts, reports.ts) can import the channel type
// from a single entry point alongside sendMultiChannel().
export type { NotificationChannel } from "./providers"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "read"

export type NotificationPriority = "low" | "normal" | "high" | "critical"

export interface SendNotificationParams {
  userId?: string | null
  channel: NotificationChannel
  title: string
  body: string
  recipient?: string
  senderId?: string
  priority?: NotificationPriority
  payload?: Record<string, unknown>
  maxAttempts?: number
  /** Pour webhook : URL cible */
  webhookUrl?: string
  /** Pour webhook : secret HMAC */
  webhookSecret?: string
  /** Nom de l'événement (webhook) */
  eventName?: string
}

export interface NotificationRecord {
  id: string
  userId: string | null
  channel: string
  title: string
  body: string
  payload: Record<string, unknown>
  status: string
  priority: string
  recipient: string | null
  senderId: string | null
  attempts: number
  maxAttempts: number
  error: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  createdAt: Date
}

export interface ListFilters {
  channel?: string
  status?: string
  priority?: string
  userId?: string
  search?: string
  page: number
  limit: number
}

export interface ListResult {
  items: NotificationRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface NotificationStats {
  total: number
  byChannel: Record<string, number>
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  unreadInApp: number
  failed24h: number
  sent24h: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serialize(n: {
  id: string
  userId: string | null
  channel: string
  title: string
  body: string
  payload: string
  status: string
  priority: string
  recipient: string | null
  senderId: string | null
  attempts: number
  maxAttempts: number
  error: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  createdAt: Date
}): NotificationRecord {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(n.payload || "{}")
  } catch {
    payload = {}
  }
  return {
    ...n,
    payload,
  }
}

async function lookupWebhookSecret(url: string): Promise<string | null> {
  try {
    const webhook = await db.webhook.findFirst({
      where: { url, isActive: true },
      orderBy: { createdAt: "desc" },
    })
    return webhook?.secret || null
  } catch {
    return null
  }
}

function buildSendParams(
  params: SendNotificationParams,
  recipient: string
): SendParams {
  return {
    to: recipient,
    title: params.title,
    body: params.body,
    payload: params.payload,
    webhookUrl: params.webhookUrl,
    webhookSecret: params.webhookSecret,
    eventName: params.eventName || "notification",
  }
}

// ---------------------------------------------------------------------------
// Core : envoi unique
// ---------------------------------------------------------------------------

export async function sendNotification(
  params: SendNotificationParams
): Promise<{ notification: NotificationRecord; result: SendResult }> {
  // Résolution du destinataire par défaut
  let recipient = params.recipient || ""

  if (params.channel === "in_app" && !recipient && params.userId) {
    recipient = params.userId
  }
  if (params.channel === "email" && !recipient && params.userId) {
    try {
      const user = await db.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      })
      recipient = user?.email || ""
    } catch {
      /* ignore */
    }
  }

  // Si webhook et URL fournie mais secret absent → on le cherche en DB
  let webhookSecret = params.webhookSecret
  if (params.channel === "webhook" && params.webhookUrl && !webhookSecret) {
    webhookSecret = (await lookupWebhookSecret(params.webhookUrl)) || undefined
  }

  // Création de la notification (statut pending)
  const created = await db.notification.create({
    data: {
      userId: params.userId || null,
      channel: params.channel,
      title: params.title,
      body: params.body,
      payload: JSON.stringify(params.payload || {}),
      status: "pending",
      priority: params.priority || "normal",
      recipient: recipient || null,
      senderId: params.senderId || null,
      maxAttempts: params.maxAttempts || 3,
    },
  })

  // Dispatch via provider
  const provider = getProvider(params.channel)
  if (!provider) {
    const updated = await db.notification.update({
      where: { id: created.id },
      data: {
        status: "failed",
        error: `No provider for channel: ${params.channel}`,
        attempts: 1,
      },
    })
    return {
      notification: serialize(updated),
      result: { success: false, error: `Unknown channel: ${params.channel}` },
    }
  }

  const sendParams = buildSendParams(
    { ...params, webhookSecret },
    recipient
  )

  let result: SendResult
  try {
    result = await provider.send(sendParams)
  } catch (e) {
    result = {
      success: false,
      error: e instanceof Error ? e.message : "Provider threw",
    }
  }

  // Mise à jour selon le résultat
  const newStatus: NotificationStatus =
    params.channel === "in_app" && result.success
      ? "delivered" // in-app est immédiatement délivré (affiché dans l'UI)
      : result.success
        ? "sent"
        : "failed"

  const updated = await db.notification.update({
    where: { id: created.id },
    data: {
      status: newStatus,
      attempts: 1,
      error: result.success ? null : result.error || "Unknown error",
      sentAt: result.success ? new Date() : null,
      deliveredAt: newStatus === "delivered" ? new Date() : null,
    },
  })

  return {
    notification: serialize(updated),
    result,
  }
}

// ---------------------------------------------------------------------------
// Multi-canal : envoie la même notif sur N canaux
// ---------------------------------------------------------------------------

export interface SendMultiChannelParams {
  userId?: string | null
  channels: NotificationChannel[]
  title: string
  body: string
  priority?: NotificationPriority
  payload?: Record<string, unknown>
  senderId?: string
  /** Pour canal webhook */
  webhookUrl?: string
  webhookSecret?: string
  eventName?: string
  /** Override destinataire par canal (ex: { email: "x@y.com", sms: "+225..." }) */
  recipients?: Partial<Record<NotificationChannel, string>>
}

export async function sendMultiChannel(
  params: SendMultiChannelParams
): Promise<{
  total: number
  success: number
  failed: number
  results: Array<{ channel: NotificationChannel; success: boolean; error?: string }>
  notifications: NotificationRecord[]
}> {
  const notifications: NotificationRecord[] = []
  const results: Array<{
    channel: NotificationChannel
    success: boolean
    error?: string
  }> = []
  let successCount = 0
  let failedCount = 0

  for (const channel of params.channels) {
    const recipient = params.recipients?.[channel]
    const { notification, result } = await sendNotification({
      userId: params.userId,
      channel,
      title: params.title,
      body: params.body,
      recipient,
      priority: params.priority,
      payload: params.payload,
      senderId: params.senderId,
      webhookUrl: params.webhookUrl,
      webhookSecret: params.webhookSecret,
      eventName: params.eventName,
    })
    notifications.push(notification)
    results.push({
      channel,
      success: result.success,
      error: result.error,
    })
    if (result.success) successCount++
    else failedCount++
  }

  return {
    total: params.channels.length,
    success: successCount,
    failed: failedCount,
    results,
    notifications,
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getNotificationStats(): Promise<NotificationStats> {
  const now = new Date()
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [
    total,
    byChannelRaw,
    byStatusRaw,
    byPriorityRaw,
    unreadInApp,
    failed24h,
    sent24h,
  ] = await Promise.all([
    db.notification.count(),
    db.notification.groupBy({
      by: ["channel"],
      _count: { _all: true },
    }),
    db.notification.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.notification.groupBy({
      by: ["priority"],
      _count: { _all: true },
    }),
    db.notification.count({
      where: {
        channel: "in_app",
        status: { not: "read" },
      },
    }),
    db.notification.count({
      where: {
        status: "failed",
        createdAt: { gte: h24 },
      },
    }),
    db.notification.count({
      where: {
        status: { in: ["sent", "delivered", "read"] },
        sentAt: { gte: h24 },
      },
    }),
  ])

  const byChannel: Record<string, number> = {}
  for (const r of byChannelRaw) byChannel[r.channel] = r._count._all

  const byStatus: Record<string, number> = {}
  for (const r of byStatusRaw) byStatus[r.status] = r._count._all

  const byPriority: Record<string, number> = {}
  for (const r of byPriorityRaw) byPriority[r.priority] = r._count._all

  return {
    total,
    byChannel,
    byStatus,
    byPriority,
    unreadInApp,
    failed24h,
    sent24h,
  }
}

// ---------------------------------------------------------------------------
// Mark as read
// ---------------------------------------------------------------------------

export async function markAsRead(
  notificationId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notif = await db.notification.findUnique({
      where: { id: notificationId },
    })
    if (!notif) {
      return { success: false, error: "Notification not found" }
    }
    if (userId && notif.userId && notif.userId !== userId) {
      return { success: false, error: "Forbidden" }
    }
    await db.notification.update({
      where: { id: notificationId },
      data: {
        status: "read",
        readAt: new Date(),
      },
    })
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    }
  }
}

// ---------------------------------------------------------------------------
// List paginated with filters
// ---------------------------------------------------------------------------

export async function listNotifications(
  filters: ListFilters
): Promise<ListResult> {
  const where: Record<string, unknown> = {}

  if (filters.channel) where.channel = filters.channel
  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.userId) where.userId = filters.userId
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { body: { contains: filters.search } },
    ]
  }

  const [total, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
  ])

  const totalPages = filters.limit > 0 ? Math.ceil(total / filters.limit) : 0

  return {
    items: items.map(serialize),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages,
  }
}

// ---------------------------------------------------------------------------
// Single fetch
// ---------------------------------------------------------------------------

export async function getNotification(
  id: string
): Promise<NotificationRecord | null> {
  const n = await db.notification.findUnique({ where: { id } })
  if (!n) return null
  return serialize(n)
}

// ---------------------------------------------------------------------------
// Convenience : envoi d'un test sur tous les canaux (pour /notifications/test)
// ---------------------------------------------------------------------------

export async function sendTestNotification(
  userId: string,
  userEmail?: string
): Promise<{
  results: Array<{
    channel: NotificationChannel
    success: boolean
    error?: string
  }>
}> {
  const channels: NotificationChannel[] = [
    "email",
    "sms",
    "whatsapp",
    "push",
    "in_app",
  ]

  const results: Array<{
    channel: NotificationChannel
    success: boolean
    error?: string
  }> = []

  for (const channel of channels) {
    let recipient = ""
    if (channel === "email") recipient = userEmail || "demo@scraapiq.ci"
    if (channel === "sms") recipient = "+225 07 08 09 10"
    if (channel === "whatsapp") recipient = "+225 07 08 09 10"
    if (channel === "push") recipient = "fcm_demo_token_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
    if (channel === "in_app") recipient = userId

    const { result } = await sendNotification({
      userId,
      channel,
      title: "Test de notification ScrapIQ CI",
      body: `Ceci est un test sur le canal ${channel.toUpperCase()} — ${new Date().toLocaleString("fr-FR")}`,
      recipient,
      priority: "normal",
      payload: { test: true, channel, ts: Date.now() },
    })
    results.push({
      channel,
      success: result.success,
      error: result.error,
    })
  }

  return { results }
}
