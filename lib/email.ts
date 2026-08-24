// Transactional email over the same Brevo SMTP relay auth.ts uses for
// magic links. One transport, lazily created (server-only module).

import nodemailer from 'nodemailer'

let _transport: nodemailer.Transporter | null = null

function transport(): nodemailer.Transporter {
  if (_transport) return _transport
  _transport = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST ?? 'smtp-relay.brevo.com',
    port: parseInt(process.env.BREVO_SMTP_PORT ?? '587', 10),
    auth: {
      user: process.env.BREVO_SMTP_USER!,
      pass: process.env.BREVO_SMTP_KEY!,
    },
  })
  return _transport
}

const FROM = () => process.env.EMAIL_FROM ?? 'hello@degeneratesdashboard.app'

export async function sendLeagueInviteEmail({
  to,
  leagueName,
  inviterName,
  inviteUrl,
}: {
  to: string
  leagueName: string
  inviterName: string
  inviteUrl: string
}) {
  const subject = `${inviterName} invited you to ${leagueName}`
  const text = [
    `${inviterName} invited you to join "${leagueName}" on Degenerates Dashboard —`,
    `one combined parlay a week, one leg per degenerate.`,
    ``,
    `Accept the invite: ${inviteUrl}`,
    ``,
    `This invitation expires in 7 days.`,
  ].join('\n')
  const html = `
    <div style="background:#0a0a0a;color:#e5e7eb;font-family:system-ui,-apple-system,sans-serif;padding:32px 24px;border-radius:12px;max-width:520px;margin:0 auto">
      <p style="color:#00D9FF;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;font-weight:700;margin:0 0 12px">Degenerates Dashboard</p>
      <h1 style="font-size:22px;margin:0 0 16px;color:#ffffff">${escapeHtml(inviterName)} invited you to <span style="color:#00D9FF">${escapeHtml(leagueName)}</span></h1>
      <p style="font-size:14px;line-height:1.6;color:#9ca3af;margin:0 0 24px">One combined parlay a week, one leg per degenerate. Vote on the rules, lock the dates, settle the punishment.</p>
      <a href="${inviteUrl}" style="display:inline-block;background:#00D9FF;color:#0a0a0a;font-weight:700;font-size:14px;padding:12px 28px;border-radius:9999px;text-decoration:none">Join the league</a>
      <p style="font-size:12px;color:#6b7280;margin:24px 0 0">This invitation expires in 7 days. If the button doesn't work, paste this link into your browser:<br/><span style="color:#9ca3af">${inviteUrl}</span></p>
    </div>`
  await transport().sendMail({ from: FROM(), to, subject, text, html })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
