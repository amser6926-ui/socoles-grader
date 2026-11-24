import nodemailer from 'nodemailer';

export type InviteEmailPayload = {
    to: string;
    name: string;
    link: string;
    className: string;
    fromOverride?: string;
};

function getTransport() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
    if (!host || !port) return null;
    // If user and pass are both set (not empty), use auth; otherwise, omit auth for passwordless SMTP
    const transportConfig: any = { host, port, secure };
    if (user && pass) {
        transportConfig.auth = { user, pass };
    }
    return nodemailer.createTransport(transportConfig);
}

export async function sendInviteEmail({ to, name, link, className, fromOverride }: InviteEmailPayload): Promise<{ sent: boolean; id?: string; error?: string }> {
    const from = fromOverride || process.env.SMTP_FROM || 'no-reply@socoles.local';
    const transporter = getTransport();
    const subject = `Приглашение в курс «${className}» на SOCOLES`;
    const greeting = name ? `Здравствуйте, ${name}!` : 'Здравствуйте!';
    const html = `
        <div lang="ru" style="font-family:system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans', Helvetica, Arial, sans-serif; line-height:1.5;">
            <h2>${greeting}</h2>
            <p>Преподаватель приглашает вас в курс <b>${className}</b> на SOCOLES.</p>
            <p><a href="${link}" style="display:inline-block;background:#1976d2;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">Принять приглашение</a></p>
            <p>Если кнопка не открывается, скопируйте ссылку в браузер:</p>
            <p><a href="${link}">${link}</a></p>
        </div>
    `;
    const text = `${greeting}\n\nПреподаватель приглашает вас в курс «${className}» на SOCOLES.\n\nОткройте ссылку, чтобы принять приглашение: ${link}`;

    if (!transporter) {
        console.log('[email] SMTP not configured; would send invite:', { to, subject, link });
        return { sent: false, error: 'SMTP not configured' };
    }
    try {
        const info = await transporter.sendMail({ from, to, subject, html, text });
        return { sent: true, id: info.messageId };
    } catch (e: any) {
        return { sent: false, error: e?.message || 'send failed' };
    }
}
