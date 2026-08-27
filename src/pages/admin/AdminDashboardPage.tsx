import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { queryClient } from '@/lib/query-client';
import { QUERY_KEYS } from '@/hooks/useContent';
import { Button } from '@/components/common/Button';
import { CountryPhoneInput } from '@/components/admin/CountryPhoneInput';
import { AdminShell, type AdminNavItem } from '@/components/admin/AdminShell';
import { AdminCard } from '@/components/admin/AdminCard';
import { AdminNotice } from '@/components/admin/AdminNotice';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminActionRow } from '@/components/admin/AdminActionRow';
import { AdminSection } from '@/components/admin/AdminSection';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { AccountSecurityPanel, type CapabilityLoadState } from '@/components/admin/AccountSecurityPanel';
import { PaymentsPanel } from '@/components/admin/PaymentsPanel';
import { CustomersPanel } from '@/components/admin/CustomersPanel';
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS } from '@/lib/social';
import {
    adminGetServices, adminSaveService, adminDeleteService,
    adminGetSolutions, adminSaveSolution, adminDeleteSolution,
    adminGetPricingPlans, adminSavePricingPlan, adminDeletePricingPlan,
    adminGetPricingAddons, adminSavePricingAddon, adminDeletePricingAddon,
    adminGetFAQs, adminSaveFAQ, adminDeleteFAQ,
    adminGetSiteSettings, adminSaveSiteSettings,
    adminGetContacts, adminUpdateContactStatus,
    adminGetLegalPages, adminSaveLegalPage,
    adminUploadLogo, adminRemoveLogo,
    adminGetCapabilities, isApiError,
    type ServiceData, type SolutionData, type PricingPlanData, type PricingAddonData,
    type FAQItem, type SiteData, type ContactMessage, type LegalPageAdminData, type SocialLink,
    type AdminCapabilities,
} from '@/lib/api-client';
import { formatPhoneDisplay, toTelHref } from '@/lib/phone';
import { env } from '@/config/env';

type TabType = 'overview' | 'services' | 'solutions' | 'pricing' | 'faqs' | 'site' | 'legal' | 'contacts' | 'payments' | 'customers' | 'account';

const TAB_IDS: readonly TabType[] = [
    'overview', 'services', 'solutions', 'pricing', 'faqs', 'site', 'legal', 'contacts', 'payments', 'customers', 'account',
];

function isTabType(id: string): id is TabType {
    return (TAB_IDS as readonly string[]).includes(id);
}

type EditingItem =
    | { type: 'service'; isNew: boolean; data: ServiceData }
    | { type: 'solution'; isNew: boolean; data: SolutionData }
    | { type: 'plan'; isNew: boolean; data: PricingPlanData }
    | { type: 'addon'; isNew: boolean; data: PricingAddonData }
    | { type: 'faq'; isNew: boolean; data: FAQItem };

const DANGER_BTN = 'border-red-400 text-red-800 hover:border-red-600 hover:bg-red-50 hover:text-red-950';

export function AdminDashboardPage() {
    const { isAuthenticated, logout, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [navOpen, setNavOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [services, setServices] = useState<ServiceData[]>([]);
    const [solutions, setSolutions] = useState<SolutionData[]>([]);
    const [pricingPlans, setPricingPlans] = useState<PricingPlanData[]>([]);
    const [pricingAddons, setPricingAddons] = useState<PricingAddonData[]>([]);
    const [faqs, setFaqs] = useState<FAQItem[]>([]);
    const [site, setSite] = useState<SiteData | null>(null);
    const [contacts, setContacts] = useState<ContactMessage[]>([]);
    const [contactFilter, setContactFilter] = useState<'all' | 'unread' | 'read' | 'archived'>('all');
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [legalPages, setLegalPages] = useState<LegalPageAdminData[]>([]);
    const [activeLegalId, setActiveLegalId] = useState<'privacy-policy' | 'terms-of-service'>('privacy-policy');
    const [uploadingLogo, setUploadingLogo] = useState<'header' | 'footer' | null>(null);
    const [logoPreviewError, setLogoPreviewError] = useState<{ header: boolean; footer: boolean }>({ header: false, footer: false });
    const [capabilities, setCapabilities] = useState<AdminCapabilities | null>(null);
    const [capabilityState, setCapabilityState] = useState<CapabilityLoadState>('loading');

    const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, Boolean(editingItem));

    const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
        setStatusMessage({ type, text });
        window.setTimeout(() => setStatusMessage(null), 4000);
    };

    const loadCapabilities = useCallback(async () => {
        setCapabilityState('loading');
        try {
            const caps = await adminGetCapabilities();
            setCapabilities(caps);
            setCapabilityState('ready');
        } catch {
            setCapabilities(null);
            setCapabilityState('error');
        }
    }, []);

    const loadAllData = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const [srv, sol, plans, addons, fq, st, cont, legal] = await Promise.all([
                adminGetServices().catch(() => []),
                adminGetSolutions().catch(() => []),
                adminGetPricingPlans().catch(() => []),
                adminGetPricingAddons().catch(() => []),
                adminGetFAQs().catch(() => []),
                adminGetSiteSettings().catch(() => null),
                adminGetContacts().catch(() => []),
                adminGetLegalPages().catch(() => []),
            ]);

            setServices(srv);
            setSolutions(sol);
            setPricingPlans(plans);
            setPricingAddons(addons);
            setFaqs(fq);
            setSite(st);
            setContacts(cont);
            setLegalPages(legal);
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : 'Error loading dashboard data', 'error');
        } finally {
            setIsLoadingData(false);
        }
        await loadCapabilities();
    }, [loadCapabilities]);

    useEffect(() => {
        if (!isAuthenticated) return;
        void loadAllData();
    }, [isAuthenticated, loadAllData]);

    useEffect(() => {
        if (!editingItem) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setEditingItem(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [editingItem]);

    if (authLoading) {
        return (
            <div className="admin-app flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center" role="status">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent admin-motion" />
                    <p className="text-slate-300">Verifying session…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/admin/login" replace />;
    }

    const saveSiteSettings = async () => {
        if (!site) return;
        try {
            await adminSaveSiteSettings(site);
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITE });
            showMessage('Site settings saved and cache invalidated!');
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : 'Failed to save site settings', 'error');
        }
    };

    const handleSaveSite = (e: React.FormEvent) => {
        e.preventDefault();
        void saveSiteSettings();
    };

    const updateSocialLinks = (updater: (links: SocialLink[]) => SocialLink[]) => {
        if (!site) return;
        setSite({
            ...site,
            footer: { ...site.footer, socialLinks: updater(site.footer.socialLinks ?? []) },
        });
    };

    const handleAddSocialLink = () => {
        updateSocialLinks((links) => [
            ...links,
            {
                id: `new-social-${Date.now()}`,
                platform: 'other',
                label: '',
                url: '',
                enabled: true,
                sortOrder: links.length,
            },
        ]);
    };

    const handleUpdateSocialLink = (id: string, patch: Partial<SocialLink>) => {
        updateSocialLinks((links) => links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    };

    const handleRemoveSocialLink = (id: string) => {
        updateSocialLinks((links) => links.filter((l) => l.id !== id));
    };

    const handleMoveSocialLink = (id: string, direction: -1 | 1) => {
        updateSocialLinks((links) => {
            const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);
            const index = sorted.findIndex((l) => l.id === id);
            const targetIndex = index + direction;
            if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return links;
            const swappedOrder = sorted[targetIndex]!.sortOrder;
            sorted[targetIndex] = { ...sorted[targetIndex]!, sortOrder: sorted[index]!.sortOrder };
            sorted[index] = { ...sorted[index]!, sortOrder: swappedOrder };
            return sorted;
        });
    };

    const handleUploadLogo = async (target: 'header' | 'footer', file: File) => {
        setUploadingLogo(target);
        try {
            await adminUploadLogo(target, file);
            const refreshed = await adminGetSiteSettings();
            setSite(refreshed);
            setLogoPreviewError((prev) => ({ ...prev, [target]: false }));
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITE });
            showMessage(`${target === 'header' ? 'Header' : 'Footer'} logo updated!`);
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : 'Failed to upload logo', 'error');
        } finally {
            setUploadingLogo(null);
        }
    };

    const handleRemoveLogo = async (target: 'header' | 'footer') => {
        if (!confirm(`Remove the ${target} logo? This falls back to the default brand logo.`)) return;
        try {
            await adminRemoveLogo(target);
            const refreshed = await adminGetSiteSettings();
            setSite(refreshed);
            setLogoPreviewError((prev) => ({ ...prev, [target]: false }));
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITE });
            showMessage(`${target === 'header' ? 'Header' : 'Footer'} logo removed.`);
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : 'Failed to remove logo', 'error');
        }
    };

    const activeLegalPage = legalPages.find((p) => p.id === activeLegalId) ?? null;

    const handleSaveLegal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeLegalPage) return;
        try {
            await adminSaveLegalPage(activeLegalPage.id, {
                title: activeLegalPage.title,
                body: activeLegalPage.body,
                isPublished: activeLegalPage.isPublished,
            });
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LEGAL(activeLegalPage.id) });
            showMessage('Legal page saved!');
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : 'Failed to save legal page', 'error');
        }
    };

    const updateActiveLegalPage = (patch: Partial<LegalPageAdminData>) => {
        setLegalPages((prev) => prev.map((p) => (p.id === activeLegalId ? { ...p, ...patch } : p)));
    };

    const handleDelete = async (type: EditingItem['type'], id: string | number) => {
        if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
        try {
            if (type === 'service') {
                await adminDeleteService(String(id));
                setServices((prev) => prev.filter((s) => s.id !== id));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SERVICES });
            } else if (type === 'solution') {
                await adminDeleteSolution(String(id));
                setSolutions((prev) => prev.filter((s) => s.id !== id));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SOLUTIONS });
            } else if (type === 'plan') {
                await adminDeletePricingPlan(String(id));
                setPricingPlans((prev) => prev.filter((p) => p.id !== id));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRICING });
            } else if (type === 'addon') {
                await adminDeletePricingAddon(String(id));
                setPricingAddons((prev) => prev.filter((a) => a.id !== id));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRICING });
            } else if (type === 'faq') {
                await adminDeleteFAQ(String(id));
                setFaqs((prev) => prev.filter((f) => f.id !== id));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAQ });
            }
            showMessage(`${type.toUpperCase()} deleted successfully!`);
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : `Failed to delete ${type}`, 'error');
        }
    };

    const handleSaveModal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;
        const { type, isNew, data } = editingItem;

        try {
            if (type === 'service') {
                await adminSaveService(data, isNew);
                setServices((prev) => (isNew ? [...prev, data] : prev.map((s) => (s.id === data.id ? data : s))));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SERVICES });
            } else if (type === 'solution') {
                await adminSaveSolution(data, isNew);
                setSolutions((prev) => (isNew ? [...prev, data] : prev.map((s) => (s.id === data.id ? data : s))));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SOLUTIONS });
            } else if (type === 'plan') {
                await adminSavePricingPlan(data, isNew);
                setPricingPlans((prev) => (isNew ? [...prev, data] : prev.map((p) => (p.id === data.id ? data : p))));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRICING });
            } else if (type === 'addon') {
                await adminSavePricingAddon(data, isNew);
                setPricingAddons((prev) => (isNew ? [...prev, data] : prev.map((a) => (a.id === data.id ? data : a))));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRICING });
            } else {
                await adminSaveFAQ(data, isNew);
                setFaqs((prev) => (isNew ? [...prev, data] : prev.map((f) => (f.id === data.id ? data : f))));
                await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAQ });
            }
            showMessage(`${type.toUpperCase()} saved successfully and cache refreshed!`);
            setEditingItem(null);
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : `Failed to save ${type}`, 'error');
        }
    };

    const handleUpdateLeadStatus = async (id: number, status: ContactMessage['status']) => {
        try {
            await adminUpdateContactStatus(id, status);
            setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
            showMessage(`Lead marked as ${status}`);
        } catch (err: unknown) {
            showMessage(isApiError(err) ? err.message : 'Failed to update lead status', 'error');
        }
    };

    const filteredContacts = contactFilter === 'all'
        ? contacts
        : contacts.filter((c) => c.status === contactFilter);

    const unreadCount = contacts.filter((c) => c.status === 'unread').length;

    const navItems: AdminNavItem[] = [
        { id: 'overview', label: 'Overview', icon: <AdminIcon name="overview" className="w-5 h-5" /> },
        { id: 'services', label: 'Services', icon: <AdminIcon name="services" className="w-5 h-5" />, count: services.length },
        { id: 'solutions', label: 'Solutions', icon: <AdminIcon name="solutions" className="w-5 h-5" />, count: solutions.length },
        { id: 'pricing', label: 'Pricing & Addons', icon: <AdminIcon name="pricing" className="w-5 h-5" />, count: pricingPlans.length + pricingAddons.length },
        { id: 'faqs', label: 'FAQs', icon: <AdminIcon name="faqs" className="w-5 h-5" />, count: faqs.length },
        { id: 'site', label: 'Site Settings', icon: <AdminIcon name="site" className="w-5 h-5" /> },
        { id: 'legal', label: 'Legal', icon: <AdminIcon name="legal" className="w-5 h-5" /> },
        { id: 'contacts', label: 'Leads & Inquiries', icon: <AdminIcon name="contacts" className="w-5 h-5" />, badge: unreadCount > 0 ? `${unreadCount} new` : undefined },
        { id: 'payments', label: 'Payments & Orders', icon: <AdminIcon name="payments" className="w-5 h-5" /> },
        { id: 'customers', label: 'Customers', icon: <AdminIcon name="customers" className="w-5 h-5" /> },
        { id: 'account', label: 'Account & Security', icon: <AdminIcon name="account" className="w-5 h-5" /> },
    ];

    return (
        <>
            <AdminShell
                activeTab={activeTab}
                navItems={navItems}
                onSelectTab={(id) => {
                    if (isTabType(id)) setActiveTab(id);
                }}
                navOpen={navOpen}
                onNavOpenChange={setNavOpen}
                onRefresh={() => void loadAllData()}
                isRefreshing={isLoadingData}
                onSignOut={() => {
                    logout();
                    navigate('/admin/login');
                }}
                statusMessage={statusMessage}
            >
                {activeTab === 'overview' && (
                    <AdminSection>
                        <AdminPageHeader
                            title="Content Overview"
                            description="Manage landing page content, pricing, FAQs, and incoming inquiries."
                        />
                        <div className="grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 lg:grid-cols-4">
                            <StatCard icon="🤖" value={String(services.length)} label="Services" />
                            <StatCard icon="💳" value={`${pricingPlans.length} plans`} label={`${pricingAddons.length} add-ons`} />
                            <StatCard icon="❓" value={String(faqs.length)} label="FAQs" />
                            <StatCard icon="📬" value={String(contacts.length)} label={`${unreadCount} unread`} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <AdminCard>
                                <h2 className="font-bold text-slate-900">Quick actions</h2>
                                <div className="mt-3">
                                    <AdminActionRow>
                                        <Button size="sm" variant="secondary" onClick={() => setEditingItem({
                                            type: 'faq',
                                            isNew: true,
                                            data: { id: `faq-${Date.now()}`, question: '', answer: '', category: 'General' },
                                        })}>
                                            Add FAQ
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => setEditingItem({
                                            type: 'service',
                                            isNew: true,
                                            data: {
                                                id: `service-${Date.now()}`,
                                                name: '',
                                                shortDescription: '',
                                                longDescription: '',
                                                icon: '🤖',
                                                timeline: '5-7 days',
                                                whoItsFor: [],
                                                included: [],
                                                pricing: { type: 'one-time', amount: 997 },
                                                sortOrder: services.length,
                                            },
                                        })}>
                                            Add service
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setActiveTab('site')}>
                                            Edit branding
                                        </Button>
                                    </AdminActionRow>
                                </div>
                            </AdminCard>
                            <AdminCard>
                                <h2 className="font-bold text-slate-900">Recent leads</h2>
                                <div className="mt-3 space-y-2">
                                    {contacts.slice(0, 3).map((lead) => (
                                        <div key={lead.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <p className="min-w-0 font-semibold text-slate-900 admin-break">
                                                    {lead.name} ({lead.email})
                                                </p>
                                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase ${
                                                    lead.status === 'unread' ? 'bg-amber-100 text-amber-950' : 'bg-slate-200 text-slate-800'
                                                }`}>
                                                    {lead.status}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-slate-700 admin-break">{lead.message}</p>
                                        </div>
                                    ))}
                                    {contacts.length === 0 && (
                                        <p className="text-sm text-slate-700">No leads received yet.</p>
                                    )}
                                </div>
                            </AdminCard>
                        </div>
                    </AdminSection>
                )}

                {activeTab === 'services' && (
                    <AdminSection>
                        <AdminPageHeader
                            title="Services"
                            description="Modify chatbot and automation offerings."
                            actions={
                                <Button size="sm" variant="accent" onClick={() => setEditingItem({
                                    type: 'service',
                                    isNew: true,
                                    data: {
                                        id: `service-${Date.now()}`,
                                        name: 'New Service',
                                        shortDescription: 'Short description here',
                                        longDescription: 'Detailed explanation of what the service covers',
                                        icon: '🤖',
                                        timeline: '5-7 business days',
                                        whoItsFor: ['Small businesses'],
                                        included: ['Chatbot setup'],
                                        pricing: { type: 'one-time', amount: 997, note: 'Setup fee' },
                                        sortOrder: services.length,
                                    },
                                })}>
                                    Add service
                                </Button>
                            }
                        />
                        {services.map((s) => (
                            <AdminCard key={s.id}>
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span aria-hidden="true">{s.icon}</span>
                                            <h2 className="font-bold text-slate-900 admin-break">{s.name}</h2>
                                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800 admin-break">
                                                slug: {s.id}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 admin-break">{s.shortDescription}</p>
                                        <p className="text-sm font-medium text-brand-800">
                                            {s.pricing?.type === 'monthly'
                                                ? `$${s.pricing?.amount}/mo`
                                                : s.pricing?.amount
                                                    ? `$${s.pricing?.amount}`
                                                    : s.pricing?.note || 'Custom pricing'}
                                            {' · '}Timeline: {s.timeline || '5-7 business days'}
                                        </p>
                                    </div>
                                    <ItemActions
                                        onEdit={() => setEditingItem({ type: 'service', isNew: false, data: { ...s } })}
                                        onDelete={() => void handleDelete('service', s.id)}
                                    />
                                </div>
                            </AdminCard>
                        ))}
                    </AdminSection>
                )}

                {activeTab === 'solutions' && (
                    <AdminSection>
                        <AdminPageHeader
                            title="Industry Solutions"
                            description="Manage niche-specific solution cards."
                            actions={
                                <Button size="sm" variant="accent" onClick={() => setEditingItem({
                                    type: 'solution',
                                    isNew: true,
                                    data: {
                                        id: `solution-${Date.now()}`,
                                        title: 'For Your Industry',
                                        icon: '🎯',
                                        description: 'Solution summary here',
                                        ctaText: 'Get Started',
                                        pains: ['Repetitive inquiries'],
                                        benefits: ['24/7 automated booking'],
                                    },
                                })}>
                                    Add solution
                                </Button>
                            }
                        />
                        {solutions.map((sol) => (
                            <AdminCard key={sol.id}>
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span aria-hidden="true">{sol.icon}</span>
                                            <h2 className="font-bold text-slate-900 admin-break">{sol.title}</h2>
                                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800 admin-break">
                                                slug: {sol.id}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 admin-break">{sol.description}</p>
                                    </div>
                                    <ItemActions
                                        onEdit={() => setEditingItem({ type: 'solution', isNew: false, data: { ...sol } })}
                                        onDelete={() => void handleDelete('solution', sol.id)}
                                    />
                                </div>
                            </AdminCard>
                        ))}
                    </AdminSection>
                )}

                {activeTab === 'pricing' && (
                    <AdminSection className="space-y-8">
                        <AdminPageHeader title="Pricing & Addons" description="Plans and optional add-on services." />
                        <div className="space-y-4">
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-bold text-white">Pricing plans</h2>
                                <Button size="sm" variant="accent" onClick={() => setEditingItem({
                                    type: 'plan',
                                    isNew: true,
                                    data: {
                                        id: `plan-${Date.now()}`,
                                        name: 'Custom Plan',
                                        description: 'Plan description',
                                        monthlyPrice: 99,
                                        setupFee: 499,
                                        bestFor: 'Target business profile',
                                        ctaText: 'Choose Plan',
                                        badge: '',
                                        highlighted: false,
                                        features: ['Feature 1', 'Feature 2'],
                                    },
                                })}>
                                    Add plan
                                </Button>
                            </div>
                            {pricingPlans.map((p) => (
                                <AdminCard key={p.id}>
                                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-bold text-slate-900 admin-break">{p.name}</h3>
                                                {p.badge && (
                                                    <span className="rounded-full border border-brand-700 bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-900">
                                                        {p.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-700 admin-break">{p.description}</p>
                                            <p className="text-sm font-medium text-brand-800 admin-break">
                                                ${p.monthlyPrice}/mo {p.setupFee ? `+ $${p.setupFee} setup` : ''} · Best for: {p.bestFor}
                                            </p>
                                        </div>
                                        <ItemActions
                                            onEdit={() => setEditingItem({ type: 'plan', isNew: false, data: { ...p } })}
                                            onDelete={() => void handleDelete('plan', p.id)}
                                        />
                                    </div>
                                </AdminCard>
                            ))}
                        </div>
                        <div className="space-y-4 border-t border-slate-800 pt-6">
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-lg font-bold text-white">Add-on services</h2>
                                <Button size="sm" variant="secondary" onClick={() => setEditingItem({
                                    type: 'addon',
                                    isNew: true,
                                    data: {
                                        id: `addon-${Date.now()}`,
                                        name: 'New Add-on',
                                        description: 'Add-on description',
                                        price: 297,
                                        priceType: 'one-time',
                                    },
                                })}>
                                    Add add-on
                                </Button>
                            </div>
                            {pricingAddons.map((a) => (
                                <AdminCard key={a.id}>
                                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 admin-break">{a.name}</h3>
                                            <p className="text-sm text-slate-700 admin-break">{a.description}</p>
                                            <p className="text-sm font-medium text-slate-800">${a.price} ({a.priceType})</p>
                                        </div>
                                        <ItemActions
                                            onEdit={() => setEditingItem({ type: 'addon', isNew: false, data: { ...a } })}
                                            onDelete={() => void handleDelete('addon', a.id)}
                                        />
                                    </div>
                                </AdminCard>
                            ))}
                        </div>
                    </AdminSection>
                )}

                {activeTab === 'faqs' && (
                    <AdminSection>
                        <AdminPageHeader
                            title="Frequently Asked Questions"
                            description="Add, edit, or reorder customer FAQs."
                            actions={
                                <Button size="sm" variant="accent" onClick={() => setEditingItem({
                                    type: 'faq',
                                    isNew: true,
                                    data: { id: `faq-${Date.now()}`, question: '', answer: '', category: 'General' },
                                })}>
                                    Add FAQ
                                </Button>
                            }
                        />
                        {faqs.map((f) => (
                            <AdminCard key={f.id}>
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800">
                                                {f.category || 'General'}
                                            </span>
                                            <h2 className="font-bold text-slate-900 admin-break">{f.question}</h2>
                                        </div>
                                        <p className="text-sm text-slate-700 admin-break">{f.answer}</p>
                                    </div>
                                    <ItemActions
                                        onEdit={() => setEditingItem({ type: 'faq', isNew: false, data: { ...f } })}
                                        onDelete={() => void handleDelete('faq', f.id)}
                                    />
                                </div>
                            </AdminCard>
                        ))}
                    </AdminSection>
                )}

                {activeTab === 'site' && site && (
                    <AdminSection>
                        <AdminPageHeader
                            title="Global Site Settings"
                            description="Update company branding, contact email, and phone."
                        />
                        <AdminCard>
                            <form onSubmit={handleSaveSite} className="space-y-4">
                                <Field label="Brand name">
                                    <input type="text" className="admin-field" required value={site.brand.name} onChange={(e) => setSite({ ...site, brand: { ...site.brand, name: e.target.value } })} />
                                </Field>
                                <Field label="Tagline">
                                    <input type="text" className="admin-field" required value={site.brand.tagline} onChange={(e) => setSite({ ...site, brand: { ...site.brand, tagline: e.target.value } })} />
                                </Field>
                                <Field label="Description">
                                    <textarea rows={3} className="admin-field" required value={site.brand.description} onChange={(e) => setSite({ ...site, brand: { ...site.brand, description: e.target.value } })} />
                                </Field>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Contact email">
                                        <input type="email" className="admin-field" required value={site.contact.email} onChange={(e) => setSite({ ...site, contact: { ...site.contact, email: e.target.value } })} />
                                    </Field>
                                    <div className="min-w-0">
                                        <p className="admin-label" id="admin-contact-phone-label">Contact phone</p>
                                        <div aria-labelledby="admin-contact-phone-label">
                                            <CountryPhoneInput
                                                variant="light"
                                                value={site.contact.phone}
                                                onChange={(e164) => setSite({ ...site, contact: { ...site.contact, phone: e164 } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Field label="Footer copyright notice">
                                    <input type="text" className="admin-field" value={site.footer?.copyright || ''} onChange={(e) => setSite({ ...site, footer: { ...site.footer, copyright: e.target.value } })} />
                                </Field>
                                <Button type="submit" variant="accent">Save settings & purge cache</Button>
                            </form>
                        </AdminCard>

                        <AdminCard>
                            <h2 className="text-lg font-bold text-slate-900">Branding & logos</h2>
                            <p className="mt-1 text-sm text-slate-700">
                                Upload independent logos for the header and footer. PNG, JPEG, or WebP, up to 2MB.
                            </p>
                            {capabilityState === 'ready' && capabilities && !capabilities.logoStorageConfigured && (
                                <div className="mt-3">
                                    <AdminNotice variant="warning" title="Logo uploads unavailable">
                                        Media storage is not configured for this deployment. Ask the site administrator to finish storage setup before uploading a logo.
                                    </AdminNotice>
                                </div>
                            )}
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {(['header', 'footer'] as const).map((target) => {
                                    const url = target === 'header' ? site.brand.headerLogoUrl : site.brand.footerLogoUrl;
                                    const canUpload = capabilityState !== 'loading' && (
                                        capabilityState !== 'ready' || Boolean(capabilities?.logoStorageConfigured)
                                    );
                                    const previewFailed = logoPreviewError[target];
                                    return (
                                        <div key={target} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-800">{target} logo</span>
                                            <div className="flex h-16 items-center justify-center rounded-lg border border-slate-200 bg-white">
                                                {url && !previewFailed ? (
                                                    <img
                                                        src={`${env.apiBaseUrl}${url}`}
                                                        alt={`${target} logo preview`}
                                                        className="h-12 w-auto max-w-full object-contain"
                                                        onError={() => setLogoPreviewError((prev) => ({ ...prev, [target]: true }))}
                                                    />
                                                ) : url && previewFailed ? (
                                                    <span role="alert" className="px-2 text-center text-xs font-medium text-amber-950">
                                                        Couldn't load this logo. Try re-uploading.
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-700">Using default logo</span>
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                                <label className="min-w-0 flex-1">
                                                    <span className="sr-only">Upload {target} logo</span>
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        disabled={uploadingLogo === target || !canUpload}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) void handleUploadLogo(target, file);
                                                            e.target.value = '';
                                                        }}
                                                        className="w-full text-sm text-slate-800 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800 disabled:opacity-50"
                                                    />
                                                </label>
                                                {url && (
                                                    <Button type="button" size="sm" variant="outline" className={DANGER_BTN} onClick={() => void handleRemoveLogo(target)}>
                                                        Remove
                                                    </Button>
                                                )}
                                            </div>
                                            {uploadingLogo === target && <p className="text-sm font-medium text-brand-800">Uploading…</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </AdminCard>

                        <AdminCard>
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Social links</h2>
                                    <p className="text-sm text-slate-700">Shown in the footer. Only enabled links are public.</p>
                                </div>
                                <Button type="button" size="sm" variant="secondary" onClick={handleAddSocialLink}>
                                    Add link
                                </Button>
                            </div>
                            <div className="mt-4 space-y-3">
                                {[...(site.footer.socialLinks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((link, idx, arr) => (
                                    <div key={link.id} className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                                        <select
                                            value={link.platform}
                                            onChange={(e) => handleUpdateSocialLink(link.id, { platform: e.target.value as SocialLink['platform'] })}
                                            className="admin-field"
                                            aria-label="Social platform"
                                        >
                                            {SOCIAL_PLATFORMS.map((p) => (
                                                <option key={p} value={p}>{SOCIAL_PLATFORM_LABELS[p]}</option>
                                            ))}
                                        </select>
                                        <input type="text" placeholder="Label (optional)" value={link.label ?? ''} onChange={(e) => handleUpdateSocialLink(link.id, { label: e.target.value })} className="admin-field" aria-label="Social link label" />
                                        <input type="url" placeholder="https://" value={link.url} onChange={(e) => handleUpdateSocialLink(link.id, { url: e.target.value })} className="admin-field admin-break" aria-label="Social link URL" />
                                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-800">
                                                <input type="checkbox" checked={link.enabled} onChange={(e) => handleUpdateSocialLink(link.id, { enabled: e.target.checked })} />
                                                Enabled
                                            </label>
                                            <button type="button" disabled={idx === 0} onClick={() => handleMoveSocialLink(link.id, -1)} className="admin-touch rounded border border-slate-300 px-2 text-slate-800 disabled:opacity-40" aria-label="Move up">↑</button>
                                            <button type="button" disabled={idx === arr.length - 1} onClick={() => handleMoveSocialLink(link.id, 1)} className="admin-touch rounded border border-slate-300 px-2 text-slate-800 disabled:opacity-40" aria-label="Move down">↓</button>
                                            <button type="button" onClick={() => handleRemoveSocialLink(link.id)} className="admin-touch rounded border border-red-400 px-2 font-semibold text-red-800" aria-label="Remove link">Remove</button>
                                        </div>
                                    </div>
                                ))}
                                {(site.footer.socialLinks ?? []).length === 0 && (
                                    <p className="text-sm text-slate-700">No social links yet.</p>
                                )}
                            </div>
                            <div className="mt-4">
                                <Button type="button" variant="accent" onClick={() => void saveSiteSettings()}>
                                    Save settings & purge cache
                                </Button>
                            </div>
                        </AdminCard>
                    </AdminSection>
                )}

                {activeTab === 'legal' && (
                    <AdminSection>
                        <AdminPageHeader
                            title="Legal Pages"
                            description="Privacy Policy and Terms of Service stay unpublished until you add approved copy."
                        />
                        <div className="flex w-full max-w-full flex-wrap gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-1" role="tablist" aria-label="Legal documents">
                            {legalPages.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeLegalId === p.id}
                                    onClick={() => setActiveLegalId(p.id)}
                                    className={`admin-touch min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-medium admin-break sm:flex-none ${
                                        activeLegalId === p.id ? 'bg-brand-600 font-semibold text-white' : 'text-slate-200 hover:text-white'
                                    }`}
                                >
                                    {p.title || p.id}
                                </button>
                            ))}
                        </div>
                        {activeLegalPage && (
                            <AdminCard>
                                <form onSubmit={handleSaveLegal} className="space-y-4">
                                    <Field label="Title">
                                        <input type="text" className="admin-field" required value={activeLegalPage.title} onChange={(e) => updateActiveLegalPage({ title: e.target.value })} />
                                    </Field>
                                    <Field label="Body (plain text, blank line = new paragraph)">
                                        <textarea rows={12} className="admin-field font-mono text-sm" value={activeLegalPage.body} onChange={(e) => updateActiveLegalPage({ body: e.target.value })} placeholder="Paste your approved legal copy here..." />
                                    </Field>
                                    <label className="flex min-h-11 items-center gap-2 text-sm text-slate-800">
                                        <input type="checkbox" checked={activeLegalPage.isPublished} onChange={(e) => updateActiveLegalPage({ isPublished: e.target.checked })} />
                                        Published (visible to the public)
                                    </label>
                                    <Button type="submit" variant="accent">Save legal page</Button>
                                </form>
                            </AdminCard>
                        )}
                    </AdminSection>
                )}

                {activeTab === 'contacts' && (
                    <AdminSection>
                        <AdminPageHeader title="Lead Capture Messages" description="Incoming inquiries from the public contact form." />
                        <div className="flex w-full flex-wrap gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-1" role="tablist" aria-label="Filter leads">
                            {(['all', 'unread', 'read', 'archived'] as const).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    role="tab"
                                    aria-selected={contactFilter === f}
                                    onClick={() => setContactFilter(f)}
                                    className={`admin-touch min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize sm:flex-none ${
                                        contactFilter === f ? 'bg-brand-600 font-semibold text-white' : 'text-slate-200 hover:text-white'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        {filteredContacts.map((lead) => (
                            <AdminCard key={lead.id} as="article">
                                <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <h2 className="font-bold text-slate-900 admin-break">{lead.name}</h2>
                                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-700">
                                            <a href={`mailto:${lead.email}`} className="font-medium text-brand-800 underline admin-break">{lead.email}</a>
                                            <span>Business: <strong>{lead.businessType}</strong></span>
                                            {lead.website && (
                                                <a href={lead.website} target="_blank" rel="noreferrer" className="text-brand-800 underline admin-break">{lead.website}</a>
                                            )}
                                            {lead.phone && (
                                                <a href={toTelHref(lead.phone) ?? undefined} className="text-brand-800 underline admin-break">
                                                    {formatPhoneDisplay(lead.phone)}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <label className="text-sm font-medium text-slate-800">
                                        <span className="sr-only">Lead status for {lead.name}</span>
                                        <select
                                            value={lead.status}
                                            onChange={(e) => void handleUpdateLeadStatus(lead.id, e.target.value as ContactMessage['status'])}
                                            className="admin-field sm:w-40"
                                        >
                                            <option value="unread">Unread</option>
                                            <option value="read">Read</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                    </label>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 admin-break">
                                    {lead.message}
                                </p>
                                <p className="mt-2 text-xs text-slate-700">Received: {new Date(lead.createdAt).toLocaleString()}</p>
                            </AdminCard>
                        ))}
                        {filteredContacts.length === 0 && (
                            <AdminCard>
                                <p className="text-sm text-slate-700">No messages found in this category.</p>
                            </AdminCard>
                        )}
                    </AdminSection>
                )}

                {activeTab === 'payments' && <PaymentsPanel />}

                {activeTab === 'customers' && <CustomersPanel />}

                {activeTab === 'account' && (
                    <AccountSecurityPanel
                        capabilityState={capabilityState}
                        capabilities={capabilities}
                        onRetryCapabilities={() => void loadCapabilities()}
                    />
                )}
            </AdminShell>

            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
                    <div
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-edit-title"
                        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl sm:rounded-2xl sm:p-6"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                            <h2 id="admin-edit-title" className="text-lg font-bold capitalize admin-break">
                                {editingItem.isNew ? 'Add' : 'Edit'} {editingItem.type}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setEditingItem(null)}
                                className="admin-touch inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 text-slate-800"
                                aria-label="Close editor"
                            >
                                Close
                            </button>
                        </div>
                        <form onSubmit={handleSaveModal} className="space-y-4">
                            {editingItem.type === 'service' && (
                                <>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="sm:col-span-2">
                                            <Field label="Name">
                                                <input type="text" className="admin-field" required value={editingItem.data.name} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} />
                                            </Field>
                                        </div>
                                        <Field label="Icon">
                                            <input type="text" className="admin-field text-center" required value={editingItem.data.icon} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, icon: e.target.value } })} />
                                        </Field>
                                    </div>
                                    <Field label="Short description">
                                        <input type="text" className="admin-field" required value={editingItem.data.shortDescription} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, shortDescription: e.target.value } })} />
                                    </Field>
                                    <Field label="Long description">
                                        <textarea rows={3} className="admin-field" required value={editingItem.data.longDescription} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, longDescription: e.target.value } })} />
                                    </Field>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="Pricing type">
                                            <select className="admin-field" value={editingItem.data.pricing?.type || 'one-time'} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, pricing: { ...editingItem.data.pricing, type: e.target.value as ServiceData['pricing']['type'] } } })}>
                                                <option value="one-time">One-time</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="custom">Custom</option>
                                            </select>
                                        </Field>
                                        <Field label="Amount ($)">
                                            <input type="number" className="admin-field" value={editingItem.data.pricing?.amount || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, pricing: { ...editingItem.data.pricing, amount: Number(e.target.value) || undefined } } })} />
                                        </Field>
                                    </div>
                                </>
                            )}
                            {editingItem.type === 'faq' && (
                                <>
                                    <Field label="Category">
                                        <input type="text" className="admin-field" value={editingItem.data.category || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, category: e.target.value } })} placeholder="Setup, Pricing, Technical, etc." />
                                    </Field>
                                    <Field label="Question">
                                        <input type="text" className="admin-field" required value={editingItem.data.question} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, question: e.target.value } })} />
                                    </Field>
                                    <Field label="Answer">
                                        <textarea rows={4} className="admin-field" required value={editingItem.data.answer} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, answer: e.target.value } })} />
                                    </Field>
                                </>
                            )}
                            {editingItem.type === 'solution' && (
                                <>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="sm:col-span-2">
                                            <Field label="Title">
                                                <input type="text" className="admin-field" required value={editingItem.data.title} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} />
                                            </Field>
                                        </div>
                                        <Field label="Icon">
                                            <input type="text" className="admin-field text-center" required value={editingItem.data.icon} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, icon: e.target.value } })} />
                                        </Field>
                                    </div>
                                    <Field label="Description">
                                        <textarea rows={2} className="admin-field" required value={editingItem.data.description} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, description: e.target.value } })} />
                                    </Field>
                                </>
                            )}
                            {editingItem.type === 'plan' && (
                                <>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="Name">
                                            <input type="text" className="admin-field" required value={editingItem.data.name} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} />
                                        </Field>
                                        <Field label="Badge (optional)">
                                            <input type="text" className="admin-field" value={editingItem.data.badge || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, badge: e.target.value } })} placeholder="RECOMMENDED" />
                                        </Field>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="Monthly price ($)">
                                            <input type="number" className="admin-field" required value={editingItem.data.monthlyPrice} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, monthlyPrice: Number(e.target.value) } })} />
                                        </Field>
                                        <Field label="Setup fee ($)">
                                            <input type="number" className="admin-field" value={editingItem.data.setupFee || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, setupFee: Number(e.target.value) || undefined } })} />
                                        </Field>
                                    </div>
                                    <Field label="Best for">
                                        <input type="text" className="admin-field" required value={editingItem.data.bestFor} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, bestFor: e.target.value } })} />
                                    </Field>
                                </>
                            )}
                            {editingItem.type === 'addon' && (
                                <>
                                    <Field label="Name">
                                        <input type="text" className="admin-field" required value={editingItem.data.name} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} />
                                    </Field>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="Price ($)">
                                            <input type="number" className="admin-field" required value={editingItem.data.price} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, price: Number(e.target.value) } })} />
                                        </Field>
                                        <Field label="Billing type">
                                            <select className="admin-field" value={editingItem.data.priceType} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, priceType: e.target.value as PricingAddonData['priceType'] } })}>
                                                <option value="one-time">One-time</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        </Field>
                                    </div>
                                </>
                            )}
                            <div className="admin-action-row border-t border-slate-200 pt-4">
                                <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                                <Button type="submit" variant="accent">Save & publish</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
    return (
        <AdminCard className="p-4 sm:p-5">
            <div className="text-2xl" aria-hidden="true">{icon}</div>
            <p className="text-2xl font-bold text-slate-900 admin-break">{value}</p>
            <p className="text-sm text-slate-700">{label}</p>
        </AdminCard>
    );
}

function ItemActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    return (
        <AdminActionRow>
            <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="outline" className={DANGER_BTN} onClick={onDelete}>Delete</Button>
        </AdminActionRow>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block min-w-0">
            <span className="admin-label">{label}</span>
            {children}
        </label>
    );
}
