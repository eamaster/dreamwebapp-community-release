import { Section, SectionHeader } from '@/components/common/Section';
import { SolutionSection } from '@/components/solutions/SolutionSection';
import { useSolutions } from '@/hooks/useContent';

/**
 * Solutions Page
 * Niche-specific solutions for different industries.
 * Data is fetched from the Worker API with static fallback via placeholderData.
 */
export function SolutionsPage() {
    const { data: solutions = [] } = useSolutions();
    return (
        <>
            {/* Page Header */}
            <Section background="gradient" padding="md">
                <div className="text-center max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                        Solutions by <span className="gradient-text">Industry</span>
                    </h1>
                    <p className="text-xl text-slate-600">
                        Specialized AI automation tailored to your industry's unique challenges
                    </p>
                </div>
            </Section>

            {/* Solutions Sections */}
            {solutions.map((solution, index) => (
                <Section
                    key={solution.id}
                    id={solution.id}
                    background={index % 2 === 0 ? 'white' : 'gray'}
                >
                    <SolutionSection solution={solution} />
                </Section>
            ))}

            {/* CTA Section */}
            <Section background="gradient">
                <div className="text-center max-w-3xl mx-auto">
                    <SectionHeader
                        title="Don't See Your Industry?"
                        subtitle="We work with businesses across all sectors. Let's discuss your specific needs."
                    />
                    <a
                        href="/contact"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-gradient-to-r from-accent-600 to-accent-700 text-white hover:from-accent-700 hover:to-accent-800 shadow-lg shadow-accent-500/30 hover:shadow-xl hover:scale-105 transition-all duration-200"
                    >
                        Talk to Us About Your Business
                    </a>
                </div>
            </Section>
        </>
    );
}
