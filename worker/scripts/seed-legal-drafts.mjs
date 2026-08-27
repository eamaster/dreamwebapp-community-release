#!/usr/bin/env node
/**
 * Generates a SQL file that seeds the `legal_pages` table with initial,
 * admin-editable DRAFT content for Privacy Policy and Terms of Service.
 *
 * This does NOT publish anything — both rows are written with
 * is_published = 0, exactly as they already are. An administrator must
 * review, fill in the bracketed placeholders (business name, jurisdiction,
 * retention period, privacy contact email), and publish via the CMS
 * (Admin Dashboard → Legal) before either page becomes publicly visible.
 *
 * This script does not talk to Cloudflare directly — it only writes a .sql
 * file (UTF-8, no BOM — required by `wrangler d1 execute --file`). Apply it
 * explicitly and deliberately, e.g.:
 *
 *   node worker/scripts/seed-legal-drafts.mjs worker/scripts/.legal-drafts.sql
 *   npx wrangler d1 execute dreamwebapp-db --remote --file=worker/scripts/.legal-drafts.sql
 *
 * (Run against the local dev DB first by omitting --remote, if desired.)
 */

import { writeFileSync } from 'node:fs';

function sqlString(value) {
    return `'${value.replace(/'/g, "''")}'`;
}

const privacyPolicyBody = `DreamWebApp respects your privacy. This Privacy Policy explains how we collect, use, disclose, retain, and protect personal information when you use our website or contact us about our AI chatbot and automation services.

1. Who we are
DreamWebApp is the controller or business responsible for personal information processed through this website. Before publishing, replace this sentence with our legal business name, business address where applicable, and privacy contact email: [privacy contact email].

2. Information we collect
We may collect information you provide directly, including your name, email address, business type, optional phone number, optional website address, and the message or goals you submit through our contact form. We may also process information you send in chat or correspondence when needed to respond to you. If you are an administrator, we process your administrator account email, authentication information, and security-related account activity.

3. How we use information
We use information to respond to enquiries, arrange demonstrations, provide or improve requested services, communicate with you, operate and secure our website and administrator area, prevent misuse, and process password-reset requests. We do not sell personal information.

4. Service providers and disclosures
We may use service providers that process information on our behalf to host and operate the website, database, security and content systems; deliver transactional email; and provide AI functionality where enabled. Before publishing, review this list and name the providers actually used, such as Cloudflare for website/Worker/database infrastructure, Resend for password-reset email if configured, and the configured AI provider for chatbot interactions. We may also disclose information where required by law or to protect rights, safety, or security.

5. Retention
We retain contact enquiries only for as long as necessary to respond, manage our relationship, meet legitimate business record-keeping needs, resolve disputes, or comply with law. Before publishing, set a real retention period that we can follow, for example: [contact enquiry retention period]. We delete or anonymize information when it is no longer needed, subject to legal obligations.

6. International processing
Our service providers may process information in countries other than the country where you live. Where required, we take appropriate steps under applicable law for international transfers.

7. Cookies and local storage
DreamWebApp does not use advertising or marketing cookies unless we tell you and obtain any consent required by law. We may use strictly necessary browser storage to maintain an authenticated administrator session. This storage is not used to track public visitors across unrelated websites. Before publishing, verify this statement against the deployed site and update it if analytics, pixels, embedded services, or other non-essential storage are added.

8. Security
We use reasonable technical and organisational measures designed to protect information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

9. Your choices and rights
Depending on your location, you may have rights to request access, correction, delete or object to certain processing of your personal information, or make a complaint to a relevant privacy authority. To make a request, contact us at [privacy contact email]. We may need to verify your identity before responding.

10. Changes
We may update this Privacy Policy from time to time. We will post the updated version on this page and update the "Last updated" date.`;

const termsOfServiceBody = `These Terms of Service govern your use of the DreamWebApp website. Before publishing, replace placeholders with the legal business name, contact details, and governing-law/jurisdiction information appropriate to the business.

1. Website and services
DreamWebApp provides information about AI chatbot and automation services. Any service scope, implementation work, pricing, deliverables, and support terms are subject to a separate written proposal, order, statement of work, or agreement where applicable.

2. Acceptable use
You may use this website for lawful purposes. You must not interfere with the website, attempt unauthorised access, submit malicious code, misuse forms or chat, infringe rights, or use the site in a manner that violates applicable law.

3. Enquiries and information
Information on this website is general and may change. Submitting an enquiry or requesting a demo does not create a service contract or guarantee availability, pricing, outcome, or response time.

4. Intellectual property
Unless stated otherwise, the website content, branding, design, and materials are owned by or licensed to DreamWebApp and may not be copied, reproduced, or used commercially without permission, except as permitted by law.

5. Third-party services
The website may rely on third-party infrastructure or link to third-party sites. DreamWebApp is not responsible for third-party content, availability, policies, or services.

6. Disclaimer
The website is provided on an "as available" basis to the extent permitted by law. DreamWebApp does not guarantee that the website will be uninterrupted, error-free, secure, or suitable for every purpose. Nothing in these Terms excludes rights that cannot be excluded under applicable law.

7. Limitation of liability
To the maximum extent permitted by law, DreamWebApp is not liable for indirect, incidental, special, consequential, or loss-of-profit damages arising from use of the website. Before publishing, have this clause reviewed and adapt it to the applicable legal entity, contract structure, and jurisdiction.

8. Changes and governing law
We may update these Terms by posting an updated version and changing the "Last updated" date. Before publishing, state the governing law and courts: [governing law and jurisdiction].

9. Contact
For questions about these Terms, contact: [legal contact email].`;

const statements = [
    `UPDATE legal_pages SET title = ${sqlString('Privacy Policy')}, body = ${sqlString(privacyPolicyBody)}, updated_at = datetime('now') WHERE id = 'privacy-policy';`,
    `UPDATE legal_pages SET title = ${sqlString('Terms of Service')}, body = ${sqlString(termsOfServiceBody)}, updated_at = datetime('now') WHERE id = 'terms-of-service';`,
];

const sql = statements.join('\n\n') + '\n';
const outPath = process.argv[2];

if (outPath) {
    writeFileSync(outPath, sql, { encoding: 'utf8' });
    console.log(`Wrote ${outPath}`);
} else {
    process.stdout.write(sql);
}
