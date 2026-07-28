'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { toast } from 'sonner';

// Failures land back on the landing page, where the sign-in modal is. They
// used to push /login, which has never been a route in this app — so the one
// thing a user saw after a failed sign-in was a 404.
export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthContext();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const accessToken = searchParams.get('accessToken');
        const refreshToken = searchParams.get('refreshToken');
        const error = searchParams.get('error');

        // Handle error cases
        if (error) {
          console.error('Authentication error:', error);
          toast.error('Authentication failed');
          router.push('/');
          return;
        }

        // Check if tokens exist
        if (!accessToken || !refreshToken) {
          console.error('Missing tokens in callback');
          toast.error('Authentication failed: Missing tokens');
          router.push('/');
          return;
        }

        // Store tokens using the context
        login(accessToken, refreshToken);

        // Show success message
        toast.success('Logged in successfully!');

        // Redirect to home or dashboard
        router.push('/');
      } catch (error) {
        console.error('Error processing authentication:', error);
        toast.error('Authentication processing failed');
        router.push('/');
      }
    };

    handleAuth();
  }, [searchParams, login, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center p-8 max-w-md rounded-xl bg-background shadow-lg">
        <h1 className="text-2xl font-bold mb-4">
          Completing authentication...
        </h1>
        <p className="text-muted-foreground mb-4">
          Please wait while we sign you in.
        </p>
        <div className="flex justify-center">
          <div className="w-8 h-8 border-4 border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}
