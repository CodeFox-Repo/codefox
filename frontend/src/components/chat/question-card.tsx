'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import {
  DESIGN_SYSTEMS,
  DesignSystemChoice,
  RESTYLE_PROJECT,
  announceRestyled,
} from '@/components/design-systems';

/** One clarifying question the agent asked before building. */
export interface AgentQuestion {
  id: string;
  label: string;
  multi?: boolean;
  options: string[];
  /** 'style' renders the options as palette cards and applies the pick to the
   *  project's tokens. Anything else is a plain option row. */
  kind?: string;
}

export interface AgentQuestionBlock {
  intro?: string;
  questions: AgentQuestion[];
}

const FENCE = /```codefox-questions\s*\n([\s\S]*?)```/;
const PARTIAL_FENCE = /```codefox-questions[\s\S]*$/;

/**
 * While the block is still streaming in, the half-arrived JSON would render
 * as a raw code block for a few seconds. Hide the tail until it closes; the
 * caret already says more is coming.
 */
export function stripPartialQuestionFence(content: string): string {
  if (FENCE.test(content)) return content;
  return content.replace(PARTIAL_FENCE, '');
}

/**
 * Pull the question block out of an assistant message, if a complete and
 * valid one is present. Returns the message with the block removed so the
 * prose renders as markdown and the questions render as controls.
 */
export function extractQuestions(content: string): {
  block: AgentQuestionBlock | null;
  rest: string;
} {
  const match = content?.match(FENCE);
  if (!match) return { block: null, rest: content };
  try {
    const parsed = JSON.parse(match[1]);
    const seen = new Set<string>();
    const questions: AgentQuestion[] = (
      Array.isArray(parsed?.questions)
        ? parsed.questions.filter(
            (q: AgentQuestion) =>
              q &&
              typeof q.label === 'string' &&
              Array.isArray(q.options) &&
              q.options.length > 0
          )
        : []
    ).map((q: AgentQuestion, index: number) => {
      // Every answer is stored under `q.id`, so a missing or repeated id made
      // two questions share one slot: picking an option in the first one
      // filled in the second, and both rendered under the same React key. The
      // model writes this JSON, so the id is a suggestion — the position is
      // what is actually unique.
      const id =
        typeof q.id === 'string' && q.id && !seen.has(q.id)
          ? q.id
          : `q${index}`;
      seen.add(id);
      return { ...q, id };
    });
    if (questions.length === 0) return { block: null, rest: content };
    return {
      block: { intro: parsed.intro, questions },
      rest: content.replace(FENCE, '').trim(),
    };
  } catch {
    // A half-streamed or malformed block renders as ordinary markdown.
    return { block: null, rest: content };
  }
}

/**
 * One style as a card: the palette itself, then the name and blurb. A style
 * is a look, so the card shows the look rather than describing it.
 */
function StyleCard({
  system,
  selected,
  interactive,
  onPick,
}: {
  system: DesignSystemChoice;
  selected: boolean;
  interactive: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onPick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border p-2 text-left transition-colors',
        selected ? 'border-primary bg-primary/10' : 'border-border',
        interactive ? 'hover:border-primary' : 'cursor-default opacity-70'
      )}
    >
      <span
        aria-hidden
        className="flex h-10 overflow-hidden rounded border border-border/60"
      >
        <span className="flex-1" style={{ background: system.bg }} />
        <span className="flex-1" style={{ background: system.surface }} />
        <span className="flex-1" style={{ background: system.fg }} />
        <span className="flex-[2]" style={{ background: system.accent }} />
      </span>
      <span className="flex items-center gap-1.5">
        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="truncate text-sm font-medium text-foreground">
          {system.name}
        </span>
      </span>
      <span className="line-clamp-2 text-xs text-muted-foreground">
        {system.blurb}
      </span>
    </button>
  );
}

/**
 * The planner's checklist. Interactive only for the trailing message —
 * answered questions stay visible in history but read-only, since the answer
 * itself is the next user message.
 */
export function QuestionCard({
  block,
  interactive,
  onSubmit,
  projectId,
}: {
  block: AgentQuestionBlock;
  interactive: boolean;
  onSubmit?: (answer: string) => void;
  /** THIS chat's project. Passed down rather than read from context: the URL
   *  carries a chat id, which never matches a project id, so context keeps
   *  whatever `lastProjectId` localStorage held — and the card restyled a
   *  different project than the one on screen. Same fix CodeEngine made. */
  projectId?: string;
}) {
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');

  // Only fetched when the agent actually asked a style question.
  const hasStyle = block.questions.some((q) => q.kind === 'style');
  const { data: styleData } = useQuery<{
    designSystems: DesignSystemChoice[];
  }>(DESIGN_SYSTEMS, { skip: !hasStyle });
  const byId = new Map((styleData?.designSystems ?? []).map((s) => [s.id, s]));

  const [restyle] = useMutation(RESTYLE_PROJECT);
  /** Set when the swap could not be applied; posted with the answer so the
   *  agent knows to restyle by hand instead. */
  const [restyleNote, setRestyleNote] = useState('');

  const applyStyle = async (styleId: string) => {
    if (!projectId) return;
    try {
      const { data } = await restyle({ variables: { projectId, styleId } });
      const result = data?.restyleProject;
      setRestyleNote(result?.ok ? '' : (result?.message ?? ''));
      if (result?.ok) announceRestyled();
    } catch {
      // The pick still answers the question; the agent can do the work.
      setRestyleNote('The style could not be applied automatically.');
    }
  };

  const toggle = (q: AgentQuestion, option: string) => {
    if (!interactive) return;
    setChoices((prev) => {
      const current = prev[q.id] ?? [];
      if (q.multi) {
        return {
          ...prev,
          [q.id]: current.includes(option)
            ? current.filter((o) => o !== option)
            : [...current, option],
        };
      }
      return { ...prev, [q.id]: [option] };
    });
  };

  const singlesAnswered = block.questions
    .filter((q) => !q.multi)
    .every((q) => (choices[q.id] ?? []).length > 0);

  const submit = () => {
    const lines = block.questions
      .map((q) => {
        const picked = choices[q.id] ?? [];
        return picked.length ? `- ${q.label}: ${picked.join(', ')}` : null;
      })
      .filter(Boolean);
    const answer = [
      'My choices:',
      ...lines,
      // The tokens were not swapped, so the agent has to do it — saying so in
      // the answer is what tells it that.
      restyleNote
        ? `Note: ${restyleNote} Please apply the style yourself.`
        : null,
      note.trim() ? `Note: ${note.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    onSubmit?.(answer);
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Before building
      </p>
      {block.intro && (
        <p className="mb-4 text-sm text-muted-foreground">{block.intro}</p>
      )}

      <div className="space-y-4">
        {block.questions.map((q) => (
          <div key={q.id}>
            <p className="mb-2 text-sm font-medium text-foreground">
              {q.label}
              {q.multi && (
                <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">
                  multi
                </span>
              )}
            </p>
            {q.kind === 'style' &&
            q.options.some((option) => byId.has(option)) ? (
              /* ponytail: fixed 2 columns, no sm: breakpoint. That keyed off
                 the VIEWPORT, so at 1440 it went to 3 columns inside an ~18%
                 chat panel and each card came out 56px wide — "Bru…". The
                 panel is narrow at every viewport; a container query would
                 need the plugin for one grid. */
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((option) => {
                  const system = byId.get(option);
                  // A style id the catalog does not know is skipped rather
                  // than rendered as an empty card.
                  if (!system) return null;
                  return (
                    <StyleCard
                      key={option}
                      system={system}
                      selected={(choices[q.id] ?? []).includes(option)}
                      interactive={interactive}
                      onPick={() => {
                        toggle(q, option);
                        void applyStyle(option);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.options.map((option) => {
                  const selected = (choices[q.id] ?? []).includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={!interactive}
                      onClick={() => toggle(q, option)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground',
                        interactive
                          ? 'hover:border-primary hover:text-foreground'
                          : 'cursor-default opacity-70'
                      )}
                    >
                      {selected && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {interactive && (
        <div className="mt-5 space-y-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else the agent should know? (optional)"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                onSubmit?.(
                  'Use your best judgment on the open questions and start building.'
                )
              }
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip — let the agent decide
            </button>
            <Button size="sm" disabled={!singlesAnswered} onClick={submit}>
              Start building
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
