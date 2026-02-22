import { NextRequest, NextResponse } from "next/server";

const SUPABASE_PROJECT_REF = "unzusbynaxkticlgtrsg";

// Shared header/footer builder to keep templates DRY
const header = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 0;"><tr><td align="center"><table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;"><tr><td style="background:linear-gradient(135deg,#0B27BC 0%,#091fa0 100%);border-radius:16px 16px 0 0;padding:32px 32px 24px;text-align:center;"><div style="width:56px;height:56px;background-color:rgba(255,255,255,0.15);border-radius:14px;margin:0 auto 16px;"><img src="https://ikastara-kita-dashboard.vercel.app/icon.png" alt="Ikastara Kita" width="40" height="40" style="display:block;border-radius:8px;margin:8px auto;" /></div><h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Ikastara Kita</h1><p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Platform Koordinasi &mdash; Aditya Syarief</p></td></tr>`;

const accentBar = `<tr><td style="height:4px;background:linear-gradient(90deg,#fcb7c3,#FE8DA1,#fcb7c3);"></td></tr>`;

const footer = (note: string) =>
  `${accentBar}<tr><td style="background-color:#f9fafb;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;"><p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Email ini dikirim oleh <strong>Ikastara Kita</strong></p><p style="margin:0;font-size:11px;color:#d1d5db;">${note}</p></td></tr></table></td></tr></table>`;

const wrap = (body: string) =>
  `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">${body}</body></html>`;

const btn = (url: string, label: string, color = "#0B27BC", colorEnd = "#091fa0") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;"><a href="${url}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,${color} 0%,${colorEnd} 100%);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">${label}</a></td></tr></table>`;

const divider = `<div style="border-top:1px solid #e5e7eb;margin:0 0 20px;"></div>`;

// ── Invite ───────────────────────────────────────────────────────────
const inviteTemplate = wrap(
  header +
  `<tr><td style="background-color:#ffffff;padding:32px;">` +
  `<h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Selamat Datang! &#127881;</h2>` +
  `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">Anda telah diundang untuk bergabung di <strong>Ikastara Kita</strong>. Klik tombol di bawah untuk mengaktifkan akun Anda.</p>` +
  btn("{{ .ConfirmationURL }}", "Aktifkan Akun Saya") +
  divider +
  `<p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;">Langkah selanjutnya:</p>` +
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
  `<tr><td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:24px;height:24px;background-color:#0B27BC;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-size:11px;font-weight:700;line-height:24px;">1</td><td style="padding-left:10px;font-size:13px;color:#4b5563;">Klik tombol di atas untuk membuka halaman aktivasi</td></tr></table></td></tr>` +
  `<tr><td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:24px;height:24px;background-color:#0B27BC;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-size:11px;font-weight:700;line-height:24px;">2</td><td style="padding-left:10px;font-size:13px;color:#4b5563;">Buat password baru untuk akun Anda</td></tr></table></td></tr>` +
  `<tr><td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:24px;height:24px;background-color:#0B27BC;border-radius:50%;text-align:center;vertical-align:middle;color:#fff;font-size:11px;font-weight:700;line-height:24px;">3</td><td style="padding-left:10px;font-size:13px;color:#4b5563;">Mulai gunakan dashboard dan kelola data anggota</td></tr></table></td></tr>` +
  `</table>` +
  `</td></tr>` +
  footer("Jika Anda tidak merasa mendaftar, abaikan email ini.")
);

// ── Confirmation ─────────────────────────────────────────────────────
const confirmationTemplate = wrap(
  header +
  `<tr><td style="background-color:#ffffff;padding:32px;">` +
  `<h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Konfirmasi Email Anda &#9989;</h2>` +
  `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">Terima kasih telah mendaftar di <strong>Ikastara Kita</strong>. Silakan konfirmasi alamat email Anda.</p>` +
  btn("{{ .ConfirmationURL }}", "Konfirmasi Email") +
  divider +
  `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Atau gunakan kode OTP berikut:</p>` +
  `<div style="margin:12px 0 0;text-align:center;"><span style="display:inline-block;background-color:#f3f4f6;border:2px dashed #d1d5db;border-radius:10px;padding:12px 28px;font-size:28px;font-weight:700;color:#0B27BC;letter-spacing:6px;">{{ .Token }}</span></div>` +
  `</td></tr>` +
  footer("Jika Anda tidak merasa mendaftar, abaikan email ini.")
);

// ── Recovery ─────────────────────────────────────────────────────────
const recoveryTemplate = wrap(
  header +
  `<tr><td style="background-color:#ffffff;padding:32px;">` +
  `<h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Atur Ulang Password &#128274;</h2>` +
  `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">Kami menerima permintaan untuk mengatur ulang password akun Anda di <strong>Ikastara Kita</strong>.</p>` +
  btn("{{ .ConfirmationURL }}", "Atur Ulang Password", "#84303F", "#6e2835") +
  divider +
  `<div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;"><p style="margin:0;font-size:12px;color:#991b1b;line-height:1.5;"><strong>Perhatian:</strong> Jika Anda tidak meminta ini, abaikan email ini. Akun Anda tetap aman.</p></div>` +
  `</td></tr>` +
  footer("Link ini berlaku selama 1 jam.")
);

// ── Magic Link ───────────────────────────────────────────────────────
const magicLinkTemplate = wrap(
  header +
  `<tr><td style="background-color:#ffffff;padding:32px;">` +
  `<h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Masuk ke Dashboard &#128273;</h2>` +
  `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">Klik tombol di bawah untuk masuk ke <strong>Ikastara Kita</strong>. Link ini hanya berlaku satu kali.</p>` +
  btn("{{ .ConfirmationURL }}", "Masuk ke Dashboard") +
  divider +
  `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Atau gunakan kode OTP berikut:</p>` +
  `<div style="margin:12px 0 0;text-align:center;"><span style="display:inline-block;background-color:#f3f4f6;border:2px dashed #d1d5db;border-radius:10px;padding:12px 28px;font-size:28px;font-weight:700;color:#0B27BC;letter-spacing:6px;">{{ .Token }}</span></div>` +
  `</td></tr>` +
  footer("Jika Anda tidak meminta login, abaikan email ini.")
);

// ── API Routes ───────────────────────────────────────────────────────

const templates: Record<string, { html: string; subject: string }> = {
  invite: { html: inviteTemplate, subject: "Undangan Bergabung - Ikastara Kita" },
  confirmation: { html: confirmationTemplate, subject: "Konfirmasi Email - Ikastara Kita" },
  recovery: { html: recoveryTemplate, subject: "Atur Ulang Password - Ikastara Kita" },
  magic_link: { html: magicLinkTemplate, subject: "Masuk ke Ikastara Kita" },
};

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "invite";

  if (type === "all") {
    return NextResponse.json(templates);
  }

  // Return raw HTML for iframe preview
  if (type.endsWith("_html")) {
    const key = type.replace("_html", "");
    const t = templates[key];
    if (!t) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(t.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const template = templates[type];
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

// POST to apply templates via Supabase Management API
export async function POST(request: NextRequest) {
  const { access_token } = await request.json();

  if (!access_token) {
    return NextResponse.json(
      { error: "Supabase access_token required. Get it from https://supabase.com/dashboard/account/tokens" },
      { status: 400 }
    );
  }

  const payload = {
    MAILER_TEMPLATES_INVITE_CONTENT: templates.invite.html,
    MAILER_TEMPLATES_INVITE_SUBJECT: templates.invite.subject,
    MAILER_TEMPLATES_CONFIRMATION_CONTENT: templates.confirmation.html,
    MAILER_TEMPLATES_CONFIRMATION_SUBJECT: templates.confirmation.subject,
    MAILER_TEMPLATES_RECOVERY_CONTENT: templates.recovery.html,
    MAILER_TEMPLATES_RECOVERY_SUBJECT: templates.recovery.subject,
    MAILER_TEMPLATES_MAGIC_LINK_CONTENT: templates.magic_link.html,
    MAILER_TEMPLATES_MAGIC_LINK_SUBJECT: templates.magic_link.subject,
  };

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Supabase API error: ${err}` }, { status: res.status });
    }

    return NextResponse.json({ success: true, message: "All 4 email templates updated successfully" });
  } catch {
    return NextResponse.json({ error: "Failed to update templates" }, { status: 500 });
  }
}
