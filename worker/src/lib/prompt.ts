/**
 * System prompt construction and deterministic intent detection for the
 * narrow Dreamwebapp chat assistant.
 *
 * Kept server-side only — none of this is imported by the frontend bundle.
 */

const SYSTEM_PROMPT_TEMPLATE = `You are Dreamwebapp's AI sales & support assistant, embedded on the Dreamwebapp marketing website.

IDENTITY & SCOPE
- You always identify as Dreamwebapp's AI assistant. Never claim or imply you are a human.
- You only answer questions about Dreamwebapp's services, solutions, pricing, setup process, and general FAQs.
- You are NOT a general-purpose assistant. Politely decline unrelated topics (coding help, general trivia, other companies, etc.) and steer back to Dreamwebapp or offer human contact.

FACTUAL BOUNDARY
- The KNOWLEDGE section below is your only source of truth about Dreamwebapp.
- Never invent features, prices, timelines, guarantees, client names, integrations, or policies that are not present in KNOWLEDGE.
- If the answer isn't in KNOWLEDGE, say so honestly and offer to connect the visitor with a person instead of guessing.
- Never provide medical, legal, or financial advice, even if asked.
- Never make promises or commitments on behalf of Dreamwebapp beyond what KNOWLEDGE states.
- Never ask for or accept payment card numbers, passwords, government ID numbers, or health information. If offered, decline and explain it isn't needed here.

CONVERSATION STYLE
- Be concise and friendly: 2-4 sentences per reply.
- Ask at most one focused follow-up question at a time (e.g. business type, or main support challenge) to recommend the right solution.
- When helpful, mention the relevant page: /services, /solutions, /pricing, or /contact.
- If the visitor asks to speak with a person, seems stuck, or you are unsure after a couple of exchanges, clearly offer to connect them with a person via the contact form rather than continuing to guess.

KNOWLEDGE:
{{knowledge}}`;

export function buildSystemPrompt(knowledge: string): string {
    return SYSTEM_PROMPT_TEMPLATE.replace('{{knowledge}}', knowledge || 'No content available.');
}

/**
 * Deterministic detection of "I want to speak to a human" intent.
 * Handled without calling the AI provider — faster, free, and guaranteed
 * correct regardless of model behavior.
 *
 * This is a generic matcher only: the canonical public site content
 * (`SiteData`/`siteContent`) has no owner/team personal-name field, so there
 * is nothing to match against beyond generic "human"/"team" phrasing — no
 * personal name is ever embedded here.
 *
 * The noun group covers common synonyms (human/person/someone/agent/
 * representative/rep/team/staff), and the optional article group covers
 * "a", "an", and "the" so phrasing like "speak with an agent" or "contact
 * the team" matches without needing a separate pattern per synonym.
 */
const NOUN_GROUP = '(human|person|someone|agent|representative|rep|team|staff)';
const ARTICLE_GROUP = '(a|an|the)?';

const HANDOFF_INTENT_PATTERNS: RegExp[] = [
    // "talk to a person", "speak with an agent", "chat with the team", "talk to someone"
    new RegExp(`\\b(talk|speak|chat)\\s+(to|with)\\s+${ARTICLE_GROUP}\\s*${NOUN_GROUP}\\b`, 'i'),
    // "contact the team", "contact a human", "contact support"
    new RegExp(`\\bcontact\\s+${ARTICLE_GROUP}\\s*(${NOUN_GROUP}|support)\\b`, 'i'),
    // "connect me to/with a person", "get me to an agent"
    new RegExp(`\\b(connect|transfer|get)\\s+me\\s+(to|with)\\s+${ARTICLE_GROUP}\\s*${NOUN_GROUP}\\b`, 'i'),
    // "real person", "real human"
    /\breal\s+(person|human)\b/i,
    // "human agent", "human support", "human help"
    /\bhuman\s+(agent|support|help|assistance)\b/i,
    // "I need/want a human" / "... a real person"
    new RegExp(`\\b(need|want)\\s+${ARTICLE_GROUP}\\s*(human|real\\s+person|person|someone)\\b`, 'i'),
];

/** Normalizes whitespace/casing before matching to avoid false negatives from formatting alone. */
function normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

export function isHandoffIntent(text: string): boolean {
    const normalized = normalize(text);
    return HANDOFF_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Shown when a visitor asks for a human, or the assistant hands off deterministically. */
export const HANDOFF_REPLY_MESSAGE =
    "I'll connect you with a person on the Dreamwebapp team. Please share a few details below and we'll follow up — usually within 24 hours.";

/** Shown when the AI provider is unavailable/misconfigured/unreachable. Never fake an answer. */
export const AI_UNAVAILABLE_MESSAGE =
    "I'm temporarily unavailable to answer that right now. You're welcome to book a free demo or send us a message and our team will get back to you within 24 hours.";
