'use client';
import { Wordmark } from './wordmark';
import { useState, useEffect } from 'react';
import { Github, Star, SunMoon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { AnimatedNumber } from '../ui/animate-number';
import { useQuery } from '@apollo/client';
import { useAuthContext } from '@/providers/AuthProvider';
import { REGISTRATION_OPEN } from '@/graphql/request';
import { SignUpModal } from '../sign-up-modal';
import { SignInModal } from '../sign-in-modal';
import { logger } from '@/app/log/logger';
import Link from 'next/link';
import UserSettingsBar from '../user-settings-bar';

// Define props interface
interface FloatingNavbarProps {
  name: string;
  className?: string;
  containerClassName?: string;
  logoContainerClassName?: string;
  nameClassName?: string;
}

// Extended FloatingNavbar with Next.js navigation
const FloatingNavbar = ({
  name,
  className = '',
  containerClassName = '',
  logoContainerClassName = '',
  nameClassName = '',
}: FloatingNavbarProps) => {
  const { theme, setTheme } = useTheme();
  const { isAuthorized, logout } = useAuthContext();
  const [starCount, setStarCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);
  // A closed deployment still serves the page; offering sign-up there would
  // only ever produce an error, so ask before drawing the button.
  const { data: registration } = useQuery(REGISTRATION_OPEN);
  const canSignUp = registration?.registrationOpen !== false;
  const [showSignIn, setShowSignIn] = useState(false);

  // Fetch GitHub stars
  useEffect(() => {
    const fetchGitHubStars = async () => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/Sma1lboy/codefox'
        );
        if (response.ok) {
          const data = await response.json();
          setStarCount(data.stargazers_count);
        }
      } catch (error) {
        logger.error('Error fetching GitHub stars:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGitHubStars();
  }, []);

  // Toggle theme function
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      {/* A glass capsule floating over the page rather than a full-bleed bar:
          sticky so it stays in flow (nothing hides under it), translucent with
          backdrop blur so the painted hero reads through it. */}
      <div className={`sticky top-4 z-50 px-4 pt-4 ${className}`}>
        <div
          className={`mx-auto flex w-full max-w-[1040px] items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/55 px-4 py-2.5 shadow-lg shadow-black/20 backdrop-blur-xl sm:px-6 ${containerClassName}`}
        >
          {/* Left side - terminal prompt wordmark, always a way home */}
          <div className={`flex items-center ${logoContainerClassName}`}>
            <Link href="/" aria-label="Home">
              <Wordmark className={nameClassName} />
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <a
              href="https://github.com/Sma1lboy/codefox"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center rounded-lg border border-border px-3 py-1.5 font-mono text-sm text-foreground transition-all duration-200 hover:border-primary/45 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Github size={18} className="mr-1.5" />
              <Star
                size={16}
                className="mr-1 text-primary"
                fill="currentColor"
              />
              {isLoading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <AnimatedNumber
                  value={starCount}
                  precision={0}
                  mass={0.8}
                  stiffness={75}
                  damping={15}
                />
              )}
            </a>

            <button
              onClick={toggleTheme}
              className="rounded-lg border border-transparent p-2 text-muted-foreground transition-all duration-200 hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Toggle theme"
            >
              <SunMoon size={20} />
            </button>

            {/* Authentication Buttons */}
            {!isAuthorized && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSignIn(true)}
                  className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-foreground transition-all duration-200 hover:border-primary/45 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign In
                </button>

                {canSignUp && (
                  <button
                    onClick={() => setShowSignUp(true)}
                    className="rounded-lg bg-primary px-4 py-2 font-mono text-sm font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Sign Up
                  </button>
                )}
              </div>
            )}

            {/* With the sidebar gone, the account menu lives here. */}
            {isAuthorized && <UserSettingsBar isSimple={false} />}
          </div>
        </div>
      </div>

      {/* Modals */}
      <SignUpModal isOpen={showSignUp} onClose={() => setShowSignUp(false)} />
      <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
    </>
  );
};

FloatingNavbar.displayName = 'FloatingNavbar';

export default FloatingNavbar;
