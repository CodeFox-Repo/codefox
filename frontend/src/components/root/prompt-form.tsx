'use client';

import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { SendIcon, Sparkles, Globe, Lock, Loader2, Cpu } from 'lucide-react';
import Typewriter from 'typewriter-effect';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useModels } from '@/hooks/useModels';
import { gql, useMutation, useQuery } from '@apollo/client';
import { logger } from '@/app/log/logger';
import {
  DESIGN_SYSTEMS,
  SCENARIOS,
  ScenarioChoice,
  DesignSystemChoice,
  DesignSystemOptions,
  Swatch,
} from '@/components/design-systems';

export interface PromptFormRef {
  getPromptData: () => {
    message: string;
    isPublic: boolean;
    model: string;
    scenario: string;
    style: string;
  };
  clearMessage: () => void;
  /** Fill the box from outside — the empty state's example prompts. */
  setMessage: (text: string) => void;
}

interface PromptFormProps {
  isAuthorized: boolean;
  onSubmit: () => void;
  onAuthRequired: () => void;
  isLoading?: boolean;
  /** Shorter box for repeat use in the workbench; the landing page wants the
   *  tall one because it is the page's whole call to action. */
  compact?: boolean;
}

const REGENERATE_DESCRIPTION = gql`
  mutation RegenerateDescription($input: String!) {
    regenerateDescription(input: $input)
  }
`;

export const PromptForm = forwardRef<PromptFormRef, PromptFormProps>(
  function PromptForm(
    { isAuthorized, onSubmit, onAuthRequired, isLoading = false, compact },
    ref
  ) {
    const [message, setMessage] = useState('');
    // Light by default: a page, not a toolchain. The full Next starter is
    // the plug-in choice for when a real app is the goal.
    const [scenarioId, setScenarioId] = useState('landing');
    const [style, setStyle] = useState('');

    // The list is public and static; the picker only shows for page projects,
    // but fetching unconditionally keeps it warm for the moment it appears.
    const { data: styleData } = useQuery<{
      designSystems: DesignSystemChoice[];
    }>(DESIGN_SYSTEMS);
    const { data: scenarioData } = useQuery<{
      scenarios: ScenarioChoice[];
    }>(SCENARIOS);
    const scenarios = scenarioData?.scenarios ?? [];
    const chosenScenario = scenarios.find((s) => s.id === scenarioId);
    // Only page scenarios carry a design system; the Next starter has its own.
    const isPage = chosenScenario ? chosenScenario.id !== 'app' : true;
    const designSystems = styleData?.designSystems ?? [];
    const chosenStyle =
      designSystems.find((s) => s.id === style) ?? designSystems[0];
    const [visibility, setVisibility] = useState<'public' | 'private'>(
      'public'
    );
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [isFocused, setIsFocused] = useState(false); // 追踪 textarea focus
    const [isRegenerating, setIsRegenerating] = useState(false);

    const {
      selectedModel,
      setSelectedModel,
      loading: isModelLoading,
      models,
    } = useModels();

    // GraphQL: regenerateDescription
    const [regenerateDescriptionMutation] = useMutation(
      REGENERATE_DESCRIPTION,
      {
        onCompleted: (data) => {
          setMessage(data.regenerateDescription);
          // Only now is the prompt actually enhanced. The button used to flip
          // to "Enhanced" on click, including on an empty box or a failure.
          setIsEnhanced(true);
          setIsRegenerating(false);
        },
        onError: (error) => {
          logger.error('Error regenerating description:', error);
          setIsEnhanced(false);
          setIsRegenerating(false);
        },
      }
    );

    const handleSubmit = () => {
      if (isLoading || isRegenerating) return;
      if (!isAuthorized) {
        onAuthRequired();
      } else {
        onSubmit();
      }
    };

    const handleMagicEnhance = () => {
      if (isLoading || isRegenerating) return;
      if (!isAuthorized) {
        onAuthRequired();
        return;
      }
      if (message.trim()) {
        setIsRegenerating(true);
        regenerateDescriptionMutation({ variables: { input: message } });
      }
    };

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (isLoading || isRegenerating) return;
        if ((e.altKey || e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [handleSubmit, isAuthorized, isLoading, isRegenerating]);

    useImperativeHandle(ref, () => ({
      getPromptData: () => ({
        message,
        isPublic: visibility === 'public',
        model: selectedModel,
        scenario: scenarioId,
        // Only pages carry a design system; the Next starter has its own.
        style: isPage ? (chosenStyle?.id ?? '') : '',
      }),
      clearMessage: () => {
        setMessage('');
        setIsEnhanced(false);
      },
      setMessage: (text: string) => {
        setMessage(text);
        setIsEnhanced(false);
      },
    }));

    const handleTypewriterInit = (typewriter: any) => {
      typewriter
        .typeString("Create a personal website for me, I'm an engineer...")
        .changeDelay(50)
        .pauseFor(10)
        .deleteAll()
        .start();
    };

    return (
      <div className={cn('w-full border border-border', 'bg-card rounded-lg')}>
        {/* Typewriter */}
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              // Typing over the enhanced text makes the label stale.
              setIsEnhanced(false);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder=""
            rows={compact ? 3 : 5}
            className={cn(
              'w-full py-4 px-4 text-base leading-snug',
              compact ? 'min-h-[88px]' : 'min-h-[150px]',
              'bg-transparent rounded-t-lg focus:outline-none resize-none',
              'text-foreground placeholder:text-muted-foreground',
              'transition-shadow duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
            disabled={isLoading || isRegenerating}
          />
          {message === '' && !isLoading && !isRegenerating && !isFocused && (
            <div className="pointer-events-none text-muted-foreground text-base font-normal absolute top-4 left-4 right-4 overflow-hidden">
              <Typewriter onInit={handleTypewriterInit} />
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          {/* flex-wrap: three pickers side by side do not fit a 390px phone,
              and `min-w-0` only lets the ROW shrink — the triggers inside it
              are whitespace-nowrap, so they spilled past the card and the
              kind and style pickers ended up off-screen, unreachable. The
              outer row already wraps; this one has to as well.
              Each trigger also carries w-auto: the base SelectTrigger is
              w-full, and under flex-wrap that is a 100% flex basis — one
              picker per row, stacked, at every viewport width. */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* visibility */}
            <Select
              value={visibility}
              onValueChange={(value) =>
                !isLoading &&
                !isRegenerating &&
                setVisibility(value as 'public' | 'private')
              }
              disabled={isLoading || isRegenerating}
            >
              <SelectTrigger
                className={cn(
                  'h-9 w-auto px-3 text-sm font-medium border border-border',
                  'bg-secondary text-foreground',
                  'rounded-lg focus:outline-none hover:bg-accent',
                  'transition-all duration-200 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  (isLoading || isRegenerating) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                {visibility === 'public' ? (
                  <div className="flex items-center gap-2 font-semibold">
                    <Globe size={16} />
                    <span>Public</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 font-semibold">
                    <Lock size={16} />
                    <span>Private</span>
                  </div>
                )}
              </SelectTrigger>

              <SelectContent>
                <SelectItem
                  value="public"
                  className="p-3 rounded-lg transition hover:bg-accent"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Globe size={16} />
                    <span>Public</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Anyone can view this project
                  </p>
                </SelectItem>

                <SelectItem
                  value="private"
                  className="p-3 rounded-lg transition hover:bg-accent"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Lock size={16} />
                    <span>Private</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only you can access this project
                  </p>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Model — with a single deployment there is nothing to choose,
                same rule as the chat composer. */}
            {models.length > 1 && (
              <Select
                value={selectedModel}
                onValueChange={(value) =>
                  !isLoading && !isRegenerating && setSelectedModel(value)
                }
                disabled={isLoading || isRegenerating}
              >
                <SelectTrigger
                  className={cn(
                    'h-9 w-auto px-3 text-sm font-medium border border-border',
                    'bg-secondary text-foreground',
                    'rounded-lg focus:outline-none hover:bg-accent',
                    'transition-all duration-200 active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    (isLoading || isRegenerating) &&
                      'opacity-50 cursor-not-allowed'
                  )}
                >
                  {!isModelLoading ? <SelectValue /> : 'Loading...'}
                </SelectTrigger>
                <SelectContent>
                  {!isModelLoading ? (
                    models.map((model) => (
                      <SelectItem key={model} value={model}>
                        <div className="flex items-center gap-2">
                          <Cpu size={16} />
                          <span>{model}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <>Loading...</>
                  )}
                </SelectContent>
              </Select>
            )}

            {/* What you are making — not which toolchain. The scenario
                picks the kind and tells the agent the shape. */}
            <Select
              value={scenarioId}
              onValueChange={(value) =>
                !isLoading && !isRegenerating && setScenarioId(value)
              }
              disabled={isLoading || isRegenerating}
            >
              <SelectTrigger
                className={cn(
                  'h-9 w-auto px-3 text-sm font-medium border border-border',
                  'bg-secondary text-foreground',
                  'rounded-lg focus:outline-none hover:bg-accent',
                  'transition-all duration-200 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  (isLoading || isRegenerating) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                {/* Not <SelectValue/>: it clones the item's two-line content
                    (title + blurb) into the h-9 trigger and blows it up. */}
                <span className="whitespace-nowrap font-semibold">
                  {chosenScenario?.name ?? 'Landing page'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.blurb}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Style: the page's design system. Pages only — the Next
                starter ships with its own. Swatches over names: the point
                of a style is what it looks like. */}
            {isPage && designSystems.length > 0 && (
              <Select
                value={chosenStyle?.id ?? ''}
                onValueChange={(value) =>
                  !isLoading && !isRegenerating && setStyle(value)
                }
                disabled={isLoading || isRegenerating}
              >
                <SelectTrigger
                  className={cn(
                    'h-9 w-auto px-3 text-sm font-medium border border-border',
                    'bg-secondary text-foreground',
                    'rounded-lg focus:outline-none hover:bg-accent',
                    'transition-all duration-200 active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    // the base trigger's [&>span]:line-clamp-1 turns the child
                    // span into -webkit-box, stacking swatch over name
                    '[&>span]:!flex [&>span]:items-center [&>span]:gap-2',
                    (isLoading || isRegenerating) &&
                      'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="whitespace-nowrap">
                    <Swatch system={chosenStyle} />
                    <span className="font-semibold">{chosenStyle?.name}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <DesignSystemOptions systems={designSystems} />
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      'h-9 px-3 text-sm font-medium',
                      'bg-secondary hover:bg-accent text-foreground',
                      'border border-border',
                      'rounded-lg focus:outline-none',
                      'transform-gpu transition-all duration-200 active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      (isLoading || isRegenerating) &&
                        'opacity-50 cursor-not-allowed'
                    )}
                    onClick={handleMagicEnhance}
                    disabled={isLoading || isRegenerating}
                  >
                    <Sparkles
                      size={16}
                      className={cn(isRegenerating && 'animate-spin')}
                    />
                    {isEnhanced ? 'Enhanced' : 'Enhance'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>
                    {message.trim()
                      ? 'Regenerate & enhance'
                      : 'Magic enhance generation'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              className={cn(
                'h-9 px-4 text-sm font-medium text-primary-foreground rounded-lg',
                'bg-primary hover:opacity-90',
                'focus:outline-none transition-all duration-200 active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                (isLoading || isRegenerating) && 'opacity-50 cursor-not-allowed'
              )}
              onClick={handleSubmit}
              disabled={isLoading || isRegenerating}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="ml-1">Creating...</span>
                </>
              ) : (
                <>
                  <SendIcon size={16} />
                  <span className="ml-1">Create</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

PromptForm.displayName = 'PromptForm';
