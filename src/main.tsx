import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider } from './hooks/useAuth'
import { CustomerAuthProvider } from './hooks/useCustomerAuth'
import './styles/index.css'
import { Router } from './router'
import { queryClient } from './lib/query-client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CustomerAuthProvider>
          <Router />
          {/* DevTools panel — only visible in development builds */}
          <ReactQueryDevtools initialIsOpen={false} />
        </CustomerAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)

