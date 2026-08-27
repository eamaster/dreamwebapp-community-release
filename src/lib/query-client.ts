/**
 * TanStack React Query client configuration.
 *
 * staleTime: 5 minutes — aligns with edge Cache-Control max-age=3600.
 *   Content is considered fresh for 5 minutes client-side, so navigating
 *   between pages won't trigger redundant fetches.
 *
 * gcTime: 60 minutes — cached data stays in memory for an hour,
 *   allowing instant re-renders with fallback while background refetch runs.
 *
 * retry: 2 — automatically retry failed requests twice before surfacing errors.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,    // 5 minutes
            gcTime:    1000 * 60 * 60,    // 60 minutes
            retry: 2,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },
        mutations: {
            retry: 0,
        },
    },
});
