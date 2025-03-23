'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { CONFIRM_EMAIL_MUTATION } from '@/graphql/mutations/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import {
  TextureCardHeader,
  TextureCardTitle,
  TextureCardContent,
} from '@/components/ui/texture-card';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [message, setMessage] = useState('Verifying your email...');

  const [confirmEmail] = useMutation(CONFIRM_EMAIL_MUTATION, {
    onCompleted: (data) => {
      if (data.confirmEmail.success) {
        setStatus('success');
        setMessage(data.confirmEmail.message || 'Email verified successfully!');
        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.confirmEmail.message || 'Failed to verify email.');
      }
    },
    onError: (error) => {
      setStatus('error');
      setMessage(
        error.message || 'An error occurred while verifying your email.'
      );
    },
  });

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    // Call the mutation to confirm the email
    confirmEmail({
      variables: {
        token,
      },
    });
  }, [confirmEmail, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <BackgroundGradient className="rounded-[22px] p-4 bg-white dark:bg-zinc-900 max-w-md w-full">
        <TextureCardHeader className="flex flex-col gap-2 items-center justify-center p-4">
          <TextureCardTitle className="text-center text-2xl">
            Email Verification
          </TextureCardTitle>

          <div className="mt-4 flex items-center justify-center">
            {status === 'loading' && (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
        </TextureCardHeader>

        <TextureCardContent className="text-center">
          <p className="mb-6">{message}</p>

          {status === 'success' && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              You will be redirected to the home page shortly...
            </p>
          )}

          {status === 'error' && (
            <Button onClick={() => router.push('/')} className="mt-4">
              Go to Home Page
            </Button>
          )}
        </TextureCardContent>
      </BackgroundGradient>
    </div>
  );
}
