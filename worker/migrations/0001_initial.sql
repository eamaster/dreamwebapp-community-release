-- ============================================================
-- DreamWebApp D1 Migration: 0001_initial
-- Creates all tables and seeds them with the current static
-- content from the TypeScript content files.
-- ============================================================

-- ── 1. site_settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_settings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name      TEXT    NOT NULL,
    brand_tagline   TEXT    NOT NULL,
    brand_description TEXT  NOT NULL,
    contact_email   TEXT    NOT NULL,
    contact_phone   TEXT,
    navigation_json TEXT    NOT NULL,
    footer_json     TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO site_settings (brand_name, brand_tagline, brand_description, contact_email, contact_phone, navigation_json, footer_json) VALUES (
    'DreamWebApp',
    'AI Chatbots & Automation for Small Businesses',
    'Transform your customer experience with intelligent AI chatbots and automation services. Get 24/7 support, automated bookings, and more.',
    'hello@dreamwebapp.com',
    '+1 (555) 123-4567',
    '[{"label":"Home","path":"/"},{"label":"Services","path":"/services"},{"label":"Solutions","path":"/solutions"},{"label":"Pricing","path":"/pricing"},{"label":"About","path":"/about"},{"label":"Contact","path":"/contact"}]',
    '{"sections":[{"title":"Services","links":[{"label":"AI Website Chatbot","path":"/services#chatbot"},{"label":"Chatbot Care & Optimization","path":"/services#care"},{"label":"AI Receptionist","path":"/services#receptionist"},{"label":"Automation Add-ons","path":"/services#automation"}]},{"title":"Solutions","links":[{"label":"For Clinics","path":"/solutions#clinics"},{"label":"For Local Services","path":"/solutions#local-services"},{"label":"For Course Creators","path":"/solutions#course-creators"},{"label":"For Online Shops","path":"/solutions#online-shops"}]},{"title":"Company","links":[{"label":"About Us","path":"/about"},{"label":"Pricing","path":"/pricing"},{"label":"Contact","path":"/contact"}]}],"socialLinks":[{"name":"Twitter","url":"https://twitter.com/dreamwebapp","icon":"𝕏"},{"name":"LinkedIn","url":"https://linkedin.com/company/dreamwebapp","icon":"in"},{"name":"GitHub","url":"https://github.com/dreamwebapp","icon":"GH"}],"copyright":"© 2026 DreamWebApp. All rights reserved."}'
);

-- ── 2. services ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS services (
    id                  TEXT    PRIMARY KEY,
    name                TEXT    NOT NULL,
    short_description   TEXT    NOT NULL,
    long_description    TEXT    NOT NULL,
    icon                TEXT    NOT NULL,
    timeline            TEXT    NOT NULL,
    who_its_for_json    TEXT    NOT NULL,
    included_json       TEXT    NOT NULL,
    pricing_json        TEXT    NOT NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO services (id, name, short_description, long_description, icon, timeline, who_its_for_json, included_json, pricing_json, sort_order) VALUES
(
    'chatbot-setup',
    'AI Website Chatbot Setup',
    'Get a custom AI chatbot on your website in days',
    'Launch a powerful AI chatbot trained on your business data. Handle FAQs, capture leads, and provide 24/7 customer support automatically.',
    '🤖',
    '5-7 business days',
    '["Small businesses wanting to automate customer support","Service providers tired of answering the same questions","E-commerce stores looking to boost conversions","Any business missing leads outside business hours"]',
    '["Custom chatbot trained on your content","Seamless website integration","Lead capture & email collection","FAQ automation","Mobile-responsive design","Analytics dashboard"]',
    '{"type":"one-time","amount":997,"note":"One-time setup fee"}',
    0
),
(
    'chatbot-care',
    'AI Chatbot Care & Optimization',
    'Monthly maintenance, updates, and performance optimization',
    'Keep your chatbot running smoothly with ongoing hosting, monitoring, content updates, and performance improvements.',
    '⚙️',
    'Ongoing monthly service',
    '["Businesses with an existing AI chatbot","Companies wanting hands-off chatbot management","Organizations needing regular content updates","Teams looking to improve chatbot performance over time"]',
    '["Secure hosting & uptime monitoring","Monthly content & training updates","Performance analytics & reporting","Bug fixes & technical support","Conversation flow optimization","Priority email support"]',
    '{"type":"monthly","amount":197,"note":"Per month"}',
    1
),
(
    'ai-receptionist-clinics',
    'AI Receptionist for Clinics & Local Services',
    'Automated appointment booking and patient/client support',
    'Purpose-built AI receptionist for healthcare clinics, salons, spas, and local service businesses. Handles bookings, answers questions, and reduces no-shows.',
    '📅',
    '7-10 business days',
    '["Medical, dental, and therapy clinics","Salons, spas, and wellness centers","Pet grooming and veterinary services","Any appointment-based local business"]',
    '["Appointment scheduling automation","Service & pricing information","Insurance & payment FAQ handling","Patient/client intake forms","Reminder & follow-up messages","Calendar integration (Google/Outlook)"]',
    '{"type":"custom","note":"Starting at $1,497 setup + $297/mo"}',
    2
),
(
    'ai-receptionist-courses',
    'AI Receptionist for Course Creators',
    'Automated student support and course enrollment',
    'Specialized AI assistant for online course creators and educators. Answers course questions, handles enrollments, and supports students 24/7.',
    '🎓',
    '7-10 business days',
    '["Online course creators & educators","Coaching and mentorship programs","Training and certification providers","Membership communities"]',
    '["Course FAQ automation","Enrollment & pricing support","Student onboarding assistance","Learning platform integration","Payment & access troubleshooting","Community engagement support"]',
    '{"type":"custom","note":"Starting at $1,297 setup + $247/mo"}',
    3
),
(
    'automation-inbox',
    'Inbox & FAQ Automation',
    'Auto-respond to common emails and inquiries',
    'Automatically handle repetitive email inquiries, route complex questions to the right team, and provide instant responses to FAQs.',
    '📧',
    '5-7 business days',
    '["Businesses drowning in repetitive emails","Support teams wanting to focus on complex issues","Companies with high inquiry volume"]',
    '["Email automation setup","Smart inbox routing","Auto-response templates","FAQ knowledge base","Integration with Gmail/Outlook"]',
    '{"type":"one-time","amount":697,"note":"Setup fee (monthly hosting available)"}',
    4
),
(
    'automation-booking',
    'Appointment & Booking Automation',
    'Streamline scheduling and reduce no-shows',
    'Full-featured booking automation with calendar sync, automated reminders, rescheduling, and cancellation handling.',
    '🗓️',
    '7-10 business days',
    '["Service providers with appointment-based business","Consultants and professionals","Event organizers"]',
    '["Automated appointment booking","Calendar synchronization","Reminder & confirmation emails","Rescheduling & cancellation handling","Timezone management","No-show reduction features"]',
    '{"type":"one-time","amount":897,"note":"Setup fee + $97/mo management"}',
    5
);

-- ── 3. solutions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solutions (
    id              TEXT    PRIMARY KEY,
    title           TEXT    NOT NULL,
    icon            TEXT    NOT NULL,
    description     TEXT    NOT NULL,
    cta_text        TEXT    NOT NULL,
    pains_json      TEXT    NOT NULL,
    benefits_json   TEXT    NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO solutions (id, title, icon, description, cta_text, pains_json, benefits_json, sort_order) VALUES
(
    'clinics',
    'For Clinics & Healthcare',
    '🏥',
    'Reduce administrative burden and improve patient experience with AI-powered automation.',
    'Get Your AI Receptionist',
    '["Phone lines constantly busy with appointment requests and basic questions","Staff overwhelmed with repetitive inquiries about hours, insurance, and services","Missed appointments and no-shows hurting revenue","Patients frustrated waiting for responses outside office hours"]',
    '["Automate appointment booking and rescheduling 24/7","Instantly answer common questions about services, insurance, and office hours","Send automated reminders to reduce no-shows by up to 40%","Free up staff to focus on in-person patient care","Capture after-hours inquiries and convert them into appointments"]',
    0
),
(
    'local-services',
    'For Local Services',
    '💇',
    'Salons, spas, pet groomers, and local service businesses: never miss a booking again.',
    'Automate Your Bookings',
    '["Losing customers to competitors who offer online booking","Missing calls and potential bookings while serving clients","Spending too much time on phone scheduling instead of serving customers","Difficult to manage bookings across multiple team members"]',
    '["Let clients book services anytime, even when you''re busy","Automatically sync appointments across your team''s calendars","Answer service and pricing questions instantly","Send booking confirmations and reminders automatically","Increase bookings by 25-35% with 24/7 availability"]',
    1
),
(
    'course-creators',
    'For Course Creators',
    '🎓',
    'Scale your online course business without hiring a support team.',
    'Scale Your Course Business',
    '["Drowning in the same student questions over and over","Can''t scale because you spend all day answering emails","Students frustrated waiting hours or days for simple answers","Missing course sales because you can''t respond to inquiries fast enough"]',
    '["Instantly answer common student questions about course content, enrollment, and access","Automate course enrollment and payment FAQs","Support students 24/7 across all time zones","Free yourself to focus on creating content and teaching","Convert more course inquiries into enrollments with instant responses"]',
    2
),
(
    'online-shops',
    'For Online Shops',
    '🛒',
    'Boost sales and reduce cart abandonment with intelligent automation.',
    'Boost Your Sales',
    '["High cart abandonment rates—customers leave with questions unanswered","Can''t afford 24/7 customer support team","Losing sales to competitors with better support","Overwhelmed by shipping, return, and product questions"]',
    '["Answer product questions instantly to close more sales","Recover abandoned carts with automated follow-up","Handle shipping, returns, and order tracking automatically","Provide 24/7 support without hiring night shift staff","Increase conversion rates by 15-25% with instant assistance"]',
    3
);

-- ── 4. pricing_plans ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_plans (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    description     TEXT    NOT NULL,
    monthly_price   REAL    NOT NULL DEFAULT 0,
    setup_fee       REAL,
    best_for        TEXT    NOT NULL,
    cta_text        TEXT    NOT NULL,
    badge           TEXT,
    is_highlighted  INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    features_json   TEXT    NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pricing_plans (id, name, description, monthly_price, setup_fee, best_for, cta_text, badge, is_highlighted, features_json, sort_order) VALUES
(
    'starter-bot',
    'Starter Bot',
    'Perfect for small businesses getting started with AI automation',
    0,
    997,
    'Small businesses with basic FAQ and lead capture needs',
    'Get Started',
    NULL,
    0,
    '["Custom AI chatbot trained on your content","Website integration & setup","FAQ automation (up to 50 Q&As)","Lead capture & email collection","Basic analytics dashboard","Email support","Monthly content updates (self-service)"]',
    0
),
(
    'growth-bot',
    'Growth Bot + Care',
    'Full-service chatbot with ongoing optimization and support',
    197,
    997,
    'Growing businesses wanting hands-off chatbot management',
    'Most Popular',
    'RECOMMENDED',
    1,
    '["Everything in Starter Bot","Secure hosting & uptime monitoring","Monthly content & training updates","Advanced analytics & reporting","Conversation flow optimization","Priority email support","Performance improvement recommendations","Quarterly strategy calls"]',
    1
),
(
    'pro-automation',
    'Pro Automation Suite',
    'Complete automation ecosystem with AI receptionist & workflows',
    497,
    1997,
    'Established businesses ready to fully automate customer interactions',
    'Go Pro',
    NULL,
    0,
    '["Everything in Growth Bot + Care","AI Receptionist with appointment booking","Advanced automation workflows","Multi-channel support (chat, email, SMS)","CRM & calendar integration","Custom integrations & API access","Dedicated account manager","White-glove onboarding","Monthly optimization sessions","Priority phone & chat support"]',
    2
);

-- ── 5. pricing_addons ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_addons (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL,
    price       REAL    NOT NULL,
    price_type  TEXT    NOT NULL CHECK (price_type IN ('one-time', 'monthly')),
    is_active   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pricing_addons (id, name, description, price, price_type, sort_order) VALUES
('inbox-automation',  'Inbox & FAQ Automation',          'Auto-respond to emails and route complex questions',           697,  'one-time', 0),
('booking-automation','Appointment Booking Automation',   'Full booking system with reminders and calendar sync',         897,  'one-time', 1),
('multilingual',      'Multilingual Support',             'Support for additional languages (per language)',              97,   'monthly',  2),
('custom-integration','Custom Integration',               'Connect to your existing tools and systems',                   497,  'one-time', 3);

-- ── 6. faqs ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS faqs (
    id          TEXT    PRIMARY KEY,
    question    TEXT    NOT NULL,
    answer      TEXT    NOT NULL,
    category    TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO faqs (id, question, answer, category, sort_order) VALUES
('setup-time',    'How long does it take to set up a chatbot?',           'Most chatbot setups are completed within 5-7 business days. This includes training the AI on your content, designing the conversation flows, integrating with your website, and thorough testing. More complex integrations like AI Receptionists may take 7-10 business days.',                                                                                                    'Setup',      0),
('pricing-model', 'What''s included in the setup fee vs. monthly fee?',   'The setup fee covers initial chatbot creation, training, website integration, and configuration. Monthly fees (where applicable) cover hosting, ongoing optimization, content updates, monitoring, and support. You can choose a one-time setup with self-management, or add our Care & Optimization service for hands-off maintenance.',                                               'Pricing',    1),
('content-updates','Can I update the chatbot content myself?',            'Yes! With the Starter Bot, you can make content updates yourself through our easy-to-use dashboard. If you prefer a hands-off approach, our Growth Bot + Care and Pro Automation plans include monthly professional updates and optimization by our team.',                                                                                                                         'Management', 2),
('integration',   'What platforms and tools do you integrate with?',      'We integrate with most popular platforms including WordPress, Shopify, Wix, Squarespace, Webflow, and custom websites. We can also connect to Google Calendar, Outlook, CRM systems (HubSpot, Salesforce, etc.), email platforms, and booking systems. Custom integrations are available for Pro plans.',                                                                             'Technical',  3),
('training-data', 'What information do you need from me to train the chatbot?', 'We''ll need access to your website content, FAQs, service descriptions, pricing information, and any other documentation about your business. We''ll guide you through a simple onboarding process to gather everything needed. Most clients complete this in under an hour.',                                                                                            'Setup',      4),
('support',       'What kind of support do you provide?',                 'All plans include email support with responses within 24 hours. Growth Bot + Care includes priority email support. Pro Automation includes a dedicated account manager with priority phone and chat support. We''re here to ensure your chatbot delivers excellent results.',                                                                                                       'Support',    5),
('crypto-payment','Do you accept cryptocurrency payments?',               'Yes! We accept major cryptocurrencies including Bitcoin, Ethereum, and USDC in addition to traditional credit card payments. Crypto payments are processed securely through our payment partners, and you''ll receive the same service regardless of payment method.',                                                                                                               'Pricing',    6),
('security',      'How secure is the chatbot and customer data?',         'Security is our top priority. All data is encrypted in transit and at rest. We use enterprise-grade infrastructure hosted on Cloudflare''s global network for maximum speed and security. We''re compliant with GDPR and CCPA, and we never sell or share your customer data.',                                                                                                     'Technical',  7),
('refund-policy', 'What''s your refund policy?',                         'We offer a 30-day satisfaction guarantee. If you''re not happy with your chatbot within the first 30 days after launch, we''ll refund your setup fee minus any custom integration work. Monthly subscriptions can be cancelled anytime with no cancellation fees.',                                                                                                                  'Pricing',    8),
('scaling',       'Can I upgrade or downgrade my plan later?',            'Absolutely! You can upgrade to a higher plan anytime. If you start with the Starter Bot and want to add our Care & Optimization service later, we''ll prorate your first month. Downgrading is available at the end of your current billing period.',                                                                                                                             'Management', 9),
('languages',     'Can the chatbot support multiple languages?',          'Yes! Our chatbots can be trained to support multiple languages. The base setup includes one language, and additional languages can be added for $97/month per language. This is perfect for businesses serving diverse customer bases.',                                                                                                                                              'Technical',  10),
('leads',         'How does lead capture work?',                          'Our chatbots can collect contact information naturally during conversations. You can set up custom forms, email capture, phone number collection, and qualification questions. All leads are stored in your dashboard and can be exported or integrated directly into your CRM.',                                                                                                     'Features',   11);

-- ── 7. contact_messages ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contact_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL,
    business_type   TEXT    NOT NULL,
    website         TEXT,
    message         TEXT    NOT NULL,
    ip_address      TEXT,
    status          TEXT    NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- ── 8. admin_users ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    role            TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('super_admin', 'editor')),
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login_at   TEXT
);

-- NOTE: To create the first admin user, run this Worker script once:
--
--   import { hashPassword } from './src/middleware/auth';
--   const hash = await hashPassword('your-secure-password');
--   // Then INSERT INTO admin_users (email, password_hash, role) VALUES ('admin@dreamwebapp.com', hash, 'super_admin');
--
-- Or use the Wrangler CLI:
--   npx wrangler d1 execute dreamwebapp-db --command="INSERT INTO admin_users ..."
