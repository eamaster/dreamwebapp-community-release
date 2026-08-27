import type { SocialPlatform } from '@/lib/api-client';
import { SOCIAL_PLATFORM_GLYPHS } from '@/lib/social';

export function SocialIcon({ platform }: { platform: SocialPlatform }) {
    return <span className="text-sm font-bold" aria-hidden="true">{SOCIAL_PLATFORM_GLYPHS[platform]}</span>;
}
