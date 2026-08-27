/**
 * Minimal transactional email adapter — Resend only, outbound-only.
 *
 * Deliberately narrow: this is the single supported provider for the admin
 * password-reset flow (see release scope). No provider-selection UI, no
 * second vendor, no inbound handling. Uses the Resend REST API directly via
 * `fetch` so no additional npm dependency is required.
 */

import type { Env } from '../types/env';

export type EmailSendResult =
    | { ok: true }
    | { ok: false; reason: 'not_configured' | 'send_failed' };

/** True once both required Resend secrets are present on this environment. */
export function isEmailProviderConfigured(env: Env): boolean {
    return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

/**
 * Sends the admin password-reset email. Never logs the reset URL, token, or
 * recipient — only a boolean/typed failure reason is returned to the caller.
 */
export async function sendPasswordResetEmail(
    env: Env,
    to: string,
    resetUrl: string
): Promise<EmailSendResult> {
    if (!isEmailProviderConfigured(env)) {
        return { ok: false, reason: 'not_configured' };
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM_EMAIL,
                to,
                subject: 'Reset your DreamWebApp admin password',
                html: renderResetEmailHtml(resetUrl),
            }),
        });

        if (!res.ok) {
            console.error('[email-provider] Resend API returned a non-OK status', res.status);
            return { ok: false, reason: 'send_failed' };
        }

        return { ok: true };
    } catch (err) {
        console.error('[email-provider] Failed to send password reset email:', err instanceof Error ? err.message : 'Unknown error');
        return { ok: false, reason: 'send_failed' };
    }
}

function renderResetEmailHtml(resetUrl: string): string {
    return `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
            <p>We received a request to reset the password for your DreamWebApp admin account.</p>
            <p>
                <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
                    Reset your password
                </a>
            </p>
            <p>This link expires in 30 minutes and can only be used once.</p>
            <p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
        </div>
    `.trim();
}

/**
 * Sends the admin-email-change verification link to the NEW address only —
 * never to the current one. Same fail-closed/non-logging contract as
 * `sendPasswordResetEmail`.
 */
export async function sendEmailChangeVerificationEmail(
    env: Env,
    to: string,
    verifyUrl: string
): Promise<EmailSendResult> {
    if (!isEmailProviderConfigured(env)) {
        return { ok: false, reason: 'not_configured' };
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM_EMAIL,
                to,
                subject: 'Confirm your new DreamWebApp admin email',
                html: renderEmailChangeHtml(verifyUrl),
            }),
        });

        if (!res.ok) {
            console.error('[email-provider] Resend API returned a non-OK status', res.status);
            return { ok: false, reason: 'send_failed' };
        }

        return { ok: true };
    } catch (err) {
        console.error('[email-provider] Failed to send email-change verification:', err instanceof Error ? err.message : 'Unknown error');
        return { ok: false, reason: 'send_failed' };
    }
}

function renderEmailChangeHtml(verifyUrl: string): string {
    return `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
            <p>Someone requested to change the DreamWebApp admin login email to this address.</p>
            <p>
                <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
                    Confirm this email address
                </a>
            </p>
            <p>This link expires in 30 minutes, can only be used once, and requires the requester to have already
               authenticated with the current admin password.</p>
            <p>If you didn't expect this, no change has been made yet — you can safely ignore this email.</p>
        </div>
    `.trim();
}

/**
 * Sends customer account email verification link.
 * Same safe non-logging and fail-closed contract as other email actions.
 */
export async function sendCustomerVerificationEmail(
    env: Env,
    to: string,
    verifyUrl: string
): Promise<EmailSendResult> {
    if (!isEmailProviderConfigured(env)) {
        return { ok: false, reason: 'not_configured' };
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM_EMAIL,
                to,
                subject: 'Verify your DreamWebApp account email',
                html: renderCustomerVerificationEmailHtml(verifyUrl),
            }),
        });

        if (!res.ok) {
            console.error('[email-provider] Resend API returned a non-OK status for customer verification', res.status);
            return { ok: false, reason: 'send_failed' };
        }

        return { ok: true };
    } catch (err) {
        console.error('[email-provider] Failed to send customer verification email:', err instanceof Error ? err.message : 'Unknown error');
        return { ok: false, reason: 'send_failed' };
    }
}

function renderCustomerVerificationEmailHtml(verifyUrl: string): string {
    return `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b; line-height: 1.5;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">Verify your DreamWebApp account</h2>
            <p>Thank you for signing up for DreamWebApp! Please verify your email address by clicking the button below:</p>
            <p style="margin: 24px 0;">
                <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                    Verify Email Address
                </a>
            </p>
            <p style="font-size: 13px; color: #64748b;">
                This link will expire in 24 hours and can only be used once. If you did not create a DreamWebApp account, you can safely disregard this message.
            </p>
        </div>
    `.trim();
}
