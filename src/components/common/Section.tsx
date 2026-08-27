import React from 'react';

export interface SectionProps {
    id?: string;
    className?: string;
    background?: 'white' | 'gray' | 'gradient';
    padding?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

/**
 * Reusable Section wrapper component
 * Provides consistent spacing and background options
 */
export function Section({
    id,
    className = '',
    background = 'white',
    padding = 'md',
    children,
}: SectionProps) {
    const backgroundClasses = {
        white: 'bg-white',
        gray: 'bg-slate-50',
        gradient: 'bg-gradient-to-br from-brand-50 via-white to-accent-50',
    };

    const paddingClasses = {
        sm: 'py-12 md:py-16',
        md: 'py-16 md:py-20 lg:py-24',
        lg: 'py-20 md:py-28 lg:py-32',
    };

    return (
        <section
            id={id}
            className={`${backgroundClasses[background]} ${paddingClasses[padding]} ${className}`}
        >
            <div className="container-custom">
                {children}
            </div>
        </section>
    );
}

export interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    centered?: boolean;
    className?: string;
}

/**
 * Section Header component for consistent title formatting
 */
export function SectionHeader({
    title,
    subtitle,
    centered = true,
    className = '',
}: SectionHeaderProps) {
    return (
        <div className={`${centered ? 'text-center' : ''} mb-12 md:mb-16 ${className}`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                {title}
            </h2>
            {subtitle && (
                <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
                    {subtitle}
                </p>
            )}
        </div>
    );
}
