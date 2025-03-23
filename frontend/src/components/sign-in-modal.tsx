'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import {
  TextureCardHeader,
  TextureCardTitle,
  TextureCardContent,
  TextureSeparator,
} from '@/components/ui/texture-card';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { LOGIN_USER } from '@/graphql/mutations/auth';
import { toast } from 'sonner';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useAuthContext } from '@/providers/AuthProvider';
import { AlertCircle, Github } from 'lucide-react';
import { logger } from '@/app/log/logger';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Destructure login from our AuthContext
  const { login } = useAuthContext();

  // Destructure `loading` so we can disable the button while logging in
  const [loginUser, { loading }] = useMutation(LOGIN_USER, {
    onCompleted: (data) => {
      if (data?.login) {
        // Store tokens where desired (session storage for access, local for refresh)
        login(data.login.accessToken, data.login.refreshToken);
        toast.success('Login successful!');
        setErrorMessage(null);
        onClose(); // Close the modal

        // If you want to redirect somewhere on success, uncomment:
        // router.push("/main");
      }
    },
    onError: () => {
      setErrorMessage('Incorrect email or password. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); // Clear error when attempting login again
    try {
      await loginUser({
        variables: {
          input: {
            email,
            password,
          },
        },
      });
    } catch (error) {
      logger.error('Login failed:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] p-0">
        {/* Invisible but accessible DialogTitle and Description */}
        <VisuallyHidden>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Sign in to your account by entering your credentials
          </DialogDescription>
        </VisuallyHidden>

        <BackgroundGradient className="rounded-[22px] p-4 bg-white dark:bg-zinc-900">
          <div className="w-full">
            <TextureCardHeader className="flex flex-col gap-1 items-center justify-center p-4">
              <TextureCardTitle>Welcome back</TextureCardTitle>
              <p className="text-center text-neutral-600 dark:text-neutral-400">
                Sign in to your account
              </p>
            </TextureCardHeader>
            <TextureSeparator />
            <TextureCardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null); // Clear error when user types
                    }}
                    required
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null); // Clear error when user types
                    }}
                    required
                    className="w-full"
                  />
                </div>

                {/* Show error message if login fails */}
                {errorMessage && (
                  <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 text-sm p-2 rounded-md bg-primary-50 dark:bg-zinc-800 border border-primary-200 dark:border-primary-800">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-zinc-900 px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-4">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 w-full"
                  >
                    <img
                      src="/images/google.svg"
                      alt="Google"
                      className="w-5 h-5"
                    />
                    <span>Google</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 w-full"
                  >
                    <Github className="w-5 h-5 text-black dark:text-white" />
                    <span>GitHub</span>
                  </Button>
                </div>
              </div>
            </TextureCardContent>
          </div>
        </BackgroundGradient>
      </DialogContent>
    </Dialog>
  );
}
