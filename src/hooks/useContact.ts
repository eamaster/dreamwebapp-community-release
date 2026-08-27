/**
 * React Query mutation hook for the contact form submission.
 *
 * Wraps submitContact() with proper typed error handling.
 * The mutation result exposes isPending, isError, isSuccess and
 * error.fields so the form can display per-field API validation errors.
 */

import { useMutation } from '@tanstack/react-query';
import { submitContact, type ContactPayload, type ContactResponse, type ApiError } from '@/lib/api-client';

export interface UseContactResult {
    submit: (data: ContactPayload) => void;
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    /** The server's success message (e.g. "We'll be in touch within 24 hours.") */
    successMessage?: string;
    /** Top-level error message */
    errorMessage?: string;
    /** Per-field validation errors returned by the API (e.g. { email: ['Invalid email'] }) */
    fieldErrors?: Record<string, string[]>;
    reset: () => void;
}

export function useContact(): UseContactResult {
    const mutation = useMutation<ContactResponse, ApiError, ContactPayload>({
        mutationFn: submitContact,
    });

    return {
        submit: mutation.mutate,
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        isError: mutation.isError,
        successMessage: mutation.data?.message,
        errorMessage: mutation.error?.message,
        fieldErrors: mutation.error?.fields,
        reset: mutation.reset,
    };
}
