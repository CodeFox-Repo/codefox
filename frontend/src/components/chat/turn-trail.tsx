'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { cjk } from '@streamdown/cjk';
import { cn } from '@/lib/utils';
import { splitTurn, type TurnStep } from '../../const/MessageType';

const PLUGINS = { code, cjk };

const Markdown = ({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) => (
  <Streamdown
    plugins={PLUGINS}
    mode={streaming ? 'streaming' : 'static'}
    isAnimating={streaming}
    caret={streaming ? 'block' : undefined}
    shikiTheme={['github-light', 'github-dark']}
  >
    {text}
  </Streamdown>
);

const StepLine = ({ step }: { step: TurnStep }) =>
  step.kind === 'tool' ? (
    <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
      <span className="text-primary">{step.tool}</span>
      {step.file && <span className="truncate">{step.file}</span>}
    </p>
  ) : (
    <div className="prose prose-sm max-w-none opacity-70 dark:prose-invert">
      <Markdown text={step.text} />
    </div>
  );

/**
 * The agent's working notes above its answer, foldable.
 *
 * Open while the turn runs — watching it work is the only progress signal
 * there is — and folded once the answer arrives, because by then the notes
 * are just history. Reopening is one click, and the fold state is the
 * reader's from that point on.
 */
export function TurnTrail({
  steps,
  streaming,
}: {
  steps: TurnStep[];
  streaming?: boolean;
}) {
  const { work, answer } = splitTurn(steps);

  // A turn is finished when the stream is, not merely when it has said
  // something last. Mid-stream the sentence being typed is always the final
  // segment, so reading "there is trailing text" as "there is an answer"
  // folded the notes shut a second after they appeared — the opposite of
  // being able to watch the work.
  const done = !streaming && answer.length > 0;

  // Tracks `done` until the reader overrides it, so the fold happens on its
  // own exactly once and never fights a deliberate click afterwards.
  const [open, setOpen] = React.useState(!done);
  const chosen = React.useRef(false);
  React.useEffect(() => {
    if (!chosen.current) setOpen(!done);
  }, [done]);

  const tools = work.filter((s) => s.kind === 'tool').length;

  return (
    <div className="flex flex-col gap-2">
      {work.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => {
              chosen.current = true;
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            className="flex items-center gap-1.5 font-mono text-xs tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'h-3 w-3 transition-transform',
                open && 'rotate-90'
              )}
            />
            {streaming && !done ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                working
              </span>
            ) : (
              <span>
                {tools} step{tools === 1 ? '' : 's'}
              </span>
            )}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              // Height rather than opacity alone: the notes push the answer
              // down, and having that happen instantly is what makes an
              // auto-collapse feel like the page jumped.
              <motion.div
                key="work"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
                  {work.map((step, i) => (
                    <StepLine key={i} step={step} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {answer.map((step, i) => (
        <div key={i} className="prose prose-sm max-w-none dark:prose-invert">
          <Markdown
            text={step.kind === 'text' ? step.text : ''}
            streaming={streaming}
          />
        </div>
      ))}
    </div>
  );
}
