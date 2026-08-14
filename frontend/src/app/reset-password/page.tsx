'use client';

import { Suspense, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { RESET_PASSWORD } from '@/graphql/mutations/auth';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import {
  TextureCardHeader,
  TextureCardTitle,
  TextureCardContent,
} from '@/components/ui/texture-card';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Where a reset link lands. The path is not ours to choose — MailService has
 * always pointed at `/reset-password?token=`; the page simply never existed.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD, {
    onCompleted: (data) => {
      if (data.resetPassword.success) {
        setDone(true);
        setTimeout(() => router.push('/'), 3000);
      } else {
        // The server's own words: it knows whether the link expired or the
        // password was too short, and duplicating those rules here would
        // only let the two drift apart.
        setError(data.resetPassword.message);
      }
    },
    onError: () => setError('Could not reach the server. Try again.'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // The one rule worth checking here: the server never sees the second box,
    // so it cannot be the thing that catches a typo.
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setError(null);
    resetPassword({ variables: { token, newPassword: password } });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <BackgroundGradient className="w-full max-w-md rounded-[22px] bg-background p-4">
        <TextureCardHeader className="flex flex-col items-center justify-center gap-2 p-4">
          <TextureCardTitle className="text-center text-2xl">
            Choose a new password
          </TextureCardTitle>
          {(done || !token) && (
            <div className="mt-4 flex items-center justify-center">
              {done ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : (
                <AlertCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
          )}
        </TextureCardHeader>

        <TextureCardContent>
          {!token ? (
            <div className="text-center">
              <p className="mb-6">
                This link is missing its token. Open the link from your email
                again, or request a new one.
              </p>
              <Button onClick={() => router.push('/')}>Go home</Button>
            </div>
          ) : done ? (
            <div className="text-center">
              <p className="mb-2">Password updated. You can sign in now.</p>
              <p className="text-sm text-muted-foreground">Taking you home…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError(null);
                  }}
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 p-2 text-sm text-primary-700 dark:border-primary-800 dark:bg-secondary dark:text-primary-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !password || !confirm}
              >
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
        </TextureCardContent>
      </BackgroundGradient>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary or the whole route opts out of
  // static rendering at build time.
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
