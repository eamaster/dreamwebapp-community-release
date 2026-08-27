import type { SocialPlatform } from '@/lib/api-client';

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
    'twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'github', 'other',
];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    github: 'GitHub',
    other: 'Link',
};

/** Controlled glyphs per platform — never renders admin-supplied markup. */
export const SOCIAL_PLATFORM_GLYPHS: Record<SocialPlatform, string> = {
    twitter: '𝕏',
    linkedin: 'in',
    facebook: 'f',
    instagram: 'IG',
    youtube: '▶',
    tiktok: '♪',
    github: 'GH',
    other: '🔗',
};

/** Accessible name for a social link: prefers an admin-set label, falls back to the platform name. */
export function getSocialAccessibleName(platform: SocialPlatform, label?: string): string {
    return label?.trim() || SOCIAL_PLATFORM_LABELS[platform];
}
