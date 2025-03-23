'use client';
import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { Github, Star, SunMoon, Home, Info, DollarSign } from 'lucide-react';
import { useTheme } from 'next-themes';
import { AnimatedNumber } from '../ui/animate-number';
import { useAuthContext } from '@/providers/AuthProvider';
import { SignUpModal } from '../sign-up-modal';
import { SignInModal } from '../sign-in-modal';
import { logger } from '@/app/log/logger';

// Define the ref interface
export interface NavbarRef {
  activeTab: number;
  setActiveTab: (index: number) => void;
}

// Define props interface
interface FloatingNavbarProps {
  logo?: ReactNode;
  name: string;
  className?: string;
  containerClassName?: string;
  tabsContainerClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  logoContainerClassName?: string;
  nameClassName?: string;
  toolsContainerClassName?: string;
  animationDuration?: number;
}

// Extended FloatingNavbar with Next.js navigation
const FloatingNavbar = forwardRef<NavbarRef, FloatingNavbarProps>(
  (
    {
      logo,
      name,
      className = '',
      containerClassName = '',
      tabsContainerClassName = '',
      activeTabClassName = '',
      inactiveTabClassName = '',
      logoContainerClassName = '',
      nameClassName = '',
      toolsContainerClassName = '',
      animationDuration = 300,
    },
    ref
  ) => {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const { isAuthorized, logout } = useAuthContext();
    const [starCount, setStarCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showSignUp, setShowSignUp] = useState(false);
    const [showSignIn, setShowSignIn] = useState(false);

    const tabs = [
      { label: 'Home', path: '/', icon: <Home size={16} /> },
      {
        label: 'Codefox Journey',
        path: '/Codefox-Journey',
        icon: <Info size={16} />,
      },
      { label: 'Pricing', path: '/price', icon: <DollarSign size={16} /> },
    ];

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

    // Find the active tab index based on the current pathname
    const findActiveTabIndex = () => {
      const index = tabs.findIndex((tab) => tab.path === pathname);
      return index >= 0 ? index : 0; // Default to first tab if path not found
    };

    // const [activeTab, setActiveTab] = useState(findActiveTabIndex());
    // const [isVisible, setIsVisible] = useState(true);

    // Update active tab when pathname changes
    // useEffect(() => {
    //   const newActiveTab = findActiveTabIndex();
    //   if (newActiveTab !== activeTab) {
    //     setActiveTab(newActiveTab);
    //   }
    // }, [pathname]);

    // Expose the activeTab value to parent components through the ref
    // useImperativeHandle(ref, () => ({
    //   activeTab,
    //   setActiveTab: (index) => handleTabChange(index),
    // }));

    // // Handle tab change locally (for animation purposes)
    // const handleTabChange = (index: number) => {
    //   if (index !== activeTab) {
    //     setIsVisible(false);
    //     setTimeout(() => {
    //       setActiveTab(index);
    //       setIsVisible(true);
    //     }, animationDuration);
    //   }
    // };

    // Toggle theme function
    const toggleTheme = () => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    // Ensure content is visible on initial render
    // useEffect(() => {
    //   setIsVisible(true);
    // }, []);

    // Using the same animation variants as in page.tsx
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

    // const handleTabClick = (
    //   e: React.MouseEvent,
    //   index: number,
    //   label: string,
    //   path: string
    // ) => {
    //   if (label === 'Pricing') {
    //     e.preventDefault();
    //     alert('Coming Soon');
    //   } else if (label === 'Codefox Journey') {
    //     e.preventDefault();
    //     alert('Coming Soon');
    //   } else {
    //     handleTabChange(index);
    //   }
    // };

    return (
      <>
        <div className={` top-5 left-0 right-0 z-50 ${className}`}>
          <motion.div
            className={`w-full flex justify-around items-center px-8 py-7 ${containerClassName}`}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Left side - Logo and Name */}
            <motion.div
              className={`flex items-center space-x-3 ${logoContainerClassName}`}
              variants={itemVariants}
            >
              <span
                className={` font-bold text-3xl text-primary-600 dark:text-primary-400 transition-transform hover:scale-105 duration-300 ${nameClassName}`}
              >
                {name}
              </span>
            </motion.div>

            <motion.div
              className="flex-1 flex justify-end items-center space-x-4"
              variants={itemVariants}
            >
              <a
                href="https://github.com/Sma1lboy/codefox"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
              >
                <Github size={18} className="mr-1.5" />
                <Star
                  size={16}
                  className="mr-1 text-yellow-500"
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
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                aria-label="Toggle theme"
              >
                <SunMoon size={20} />
              </button>

              {/* Authentication Buttons */}
              {!isAuthorized && (
                <div className="flex items-center space-x-4 transition-transform duration-300">
                  <button
                    onClick={() => setShowSignIn(true)}
                    className="px-4 py-2 rounded-sm border border-primary-500 text-primary-500 dark:text-primary-400
                 hover:bg-primary-500 hover:text-white transition-colors"
                  >
                    Sign In
                  </button>

                  <button
                    onClick={() => setShowSignUp(true)}
                    className="px-4 py-2 rounded-sm bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Modals */}
        <SignUpModal isOpen={showSignUp} onClose={() => setShowSignUp(false)} />
        <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
      </>
    );
  }
);

FloatingNavbar.displayName = 'FloatingNavbar';

export default FloatingNavbar;
