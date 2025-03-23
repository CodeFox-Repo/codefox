'use client';

import dynamic from 'next/dynamic';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from './AuthProvider';
import { ProjectProvider } from '@/components/chat/code-engine/project-context';
import GlobalToastListener from '@/components/global-toast-listener';
const DynamicApolloProvider = dynamic(() => import('./DynamicApolloProvider'), {
  ssr: false, // disables SSR for the ApolloProvider
});

interface ProvidersProps {
  children: React.ReactNode;
}

export function BaseProviders({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <DynamicApolloProvider>
        <AuthProvider>
          <ProjectProvider>
            <GlobalToastListener />
            {children}
            <Toaster position="bottom-right" />
          </ProjectProvider>
        </AuthProvider>
      </DynamicApolloProvider>
    </ThemeProvider>
  );
}
