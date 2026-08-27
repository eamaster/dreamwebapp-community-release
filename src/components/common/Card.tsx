import React from 'react';

export interface CardProps {
    id?: string;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
}

/**
 * Reusable Card component
 * Provides consistent styling for content containers
 */
export function Card({ id, className = '', hover = false, onClick, children }: CardProps) {
    const baseClasses = 'bg-white rounded-xl border border-slate-200 shadow-md p-6';
    const hoverClasses = hover
        ? 'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300'
        : 'transition-shadow duration-300';
    const clickableClasses = onClick ? 'cursor-pointer' : '';

    return (
        <div
            id={id}
            className={`${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
