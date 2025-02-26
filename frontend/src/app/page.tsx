'use client';

import { useState } from 'react';
import { SendIcon, FileUp, Sun, Moon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';

import { SignUpModal } from '@/components/sign-up-modal';
import { SignInModal } from '@/components/sign-in-modal';
import { AuthChoiceModal } from '@/components/auth-choice-modal';
import { useAuthContext } from '@/providers/AuthProvider';

export default function HomePage() {
  const [message, setMessage] = useState('');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAuthChoice, setShowAuthChoice] = useState(false);

  const { isAuthorized, logout } = useAuthContext();
  const { theme, setTheme } = useTheme();

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: 'easeInOut',
        staggerChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  return (
    <>
      <nav className="w-full p-4 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/codefox.svg"
              alt="CodeFox Logo"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              CodeFox
            </span>
          </Link>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            {!isAuthorized ? (
              <>
                <button
                  onClick={() => setShowSignIn(true)}
                  className="px-4 py-2 rounded-md bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setShowSignUp(true)}
                  className="px-4 py-2 rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <button
                onClick={logout}
                className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      <motion.div
        className="flex flex-col items-center pt-20"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div className="mb-6" variants={itemVariants}>
          <Image
            src="/codefox.svg"
            alt="CodeFox Logo"
            width={120}
            height={120}
            className="h-32 w-auto"
          />
        </motion.div>

        <motion.div className="mb-16" variants={itemVariants}>
          <p className="text-2xl font-medium text-primary-600 dark:text-primary-400">
            CodeFox makes everything better
          </p>
        </motion.div>

        <motion.div className="w-full max-w-3xl px-4" variants={itemVariants}>
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full py-24 px-6 pr-12 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 align-top pt-6"
            />
            <button
              className="absolute right-3 bottom-3 p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
              aria-label="Send message"
              onClick={() => {
                if (!isAuthorized) {
                  setShowAuthChoice(true);
                } else {
                  console.log('Sending message:', message);
                }
              }}
            >
              <SendIcon size={20} />
            </button>
            <button
              className="absolute left-3 bottom-3 flex items-center gap-2 text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
              aria-label="Upload file"
            >
              <FileUp size={20} />
              <span>Upload file</span>
            </button>
          </div>
        </motion.div>

        <AuthChoiceModal
          isOpen={showAuthChoice}
          onClose={() => setShowAuthChoice(false)}
          onSignUpClick={() => {
            setShowAuthChoice(false);
            setShowSignUp(true);
          }}
          onSignInClick={() => {
            setShowAuthChoice(false);
            setShowSignIn(true);
          }}
        />
        <SignUpModal isOpen={showSignUp} onClose={() => setShowSignUp(false)} />
        <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
      </motion.div>
    </>
  );
}
