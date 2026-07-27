'use client';

import { useRef, useContext, useState } from 'react';
import { motion } from 'framer-motion';
import { AuthChoiceModal } from '@/components/auth-choice-modal';
import { useAuthContext } from '@/providers/AuthProvider';
import { ProjectsSection } from '@/components/root/projects-section';
import { PromptForm, PromptFormRef } from '@/components/root/prompt-form';
import { ProjectContext } from '@/components/chat/code-engine/project-context';
import { SignInModal } from '@/components/sign-in-modal';
import { SignUpModal } from '@/components/sign-up-modal';
import { Workbench } from '@/components/root/workbench';
import { useRouter } from 'next/navigation';
import { logger } from '../log/logger';

// Narrative-workflow stages, kobe-style: prose on the left, real terminal
// output on the right. No drawn diagrams.
const STAGES = [
  {
    no: '01',
    title: 'Describe it once',
    body: 'One prompt in, one project out. CodeFox reads the intent, picks a stack, and writes the plan before it writes a line of code.',
    term: `$ codefox new "a habit tracker with streaks"
  → stack     next.js · nestjs · postgres
  → entities  User, Habit, CheckIn
  → routes    12 planned`,
  },
  {
    no: '02',
    title: 'Agents do the wiring',
    body: 'A crew of agents splits the work — schema, API, UI, tests — and each one owns its slice end to end. You watch the diff, not the prompt engineering.',
    term: `  agent:schema    ✓ 3 models, 2 relations
  agent:api       ✓ 12 resolvers
  agent:ui        ⠋ 6/9 screens
  agent:tests     · queued`,
  },
  {
    no: '03',
    title: 'Run it before you trust it',
    body: 'Live preview boots the generated project next to the chat. Change your mind mid-sentence and the running app follows.',
    term: `$ codefox dev
  ready on http://localhost:3000
  db      sqlite · .codefox/data
  hot     12 modules in 340ms`,
  },
];

export default function HomePage() {
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
      if (!chatId) return; // createProjectFromPrompt already surfaced the error

      promptFormRef.current.clearMessage();
      router.push(`/chat?id=${chatId}`);
    } catch (error) {
      logger.error('Error creating project:', error);
    }
  };

  // Signed in? Skip the pitch entirely — go straight to the composer and the
  // user's own work. The marketing page below is for visitors.
  if (isAuthorized) {
    return (
      <Workbench
        promptFormRef={promptFormRef}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Faint grid, masked to the top of the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] opacity-[0.06]
                   [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)]
                   [background-size:64px_64px]
                   [mask-image:radial-gradient(ellipse_90%_55%_at_50%_0%,#000_30%,transparent_80%)]"
      />

      <div className="relative mx-auto w-full max-w-[1180px] px-5 sm:px-10">
        {/* ---- hero ---- */}
        <motion.section
          className="pt-24 pb-14"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="font-mono text-xs tracking-[0.12em] text-primary mb-5">
            AI SEQUENCE FULL-STACK GENERATOR
          </p>

          <h1 className="font-display max-w-[20ch] text-[clamp(2.375rem,5vw,3.875rem)] font-bold leading-[1.02] tracking-[-0.03em] text-foreground">
            From idea to <span className="text-primary">full-stack</span> in
            seconds
          </h1>

          <p className="mt-6 max-w-[52ch] font-mono text-base leading-relaxed text-muted-foreground">
            A multi-agent crew plans the schema, writes the API, builds the UI,
            and hands you a project that already runs.
          </p>

          <div className="mt-10 max-w-3xl rounded-xl border border-border bg-card">
            <PromptForm
              ref={promptFormRef}
              isAuthorized={isAuthorized}
              onSubmit={handleSubmit}
              onAuthRequired={() => setShowAuthChoice(true)}
              isLoading={isLoading}
            />
          </div>

          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Node 18+ · no database to install · <code>pnpm dev</code> and go
          </p>
        </motion.section>

        {/* ---- quicklook ---- */}
        <section className="pb-6">
          <figure className="overflow-hidden rounded-xl border border-border bg-card">
            <video
              className="block h-auto w-full"
              src="/demo/quicklook.mp4"
              poster="/demo/quicklook-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
            />
          </figure>
          <figcaption className="mt-3 text-center font-mono text-xs text-muted-foreground">
            one prompt → planned → generated → running
          </figcaption>
        </section>

        {/* ---- narrative workflow ---- */}
        <section className="mt-24">
          {STAGES.map((stage) => (
            <div
              key={stage.no}
              className="grid gap-10 border-t-[3px] border-border py-10 md:grid-cols-2 md:gap-16"
            >
              <div>
                <span className="mb-4 block font-mono text-sm tracking-[0.12em] text-primary">
                  {stage.no}
                </span>
                <h2 className="font-display text-[clamp(1.75rem,3.6vw,2.625rem)] font-bold leading-[1.08] tracking-[-0.02em] text-foreground">
                  {stage.title}
                </h2>
                <p className="mt-4 max-w-[52ch] font-mono text-sm leading-[1.7] text-muted-foreground">
                  {stage.body}
                </p>
              </div>
              <pre className="min-w-0 self-center overflow-x-auto border-l-2 border-border py-2 pl-6 font-mono text-sm leading-[2] text-foreground/80">
                {stage.term}
              </pre>
            </div>
          ))}
        </section>

        {/* ---- public projects ---- */}
        <section className="mt-16 mb-24 border-t-[3px] border-border pt-10">
          <ProjectsSection />
        </section>
      </div>

      <AuthChoiceModal
        isOpen={showAuthChoice}
        onClose={() => setShowAuthChoice(false)}
        onSignUpClick={() => {
          setShowAuthChoice(false);
          setTimeout(() => setShowSignUp(true), 100);
        }}
        onSignInClick={() => {
          setShowAuthChoice(false);
          setTimeout(() => setShowSignIn(true), 100);
        }}
      />
      <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
      <SignUpModal isOpen={showSignUp} onClose={() => setShowSignUp(false)} />
    </div>
  );
}
