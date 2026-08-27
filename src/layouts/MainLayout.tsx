import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { env } from '@/config/env';
import { ChatProvider } from '@/components/chat/ChatProvider';
import { ChatLauncher } from '@/components/chat/ChatLauncher';
import { ChatPanel } from '@/components/chat/ChatPanel';

/**
 * Main Layout component
 * Wraps all pages with header and footer, plus the AI chat widget
 * (launcher + panel) which is user-initiated and never opens automatically.
 */
export function MainLayout() {
    useScrollToTop();

    const layout = (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
                <Outlet />
            </main>
            <Footer />
        </div>
    );

    if (!env.enableChatWidget) {
        return layout;
    }

    return (
        <ChatProvider>
            {layout}
            <ChatLauncher />
            <ChatPanel />
        </ChatProvider>
    );
}
