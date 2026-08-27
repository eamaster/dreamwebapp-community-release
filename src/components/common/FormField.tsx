import { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export interface FormFieldProps {
    label: string;
    name: string;
    /**
     * DOM id for the field/label pair. Defaults to `name`. Pass a unique
     * value when the same form (e.g. ContactForm) can be mounted more than
     * once in the document at the same time — e.g. the chat widget's inline
     * handoff form alongside the standalone contact page — so ids never
     * collide and each label stays correctly associated with its input.
     */
    id?: string;
    error?: string;
    required?: boolean;
    type?: 'text' | 'email' | 'tel' | 'url' | 'password' | 'textarea' | 'select';
    options?: { value: string; label: string }[];
    inputProps?: InputProps | TextareaProps | SelectProps;
    /** Optional non-error guidance shown below the field (hidden once an error is present). */
    helperText?: string;
}

/**
 * Reusable form field component
 * Handles input, textarea, and select elements with consistent styling
 */
export function FormField({
    label,
    name,
    id,
    error,
    required = false,
    type = 'text',
    options = [],
    inputProps = {},
    helperText,
}: FormFieldProps) {
    const fieldId = id ?? name;
    const baseInputClasses = 'w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2';
    const normalClasses = 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20';
    const errorClasses = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';
    const inputClasses = `${baseInputClasses} ${error ? errorClasses : normalClasses}`;

    return (
        <div className="mb-6">
            <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-700 mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {type === 'textarea' ? (
                <textarea
                    id={fieldId}
                    name={name}
                    className={inputClasses}
                    rows={5}
                    required={required}
                    {...(inputProps as TextareaProps)}
                />
            ) : type === 'select' ? (
                <select
                    id={fieldId}
                    name={name}
                    className={inputClasses}
                    required={required}
                    {...(inputProps as SelectProps)}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    id={fieldId}
                    name={name}
                    className={inputClasses}
                    required={required}
                    {...(inputProps as InputProps)}
                />
            )}

            {error ? (
                <p className="mt-2 text-sm text-red-600 flex items-center animate-slide-down">
                    <span className="mr-1">⚠</span>
                    {error}
                </p>
            ) : helperText ? (
                <p className="mt-2 text-xs text-slate-500">{helperText}</p>
            ) : null}
        </div>
    );
}
