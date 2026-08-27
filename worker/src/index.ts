/**
 * Hono application entrypoint for Cloudflare Workers.
 *
 * Mounts:
 *   /api/v1/content/*          — public cached content (GET)
 *   /api/v1/contact            — lead capture (POST, rate-limited)
 *   /api/v1/chat               — narrow AI chatbot MVP (POST, rate-limited)
 *   /api/v1/admin/*            — CMS CRUD (JWT-protected)
 *   /api/v1/payments/*         — NOWPayments crypto checkout
 *   /api/v1/webhooks/*         — NOWPayments IPN handler
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './types/env';
import type { HonoVariables } from './middleware/auth';
import type { CustomerHonoVariables } from './middleware/customer-auth';
import { contentRouter } from './routes/content';
import { contactRouter } from './routes/contact';
import { adminRouter } from './routes/admin';
import { chatRouter } from './routes/chat';
import { paymentsRouter } from './routes/payments';
import { webhooksRouter } from './routes/webhooks';
import { customerAuthRouter } from './routes/customer-auth';
import { accountRouter } from './routes/account';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables & CustomerHonoVariables }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

// Request logger (development-friendly, low overhead in production)
app.use('*', logger());

// Security headers — disable default CORP in secureHeaders so it does not overwrite
// route-specific public asset policies after handler execution.
app.use('*', secureHeaders({ crossOriginResourcePolicy: false }));

// Fallback CORP middleware — applies 'same-origin' after downstream routes execute,
// ensuring strict protection for all APIs/auth/errors unless explicitly set by a public media route.
app.use('*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Cross-Origin-Resource-Policy')) {
        c.res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    }
});

// Pretty JSON in development
app.use('*', prettyJSON({ space: 2 }));

// CORS — parse comma-separated CORS_ORIGIN env var into an array so each
// origin is matched individually with credentials enabled for customer cookie auth.
// Disallowed origins receive no CORS authorization and no credentials header.
app.use('/api/*', async (c, next) => {
    const requestOrigin = c.req.header('Origin');
    const allowedOrigins = c.env.CORS_ORIGIN
        ? c.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
        : [];

    const isAllowed = Boolean(requestOrigin && allowedOrigins.includes(requestOrigin));

    if (c.req.method === 'OPTIONS') {
        if (isAllowed && requestOrigin) {
            c.header('Access-Control-Allow-Origin', requestOrigin);
            c.header('Access-Control-Allow-Credentials', 'true');
            c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
            c.header('Access-Control-Max-Age', '600');
            c.header('Vary', 'Origin, Access-Control-Request-Headers');
            return c.body(null, 204);
        }
        c.header('Vary', 'Origin');
        return c.body(null, 204);
    }

    await next();

    if (isAllowed && requestOrigin) {
        c.header('Access-Control-Allow-Origin', requestOrigin);
        c.header('Access-Control-Allow-Credentials', 'true');
        c.header('Access-Control-Expose-Headers', 'X-Cache-Hit, X-RateLimit-Limit, X-RateLimit-Remaining');
        c.header('Vary', 'Origin');
    } else if (requestOrigin) {
        c.header('Vary', 'Origin');
    }
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/', (c) =>
    c.json({
        name: 'DreamWebApp API',
        version: '1.0.0',
        status: 'ok',
        timestamp: new Date().toISOString(),
    })
);

app.get('/health', (c) =>
    c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ─── API Routes ───────────────────────────────────────────────────────────────

app.route('/api/v1/content', contentRouter);
app.route('/api/v1/contact', contactRouter);
app.route('/api/v1/admin', adminRouter);
app.route('/api/v1/chat', chatRouter);
app.route('/api/v1/payments', paymentsRouter);
app.route('/api/v1/webhooks', webhooksRouter);
app.route('/api/v1/auth', customerAuthRouter);
app.route('/api/v1/account', accountRouter);


// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.notFound((c) =>
    c.json({ error: `Route ${c.req.method} ${c.req.path} not found` }, 404)
);

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.onError((err, c) => {
    console.error('[unhandled error]', err);
    const isDev = c.env.ENVIRONMENT !== 'production';
    return c.json(
        {
            error: 'Internal server error',
            ...(isDev && { details: err.message, stack: err.stack }),
        },
        500
    );
});

export default app;
