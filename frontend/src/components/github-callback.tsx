'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Github, Check, AlertCircle, Loader } from 'lucide-react';

// This component handles the GitHub App installation callback
export default function GitHubCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuthContext();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasCalledBackend = useRef(false); // Add guard flag here

  useEffect(() => {
    // Extract installation ID from search params
    const githubCode = searchParams.get('code');
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');

    if (!token || hasCalledBackend.current) return; // Prevent multiple calls

    console.log('GitHub Callback:', {
      githubCode,
      installationId,
      setupAction,
    });

    // If there's no installation ID, this might be a cancellation
    if (!installationId || !githubCode) {
      // Check if it was canceled
      if (searchParams.get('canceled') === 'true') {
        setStatus('error');
        setErrorMessage('GitHub App installation was canceled.');
        return;
      }

      // Or if it's a delete operation
      if (setupAction === 'delete') {
        setStatus('success');
        // We could call a different endpoint to remove the installationId
        return;
      }

      setStatus('error');
      setErrorMessage('No installation ID was provided.');
      return;
    }

    hasCalledBackend.current = true;

    // Call the backend directly to store the installation ID
    const storeInstallation = async () => {
      try {
        // Use environment variable or hardcoded value for backend URL
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

        const response = await fetch(`${backendUrl}/github/storeInstallation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ installationId, githubCode }),
        });

        if (!response.ok) {
          throw new Error(`Failed to store installation: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setStatus('success');
        } else {
          throw new Error('Backend reported failure');
        }
      } catch (error) {
        console.error('Error storing GitHub installation:', error);
        setStatus('error');
        setErrorMessage(
          error.message || 'Failed to store GitHub installation.'
        );
      }
    };

    storeInstallation();
  }, []);

  // Function to handle redirect back to projects
  const handleContinue = () => {
    router.push('/'); // Change this to your desired redirect path
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Github className="h-6 w-6" />
            <CardTitle>GitHub Integration</CardTitle>
          </div>
          <CardDescription>
            Completing your GitHub App installation
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center py-6">
          {status === 'loading' && (
            <>
              <Loader className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-center text-muted-foreground">
                Finalizing your GitHub App installation...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-3 mb-4">
                <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Installation Complete!
              </h3>
              <p className="text-center text-muted-foreground mb-4">
                Your GitHub App has been successfully installed. You can now
                publish your projects to GitHub.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-3 mb-4">
                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Installation Failed
              </h3>
              <p className="text-center text-muted-foreground mb-2">
                We encountered an error while setting up your GitHub
                integration.
              </p>
              {errorMessage && (
                <p className="text-center text-sm text-red-500 dark:text-red-400">
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </CardContent>

        <CardFooter>
          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={status === 'loading'}
          >
            {status === 'success'
              ? 'Return to Projects'
              : status === 'error'
                ? 'Try Again Later'
                : 'Please Wait...'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
