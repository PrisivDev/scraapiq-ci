/**
 * Notification providers — un par canal
 *
 * - email   : simulé (SMTP/SendGrid en prod)
 * - sms     : simulé (Twilio/Orange SMS API en prod)
 * - whatsapp: simulé (WhatsApp Business API en prod)
 * - push    : simulé (Firebase Cloud Messaging en prod)
 * - webhook : réel — POST HTTP avec signature HMAC-SHA256
 * - in_app  : aucune action externe (déjà stockée en DB)
 *
 * Tous les providers simulés loggent l'envoi pour audit.
 */

import { createHmac } from "crypto"
import { db } from "@/lib/db"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationChannel =
  | "email"
  | "sms"
  | "whatsapp"
  | "push"
  | "webhook"
  | "in_app"

export interface SendParams {
  to: string
  title: string
  body: string
  payload?: Record<string, unknown>
  /** Pour webhook : URL ; sinon null */
  webhookUrl?: string
  /** Pour webhook : secret HMAC (si webhook enregistré en DB, on le récupère) */
  webhookSecret?: string
  /** Nom de l'événement (header X-ScrapIQ-Event) */
  eventName?: string
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  /** Pour webhook : code HTTP de la réponse */
  httpStatus?: number
}

export interface NotificationProvider {
  channel: NotificationChannel
  send(params: SendParams): Promise<SendResult>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logDelivery(
  channel: NotificationChannel,
  to: string,
  title: string,
  success: boolean,
  error?: string
) {
  const prefix = success ? "[notify:ok]" : "[notify:fail]"
  console.log(
    `${prefix} ${channel} → ${to} | ${title}${error ? ` | err=${error}` : ""}`
  )
}

function genMessageId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// EMAIL — simulé
// ---------------------------------------------------------------------------

export const emailProvider: NotificationProvider = {
  channel: "email",
  async send(params: SendParams): Promise<SendResult> {
    try {
      if (!params.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.to)) {
        const err = `Invalid email recipient: ${params.to}`
        logDelivery("email", params.to, params.title, false, err)
        return { success: false, error: err }
      }
      // Simulation — en production : nodemailer.sendMail() ou SendGrid
      const messageId = genMessageId("eml")
      logDelivery("email", params.to, params.title, true)
      return { success: true, messageId }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Email send error"
      logDelivery("email", params.to, params.title, false, err)
      return { success: false, error: err }
    }
  },
}

// ---------------------------------------------------------------------------
// SMS — simulé
// ---------------------------------------------------------------------------

export const smsProvider: NotificationProvider = {
  channel: "sms",
  async send(params: SendParams): Promise<SendResult> {
    try {
      // Accepte +225 07 08 09 10 ou 07080910
      const phone = params.to.replace(/[\s.-]/g, "")
      if (!phone || phone.length < 8) {
        const err = `Invalid phone: ${params.to}`
        logDelivery("sms", params.to, params.title, false, err)
        return { success: false, error: err }
      }
      const messageId = genMessageId("sms")
      logDelivery("sms", params.to, params.title, true)
      return { success: true, messageId }
    } catch (e) {
      const err = e instanceof Error ? e.message : "SMS send error"
      logDelivery("sms", params.to, params.title, false, err)
      return { success: false, error: err }
    }
  },
}

// ---------------------------------------------------------------------------
// WHATSAPP — simulé
// ---------------------------------------------------------------------------

export const whatsappProvider: NotificationProvider = {
  channel: "whatsapp",
  async send(params: SendParams): Promise<SendResult> {
    try {
      const phone = params.to.replace(/[\s.-]/g, "")
      if (!phone || phone.length < 8) {
        const err = `Invalid WhatsApp recipient: ${params.to}`
        logDelivery("whatsapp", params.to, params.title, false, err)
        return { success: false, error: err }
      }
      const messageId = genMessageId("wa")
      logDelivery("whatsapp", params.to, params.title, true)
      return { success: true, messageId }
    } catch (e) {
      const err = e instanceof Error ? e.message : "WhatsApp send error"
      logDelivery("whatsapp", params.to, params.title, false, err)
      return { success: false, error: err }
    }
  },
}

// ---------------------------------------------------------------------------
// PUSH — simulé (FCM device token)
// ---------------------------------------------------------------------------

export const pushProvider: NotificationProvider = {
  channel: "push",
  async send(params: SendParams): Promise<SendResult> {
    try {
      if (!params.to || params.to.length < 16) {
        const err = `Invalid device token: ${params.to.slice(0, 12)}…`
        logDelivery("push", params.to.slice(0, 16), params.title, false, err)
        return { success: false, error: err }
      }
      const messageId = genMessageId("push")
      logDelivery("push", params.to.slice(0, 16), params.title, true)
      return { success: true, messageId }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Push send error"
      logDelivery("push", params.to.slice(0, 16), params.title, false, err)
      return { success: false, error: err }
    }
  },
}

// ---------------------------------------------------------------------------
// IN-APP — aucune action externe (stockée en DB par l'engine)
// ---------------------------------------------------------------------------

export const inAppProvider: NotificationProvider = {
  channel: "in_app",
  async send(params: SendParams): Promise<SendResult> {
    // La notification est déjà créée en DB par l'engine.
    // Ici on valide juste la présence d'un userId dans `to`.
    if (!params.to) {
      return { success: false, error: "Missing userId for in_app notification" }
    }
    const messageId = genMessageId("inapp")
    logDelivery("in_app", params.to, params.title, true)
    return { success: true, messageId }
  },
}

// ---------------------------------------------------------------------------
// WEBHOOK — réel POST HTTP + signature HMAC-SHA256
// ---------------------------------------------------------------------------

export const webhookProvider: NotificationProvider = {
  channel: "webhook",
  async send(params: SendParams): Promise<SendResult> {
    const url = params.webhookUrl
    if (!url) {
      return { success: false, error: "Missing webhook URL" }
    }
    try {
      new URL(url)
    } catch {
      return { success: false, error: `Invalid webhook URL: ${url}` }
    }

    const event = params.eventName || "notification"
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: {
        title: params.title,
        body: params.body,
        ...(params.payload || {}),
      },
    })

    const signature = params.webhookSecret
      ? createHmac("sha256", params.webhookSecret).update(body).digest("hex")
      : null

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ScrapIQ-Event": event,
          ...(signature
            ? { "X-ScrapIQ-Signature": `HMAC-SHA256 ${signature}` }
            : {}),
          "User-Agent": "ScrapIQ-CI-Notifications/1.0",
        },
        body,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const ok = res.status >= 200 && res.status < 300
      const messageId = genMessageId("wh")

      // Enregistrer la delivery en DB pour audit (best-effort)
      try {
        const webhook = await db.webhook.findFirst({
          where: { url, isActive: true },
          orderBy: { createdAt: "desc" },
        })
        if (webhook) {
          const responseText = await res.text().catch(() => "")
          await db.webhookDelivery.create({
            data: {
              webhookId: webhook.id,
              event,
              payload: body,
              statusCode: res.status,
              response: responseText.slice(0, 2000) || null,
              status: ok ? "success" : "failed",
              attempts: 1,
              deliveredAt: new Date(),
            },
          })
        }
      } catch {
        /* best-effort */
      }

      logDelivery(
        "webhook",
        url,
        params.title,
        ok,
        ok ? undefined : `HTTP ${res.status}`
      )

      if (!ok) {
        return {
          success: false,
          httpStatus: res.status,
          error: `HTTP ${res.status}`,
          messageId,
        }
      }
      return { success: true, httpStatus: res.status, messageId }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Webhook send error"
      logDelivery("webhook", url, params.title, false, err)
      return { success: false, error: err }
    }
  },
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const providers: Record<NotificationChannel, NotificationProvider> = {
  email: emailProvider,
  sms: smsProvider,
  whatsapp: whatsappProvider,
  push: pushProvider,
  webhook: webhookProvider,
  in_app: inAppProvider,
}

export function getProvider(channel: string): NotificationProvider | null {
  return providers[channel as NotificationChannel] || null
}
