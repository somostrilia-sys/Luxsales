import { corsHeaders, json, corsResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { retryWithBackoff, fetchWithTimeout } from "../_shared/retry.ts";

/**
 * Notification Service Edge Function
 * Supports: email (Resend), Slack webhook, in-app notifications
 *
 * POST /functions/v1/notification-service
 * Body: {
 *   channel: "email" | "slack" | "in_app" | "all",
 *   to?: string | string[],          // email addresses or user IDs
 *   subject?: string,                 // email subject
 *   body: string,                     // message body (HTML for email, markdown for Slack)
 *   template?: string,                // optional template name
 *   template_data?: Record<string, string>,
 *   company_id?: string,              // for in-app notifications
 *   severity?: "info" | "warning" | "critical",
 *   metadata?: Record<string, unknown>
 * }
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Walk Holding <noreply@holdingwalk.com.br>";
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");

interface NotificationRequest {
  channel: "email" | "slack" | "in_app" | "all";
  to?: string | string[];
  subject?: string;
  body: string;
  template?: string;
  template_data?: Record<string, string>;
  company_id?: string;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}

// Email templates
const templates: Record<string, (data: Record<string, string>) => { subject: string; html: string }> = {
  lead_assigned: (d) => ({
    subject: `Novos leads atribuídos - ${d.count || ""}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e40af;">Leads Atribuídos</h2>
        <p>Olá <strong>${d.name || "Consultor"}</strong>,</p>
        <p>Você recebeu <strong>${d.count || "novos"}</strong> leads para trabalhar.</p>
        <p>Acesse o painel para visualizar: <a href="https://app.holdingwalk.com.br/motor-leads" style="color:#2563eb;">Motor de Leads</a></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#6b7280;font-size:12px;">Walk Holding Corporation</p>
      </div>`,
  }),
  missed_call: (d) => ({
    subject: `Chamada perdida de ${d.caller || "desconhecido"}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;">Chamada Perdida</h2>
        <p>Uma chamada de <strong>${d.caller || "número desconhecido"}</strong> não foi atendida.</p>
        <p>Horário: ${d.time || new Date().toLocaleString("pt-BR")}</p>
        <p><a href="https://app.holdingwalk.com.br/dashboard-voip" style="color:#2563eb;">Ver no Dashboard VoIP</a></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#6b7280;font-size:12px;">Walk Holding Corporation</p>
      </div>`,
  }),
  daily_report: (d) => ({
    subject: `Relatório diário - ${d.date || new Date().toLocaleDateString("pt-BR")}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e40af;">Relatório Diário</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Chamadas</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;">${d.total_calls || "0"}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Leads novos</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;">${d.new_leads || "0"}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Mensagens WhatsApp</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;">${d.whatsapp_msgs || "0"}</td></tr>
          <tr><td style="padding:8px;">Conversões</td><td style="padding:8px;font-weight:bold;color:#16a34a;">${d.conversions || "0"}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#6b7280;font-size:12px;">Walk Holding Corporation</p>
      </div>`,
  }),
  compliance_alert: (d) => ({
    subject: `[ALERTA] Violação de compliance detectada`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;">Alerta de Compliance</h2>
        <p><strong>Tipo:</strong> ${d.type || "N/A"}</p>
        <p><strong>Detalhes:</strong> ${d.details || "N/A"}</p>
        <p><strong>Empresa:</strong> ${d.company || "N/A"}</p>
        <p>Ação imediata pode ser necessária.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#6b7280;font-size:12px;">Walk Holding Corporation - Sistema Automático</p>
      </div>`,
  }),
};

async function sendEmail(to: string | string[], subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping email");
    return false;
  }

  const recipients = Array.isArray(to) ? to : [to];

  const res = await retryWithBackoff(async () => {
    const r = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: recipients,
        subject,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Resend API error ${r.status}: ${err}`);
    }
    return r;
  });

  return res.ok;
}

async function sendSlack(body: string, severity?: string): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not configured, skipping Slack");
    return false;
  }

  const emoji = severity === "critical" ? ":rotating_light:" : severity === "warning" ? ":warning:" : ":information_source:";

  const res = await retryWithBackoff(async () => {
    const r = await fetchWithTimeout(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `${emoji} ${body}`,
        unfurl_links: false,
      }),
    });

    if (!r.ok) throw new Error(`Slack webhook error ${r.status}`);
    return r;
  });

  return res.ok;
}

async function saveInApp(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string | undefined,
  body: string,
  severity: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  // Store in-app notifications in audit_logs with action = 'notification'
  const { error } = await supabase.from("audit_logs").insert({
    company_id: companyId || null,
    action: "notification",
    entity_type: "system",
    details: {
      message: body,
      severity,
      ...metadata,
      read: false,
      created_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error("Failed to save in-app notification:", error);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const payload: NotificationRequest = await req.json();
    const { channel, to, subject, body, template, template_data, company_id, severity = "info", metadata } = payload;

    if (!body && !template) {
      return json({ error: "body or template is required" }, 400);
    }

    const supabase = getServiceClient();
    const results: Record<string, boolean> = {};

    // Resolve template
    let finalSubject = subject || "Notificação Walk Holding";
    let finalHtml = body;

    if (template && templates[template] && template_data) {
      const rendered = templates[template](template_data);
      finalSubject = subject || rendered.subject;
      finalHtml = rendered.html;
    }

    // Send based on channel
    if (channel === "email" || channel === "all") {
      if (to) {
        results.email = await sendEmail(to, finalSubject, finalHtml);
      }
    }

    if (channel === "slack" || channel === "all") {
      results.slack = await sendSlack(body, severity);
    }

    if (channel === "in_app" || channel === "all") {
      results.in_app = await saveInApp(supabase, company_id, body, severity, metadata);
    }

    // Log notification
    await supabase.from("audit_logs").insert({
      company_id: company_id || null,
      action: "notification_sent",
      entity_type: "notification",
      details: { channel, severity, results, template },
    });

    return json({ success: true, results });
  } catch (err) {
    console.error("Notification service error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
