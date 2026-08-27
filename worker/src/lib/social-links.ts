/**
 * Canonical social-link model, shared by the admin CRUD routes and the
 * public content routes. Social links live inside the existing
 * `site_settings.footer_json.socialLinks` column (no new table) — this
 * module normalizes whatever is currently stored (including the original
 * legacy `{ name, url, icon }` seed shape) into the canonical shape below on
 * every read, so both admin and public consumers always see a consistent
 * structure without requiring a data migration or an admin save first.
 */

export const SOCIAL_PLATFORMS = [
    'twitter',
    'linkedin',
    'facebook',
    'instagram',
    'youtube',
    'tiktok',
    'github',
    'other',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLinkData {
    id: string;
    platform: SocialPlatform;
    label?: string;
    url: string;
    enabled: boolean;
    sortOrder: number;
}

const LEGACY_NAME_TO_PLATFORM: Record<string, SocialPlatform> = {
    twitter: 'twitter',
    x: 'twitter',
    linkedin: 'linkedin',
    facebook: 'facebook',
    instagram: 'instagram',
    youtube: 'youtube',
    tiktok: 'tiktok',
    github: 'github',
};

function isSocialPlatform(value: unknown): value is SocialPlatform {
    return typeof value === 'string' && (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

/**
 * Normalizes an arbitrary stored array (legacy or already-canonical) into
 * `SocialLinkData[]`. Entries without a usable URL are dropped. Never
 * mutates the source — callers persist the canonical shape only when the
 * admin next saves site settings.
 */
export function normalizeSocialLinks(raw: unknown): SocialLinkData[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .map((item, index): SocialLinkData | null => {
            const obj = (item ?? {}) as Record<string, unknown>;

            if (isSocialPlatform(obj.platform)) {
                const url = typeof obj.url === 'string' ? obj.url : '';
                if (!url) return null;
                return {
                    id: typeof obj.id === 'string' && obj.id ? obj.id : `social-${index}`,
                    platform: obj.platform,
                    label: typeof obj.label === 'string' && obj.label ? obj.label : undefined,
                    url,
                    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
                    sortOrder: typeof obj.sortOrder === 'number' ? obj.sortOrder : index,
                };
            }

            // Legacy seed shape: { name, url, icon }
            const url = typeof obj.url === 'string' ? obj.url : '';
            if (!url) return null;
            const name = typeof obj.name === 'string' ? obj.name : '';
            const platform = LEGACY_NAME_TO_PLATFORM[name.trim().toLowerCase()] ?? 'other';
            return {
                id: `social-${index}`,
                platform,
                label: platform === 'other' && name ? name : undefined,
                url,
                enabled: true,
                sortOrder: index,
            };
        })
        .filter((link): link is SocialLinkData => link !== null)
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    github: 'GitHub',
    other: 'Other',
};
