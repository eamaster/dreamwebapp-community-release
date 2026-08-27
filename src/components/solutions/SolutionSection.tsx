import { Button } from '../common/Button';
import type { SolutionData } from '@/lib/api-client';

export interface SolutionSectionProps {
    solution: SolutionData;
}

/**
 * Solution Section component
 * Displays niche-specific pain points and benefits
 */
export function SolutionSection({ solution }: SolutionSectionProps) {
    return (
        <div id={solution.id} className="scroll-mt-20">
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
                {/* Left: Title and Description with Icon */}
                <div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="text-5xl">{solution.icon}</div>
                        <h3 className="text-3xl font-bold text-slate-900">{solution.title}</h3>
                    </div>
                    <p className="text-lg text-slate-600 mb-6">{solution.description}</p>

                    {/* Pain Points */}
                    <div className="mb-6">
                        <h4 className="text-lg font-semibold text-red-600 mb-4 flex items-center">
                            <span className="mr-2">⚠️</span>
                            Common Challenges
                        </h4>
                        <ul className="space-y-3">
                            {solution.pains.map((pain, index) => (
                                <li key={index} className="flex items-start text-slate-700">
                                    <span className="text-red-500 mr-3 mt-1 flex-shrink-0">✗</span>
                                    <span>{pain}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Right: Benefits and CTA */}
                <div className="bg-gradient-to-br from-brand-50 to-accent-50 rounded-2xl p-8 border border-brand-100">
                    <h4 className="text-lg font-semibold text-brand-700 mb-6 flex items-center">
                        <span className="mr-2">🚀</span>
                        How We Help
                    </h4>
                    <ul className="space-y-4 mb-8">
                        {solution.benefits.map((benefit, index) => (
                            <li key={index} className="flex items-start text-slate-800">
                                <span className="text-brand-600 mr-3 mt-1 flex-shrink-0 font-bold">✓</span>
                                <span className="leading-relaxed">{benefit}</span>
                            </li>
                        ))}
                    </ul>

                    <Button variant="accent" size="lg" fullWidth>
                        {solution.ctaText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
