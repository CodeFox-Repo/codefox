'use client';

import { useRef, useContext, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { AuthChoiceModal } from '@/components/auth-choice-modal';
import { useAuthContext } from '@/providers/AuthProvider';
import { ProjectsSection } from '@/components/root/projects-section';
import { PromptForm, PromptFormRef } from '@/components/root/prompt-form';
import { ProjectContext } from '@/components/chat/code-engine/project-context';
import { SignInModal } from '@/components/sign-in-modal';
import { SignUpModal } from '@/components/sign-up-modal';
import { useRouter } from 'next/navigation';
import { logger } from '../log/logger';
import { AuroraText } from '@/components/magicui/aurora-text';
export default function HomePage() {
  // States for AuthChoiceModal
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const router = useRouter();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  const promptFormRef = useRef<PromptFormRef>(null);
  const { isAuthorized } = useAuthContext();
  const { createProjectFromPrompt, isLoading } = useContext(ProjectContext);

  const handleSubmit = async () => {
    if (!promptFormRef.current) return;

    const { message, isPublic, model } = promptFormRef.current.getPromptData();
    if (!message.trim()) return;

    try {
      const chatId = await createProjectFromPrompt(message, isPublic, model);

      promptFormRef.current.clearMessage();
      router.push(`/chat?id=${chatId}`);
    } catch (error) {
      logger.error('Error creating project:', error);
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-24 px-6 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="fixed inset-0 -z-20">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-[120px] transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[100px] transform -translate-x-1/2 translate-y-1/2"></div>
      </div>

      <div className="w-full mx-auto flex flex-col items-center mt-40 ">
        <motion.div
          className="flex flex-col items-center w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6">
            <Image
              src="/codefox.svg"
              alt="CodeFox Logo"
              width={120}
              height={120}
              className="h-32 w-auto"
            />
          </div>
          <motion.div
            className="mb-16 relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex flex-col items-center">
              <motion.h1
                className="text-5xl sm:text-6xl font-bold mb-8 tracking-tight leading-tight text-center"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                From Idea to <AuroraText>Full-Stack</AuroraText> in Seconds
              </motion.h1>

              <motion.p
                className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 max-w-2xl text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.7,
                  delay: 0.5,
                  ease: 'easeOut',
                }}
              >
                CodeFox provides an AI-driven multi-agent crew to help you
                create your next project instantly
              </motion.p>
            </div>

            <motion.div
              className="absolute -z-10 left-1/4 -translate-x-1/2 top-0 w-32 h-32 rounded-full bg-primary-500/10 blur-2xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.7, 0.5],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
            />

            <motion.div
              className="absolute -z-10 right-1/4 translate-x-1/2 top-0 w-32 h-32 rounded-full bg-primary-500/10 blur-2xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.7, 0.5],
              }}
              transition={{
                duration: 6,
                delay: 1.5,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
            />
          </motion.div>

          <motion.div
            className="relative w-full max-w-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.8,
              delay: 0.7,
              ease: 'easeOut',
            }}
          >
            <div className="absolute -z-10 inset-0 bg-gradient-to-r from-primary-500/5 to-primary-600/5 rounded-2xl blur-xl transform scale-105"></div>

            <div className=" bg-white/10 dark:bg-gray-800/30 backdrop-blur-md rounded-lg border border-primary/20 dark:border-gray-700/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(120,120,255,0.5)] hover:border-primary-500/60">
              <PromptForm
                ref={promptFormRef}
                isAuthorized={isAuthorized}
                onSubmit={handleSubmit}
                onAuthRequired={() => setShowAuthChoice(true)}
                isLoading={isLoading}
              />
            </div>
          </motion.div>

          <motion.div
            className="w-full mb-24 mt-40"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
          >
            <ProjectsSection />
          </motion.div>
        </motion.div>

        <AuthChoiceModal
          isOpen={showAuthChoice}
          onClose={() => setShowAuthChoice(false)}
          onSignUpClick={() => {
            setShowAuthChoice(false);
            setTimeout(() => {
              setShowSignUp(true);
            }, 100);
          }}
          onSignInClick={() => {
            setShowAuthChoice(false);
            setTimeout(() => {
              setShowSignIn(true);
            }, 100);
          }}
        />

        <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
        <SignUpModal isOpen={showSignUp} onClose={() => setShowSignUp(false)} />
      </div>
    </div>
  );
}
