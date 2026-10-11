export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { Resend } from 'resend';
import siteConfig from '@/config/site.config';

// Escape user-supplied values before they are interpolated into the
// notification email's HTML, so a message containing markup (links,
// tracking pixels, spoofed content) can't render in the recipient's inbox.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.email('Please enter a valid email address'),
  subject: z.string().max(200).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
  honeypot: z.string().max(0), // Anti-spam: must be empty
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    const data = {
      name: formData.get('name')?.toString() || '',
      email: formData.get('email')?.toString() || '',
      subject: formData.get('subject')?.toString() || '',
      message: formData.get('message')?.toString() || '',
      honeypot: formData.get('honeypot')?.toString() || '',
    };

    // Validate
    const result = contactSchema.safeParse(data);

    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const error of result.error.issues) {
        const field = error.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(error.message);
      }

      return new Response(
        JSON.stringify({ success: false, errors: fieldErrors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Honeypot check (bot detection)
    if (result.data.honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send email via Resend
    const apiKey = import.meta.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set');
      return new Response(
        JSON.stringify({ success: false, errors: { form: ['Email service is not configured'] } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(apiKey);

    const toEmail = siteConfig.email;
    const fromEmail = import.meta.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const siteLabel = siteConfig.name;

    const subject = result.data.subject
      ? `[${siteLabel}] ${result.data.subject}`
      : `[${siteLabel}] New contact from ${result.data.name}`;

    const logoUrl = 'https://edtec-lab-landing.vercel.app/android-chrome-192x192.png';
    const siteUrl = siteConfig.url || 'https://edtec-lab-landing.vercel.app';
    const sanitizedName = escapeHtml(result.data.name);
    const sanitizedEmail = escapeHtml(result.data.email);
    const sanitizedSubject = result.data.subject ? escapeHtml(result.data.subject) : 'Sin asunto especificado';
    const formattedMessage = escapeHtml(result.data.message).replace(/\n/g, '<br>');

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo mensaje desde EDTEC Lab</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f7; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #f97316 100%); padding: 36px 30px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="background-color: #ffffff; width: 68px; height: 68px; border-radius: 18px; padding: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(0,0,0,0.18);">
                      <img src="${logoUrl}" alt="EDTEC Lab UCAB" width="68" height="68" style="display: block; border-radius: 12px; object-fit: contain;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 14px;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">EDTEC Lab · UCAB</h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px; font-weight: 500;">Laboratorio de Educación Tecnológica</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subtitle badge -->
          <tr>
            <td style="padding: 24px 32px 10px 32px;">
              <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 9999px; border: 1px solid #bfdbfe;">
                Nuevo mensaje desde la web
              </span>
              <h2 style="margin: 12px 0 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                Detalles del contacto
              </h2>
            </td>
          </tr>

          <!-- Content Details Table -->
          <tr>
            <td style="padding: 10px 32px 24px 32px;">
              <table role="presentation" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; border-collapse: separate;" cellspacing="0" cellpadding="14">
                <tr>
                  <td width="30%" style="color: #64748b; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Remitente</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${sanitizedName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Correo</td>
                  <td style="border-bottom: 1px solid #e2e8f0;">
                    <a href="mailto:${sanitizedEmail}" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px;">${sanitizedEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; font-weight: 600;">Asunto</td>
                  <td style="color: #334155; font-size: 14px;">${sanitizedSubject}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 0 32px 30px 32px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">
                Mensaje recibido:
              </p>
              <div style="background-color: #ffffff; border-left: 4px solid #2563eb; padding: 18px; border-radius: 0 10px 10px 0; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px; line-height: 1.65;">
                ${formattedMessage}
              </div>
            </td>
          </tr>

          <!-- Reply Button CTA -->
          <tr>
            <td align="center" style="padding: 0 32px 36px 32px;">
              <a href="mailto:${sanitizedEmail}?subject=Re: ${sanitizedSubject}" style="display: inline-block; background-color: #1d4ed8; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.25);">
                Responder a ${sanitizedName}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Este correo fue generado automáticamente por el formulario en <a href="${siteUrl}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${siteConfig.name}</a>.
              </p>
              <p style="margin: 6px 0 0; font-size: 11px; color: #94a3b8;">
                Universidad Católica Andrés Bello · Caracas, Venezuela
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const { error } = await resend.emails.send({
      from: `EDTEC Lab Contact <${fromEmail}>`,
      to: toEmail,
      replyTo: result.data.email,
      subject,
      html: emailHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(
        JSON.stringify({ success: false, errors: { form: [error.message || 'Failed to send email'] } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Contact form error:', error);

    return new Response(
      JSON.stringify({ success: false, errors: { form: ['An unexpected error occurred'] } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
