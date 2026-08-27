import { Section } from '@/components/common/Section';
import { useLegalPage } from '@/hooks/useContent';

interface LegalPageProps {
    id: 'privacy-policy' | 'terms-of-service';
    fallbackTitle: string;
}

/**
 * Renders a CMS-managed legal page. Body content is plain text (never raw
 * HTML) — paragraphs are derived from blank-line breaks so nothing is ever
 * injected via `dangerouslySetInnerHTML`.
 */
export function LegalPage({ id, fallbackTitle }: LegalPageProps) {
    const { data, isLoading } = useLegalPage(id);

    if (isLoading) {
        return (
            <Section padding="lg">
                <div className="max-w-3xl mx-auto text-center text-slate-500">Loading…</div>
            </Section>
        );
    }

    if (!data) {
        return (
            <Section padding="lg">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">{fallbackTitle}</h1>
                    <p className="text-slate-600">
                        This page hasn't been published yet. Please check back soon, or{' '}
                        <a href="/contact" className="text-brand-600 hover:underline">contact us</a> with any questions.
                    </p>
                </div>
            </Section>
        );
    }

    const paragraphs = data.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    return (
        <Section padding="lg">
            <article className="max-w-3xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{data.title}</h1>
                <p className="text-sm text-slate-500 mb-8">
                    Last updated: {new Date(data.updatedAt).toLocaleDateString()}
                </p>
                <div className="prose prose-slate max-w-none space-y-4">
                    {paragraphs.map((paragraph, i) => (
                        <p key={i} className="text-slate-700 leading-relaxed whitespace-pre-line">
                            {paragraph}
                        </p>
                    ))}
                </div>
            </article>
        </Section>
    );
}
