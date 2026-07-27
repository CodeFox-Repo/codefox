'use client';
import { Wordmark } from './wordmark';
import { useState, useEffect } from 'react';
import { Github, Star, SunMoon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { AnimatedNumber } from '../ui/animate-number';
import { useAuthContext } from '@/providers/AuthProvider';
import { SignUpModal } from '../sign-up-modal';
import { SignInModal } from '../sign-in-modal';
import { logger } from '@/app/log/logger';

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
      <div className={` top-5 left-0 right-0 z-50 ${className}`}>
        <div
          className={`mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 py-6 sm:px-10 ${containerClassName}`}
        >
          {/* Left side - terminal prompt wordmark */}
          <div className={`flex items-center ${logoContainerClassName}`}>
            {!isAuthorized && <Wordmark className={nameClassName} />}
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <a
              href="https://github.com/Sma1lboy/codefox"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center rounded-lg border border-border px-3 py-1.5 font-mono text-sm text-foreground transition-colors duration-200 hover:border-primary/45"
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
              className="rounded-lg border border-transparent p-2 text-muted-foreground transition-colors duration-200 hover:text-foreground"
              aria-label="Toggle theme"
            >
              <SunMoon size={20} />
            </button>

            {/* Authentication Buttons */}
            {!isAuthorized && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSignIn(true)}
                  className="rounded-lg border border-border px-4 py-2 font-mono text-sm text-foreground transition-colors hover:border-primary/45"
                >
                  Sign In
                </button>

                <button
                  onClick={() => setShowSignUp(true)}
                  className="rounded-lg bg-primary px-4 py-2 font-mono text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
                >
                  Sign Up
                </button>
              </div>
            )}
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
