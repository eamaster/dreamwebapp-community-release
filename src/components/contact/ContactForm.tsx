import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '../common/FormField';
import { Button } from '../common/Button';
import { CountryPhoneInput } from '../admin/CountryPhoneInput';
import { validateEmail, validateRequired, validateUrl } from '@/lib/validation';
import { useContact } from '@/hooks/useContact';
import { useSite } from '@/hooks/useContent';

export interface ContactFormData {
    name: string;
    email: string;
    businessType: string;
    website: string;
    /** Canonically E.164 once valid, or the raw in-progress value while typing. Empty string when omitted. */
    phone: string;
    message: string;
}

export interface ContactFormProps {
    /** Pre-fills the message field (e.g. an editable chat conversation summary). */
    initialMessage?: string;
    /** Where this lead originated. Defaults to the standalone contact page. */
    source?: 'contact_page' | 'chatbot';
    /** Overrides the default submit button label. */
    submitLabel?: string;
    /** Called after a successful submission (in addition to the built-in success message). */
    onSuccess?: () => void;
    /**
     * Prefixes every field id/label association. The chat widget's inline
     * handoff form can be mounted at the same time as the standalone contact
     * page's form (the chat panel is always in the DOM); a distinct prefix
     * keeps every id unique so labels stay correctly associated and focus
     * management can target the right instance.
     */
    idPrefix?: string;
}

/**
 * Contact Form component
 * Handles demo request and contact submissions.
 * Uses the useContact mutation hook which POSTs to POST /api/v1/contact.
 *
 * Also reused by the chat widget's "Talk to a person" handoff (source='chatbot'),
 * so the same validation, mutation, and confirmation UX apply to both entry points.
 */
export function ContactForm({ initialMessage = '', source = 'contact_page', submitLabel, onSuccess, idPrefix = '' }: ContactFormProps = {}) {
    const [formData, setFormData] = useState<ContactFormData>({
        name: '',
        email: '',
        businessType: '',
        website: '',
        phone: '',
        message: initialMessage,
    });
    const [phoneValid, setPhoneValid] = useState(true);

    const [clientErrors, setClientErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});

    const { submit, isPending, isSuccess, isError, successMessage, errorMessage, fieldErrors, reset } =
        useContact();

    const { data: site } = useSite();
    const brandName = site?.brand.name ?? 'DreamWebApp';

    const hasNotifiedSuccess = useRef(false);
    useEffect(() => {
        if (isSuccess && !hasNotifiedSuccess.current) {
            hasNotifiedSuccess.current = true;
            onSuccess?.();
        }
        if (!isSuccess) {
            hasNotifiedSuccess.current = false;
        }
    }, [isSuccess, onSuccess]);

    const businessTypes = [
        { value: '', label: 'Select your business type' },
        { value: 'clinic', label: 'Clinic / Healthcare' },
        { value: 'local-service', label: 'Local Service (Salon, Spa, etc.)' },
        { value: 'course-creator', label: 'Course Creator / Educator' },
        { value: 'online-shop', label: 'Online Shop / E-commerce' },
        { value: 'other', label: 'Other' },
    ];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear local error when user starts typing
        if (clientErrors[name as keyof ContactFormData]) {
            setClientErrors(prev => ({ ...prev, [name]: undefined }));
        }
        // Also reset any server-side mutation error so the form feels responsive
        if (isError) reset();
    };

    /** Client-side validation before hitting the API */
    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof ContactFormData, string>> = {};

        const nameValidation = validateRequired(formData.name, 'Name');
        if (!nameValidation.isValid) newErrors.name = nameValidation.error;

        const emailValidation = validateEmail(formData.email);
        if (!emailValidation.isValid) newErrors.email = emailValidation.error;

        const businessTypeValidation = validateRequired(formData.businessType, 'Business type');
        if (!businessTypeValidation.isValid) newErrors.businessType = businessTypeValidation.error;

        if (formData.website) {
            const websiteValidation = validateUrl(formData.website);
            if (!websiteValidation.isValid) newErrors.website = websiteValidation.error;
        }

        if (formData.phone && !phoneValid) {
            newErrors.phone = 'Please enter a valid phone number, including country code';
        }

        const messageValidation = validateRequired(formData.message, 'Message');
        if (!messageValidation.isValid) newErrors.message = messageValidation.error;

        setClientErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        submit({
            name: formData.name,
            email: formData.email,
            businessType: formData.businessType,
            website: formData.website || undefined,
            phone: (formData.phone && phoneValid) ? formData.phone : undefined,
            message: formData.message,
            source,
        });

        // Clear form on success (after state update)
        if (isSuccess) {
            setFormData({ name: '', email: '', businessType: '', website: '', phone: '', message: '' });
        }
    };

    // Merge client-side and server-side field errors (client takes precedence)
    const errors: Partial<Record<keyof ContactFormData, string>> = {
        name:         clientErrors.name         ?? fieldErrors?.['name']?.[0],
        email:        clientErrors.email        ?? fieldErrors?.['email']?.[0],
        businessType: clientErrors.businessType ?? fieldErrors?.['businessType']?.[0],
        website:      clientErrors.website      ?? fieldErrors?.['website']?.[0],
        phone:        clientErrors.phone        ?? fieldErrors?.['phone']?.[0],
        message:      clientErrors.message      ?? fieldErrors?.['message']?.[0],
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
                label="Your Name"
                name="name"
                id={`${idPrefix}name`}
                type="text"
                required
                error={errors.name}
                inputProps={{
                    value: formData.name,
                    onChange: handleChange,
                    placeholder: 'John Smith',
                }}
            />

            <FormField
                label="Email Address"
                name="email"
                id={`${idPrefix}email`}
                type="email"
                required
                error={errors.email}
                inputProps={{
                    value: formData.email,
                    onChange: handleChange,
                    placeholder: 'john@example.com',
                }}
            />

            <FormField
                label="Business Type"
                name="businessType"
                id={`${idPrefix}businessType`}
                type="select"
                required
                error={errors.businessType}
                options={businessTypes}
                inputProps={{
                    value: formData.businessType,
                    onChange: handleChange,
                }}
            />

            <FormField
                label="Website URL (optional)"
                name="website"
                id={`${idPrefix}website`}
                type="url"
                error={errors.website}
                inputProps={{
                    value: formData.website,
                    onChange: handleChange,
                    placeholder: 'www.yoursite.com',
                }}
                helperText="Helps us understand your business ahead of a demo."
            />

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Phone Number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <CountryPhoneInput
                    variant="light"
                    idPrefix={idPrefix}
                    value={formData.phone || null}
                    onChange={(e164) => setFormData(prev => ({ ...prev, phone: e164 ?? '' }))}
                    onValidityChange={setPhoneValid}
                />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                <p className="mt-1 text-xs text-slate-500">If you'd rather we call you back, add a number with country code.</p>
            </div>

            <FormField
                label="Tell us about your goals"
                name="message"
                id={`${idPrefix}message`}
                type="textarea"
                required
                error={errors.message}
                inputProps={{
                    value: formData.message,
                    onChange: handleChange,
                    placeholder: 'What are you looking to achieve with AI chatbots and automation?',
                }}
            />

            {/* Success State */}
            {isSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 animate-slide-down">
                    <p className="font-semibold">✓ Message sent successfully!</p>
                    <p className="text-sm mt-1">
                        {successMessage ?? "We'll get back to you within 24 hours."}
                    </p>
                </div>
            )}

            {/* Error State — rate limit or server error */}
            {isError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 animate-slide-down">
                    <p className="font-semibold">⚠ Something went wrong</p>
                    <p className="text-sm mt-1">
                        {errorMessage ?? 'Please try again or email us directly.'}
                    </p>
                </div>
            )}

            <Button
                type="submit"
                variant="accent"
                size="lg"
                fullWidth
                disabled={isPending || isSuccess}
            >
                {isPending ? 'Sending...' : isSuccess ? '✓ Sent!' : (submitLabel ?? 'Book Your Free Demo')}
            </Button>

            <p className="text-sm text-slate-500 text-center">
                By submitting this form, you agree that {brandName} may use your details to respond to your
                enquiry. Read our{' '}
                <Link to="/privacy-policy" className="text-brand-600 hover:underline">
                    Privacy Policy
                </Link>.
            </p>
        </form>
    );
}
