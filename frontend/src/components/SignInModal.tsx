'use client';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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

export function SignInModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // ✅ State for error message

  const [loginUser, { loading }] = useMutation(LOGIN_USER, {
    onCompleted: (data) => {
      if (data?.login) {
        localStorage.setItem('accessToken', data.login.accessToken);
        localStorage.setItem('refreshToken', data.login.refreshToken);
        toast.success('Login successful!');
        setErrorMessage(null); // ✅ Clear error on success
        onClose();
        router.push('/x');
      }
    },
    onError: (error) => {
      setErrorMessage('Incorrect email or password. Please try again.'); // ✅ Show error message
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); // ✅ Clear error when attempting login again
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
      console.error('Login failed:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%]">
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
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null); // ✅ Clear error when user types
                    }}
                    required
                    className="w-full px-4 py-2 rounded-md border"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null); // ✅ Clear error when user types
                    }}
                    required
                    className="w-full px-4 py-2 rounded-md border"
                  />
                </div>

                {/* ✅ Show error message if login fails */}
                {errorMessage && (
                  <div className="text-red-500 text-sm text-center">
                    {errorMessage}
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
                      src="/images/google.png"
                      alt="Google"
                      className="w-5 h-5"
                    />
                    <span>Google</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 w-full"
                  >
                    <img
                      src="/images/github.png"
                      alt="GitHub"
                      className="w-5 h-5"
                    />
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
