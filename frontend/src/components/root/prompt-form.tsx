'use client';

import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { SendIcon, Sparkles, Globe, Lock, Loader2, Cpu } from 'lucide-react';
import Typewriter from 'typewriter-effect';
import {
  Select,
  SelectContent,
  SelectItem,
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
import { gql, useMutation } from '@apollo/client';
import { logger } from '@/app/log/logger';

export interface PromptFormRef {
  getPromptData: () => {
    message: string;
    isPublic: boolean;
    model: string;
  };
  clearMessage: () => void;
}

interface PromptFormProps {
  isAuthorized: boolean;
  onSubmit: () => void;
  onAuthRequired: () => void;
  isLoading?: boolean;
}

const REGENERATE_DESCRIPTION = gql`
  mutation RegenerateDescription($input: String!) {
    regenerateDescription(input: $input)
  }
`;

export const PromptForm = forwardRef<PromptFormRef, PromptFormProps>(
  function PromptForm(
    { isAuthorized, onSubmit, onAuthRequired, isLoading = false },
    ref
  ) {
    const [message, setMessage] = useState('');
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
          setIsRegenerating(false);
        },
        onError: (error) => {
          logger.error('Error regenerating description:', error);
          setIsRegenerating(false);
        },
      }
    );

    // 提交处理
    const handleSubmit = () => {
      if (isLoading || isRegenerating) return;
      if (!isAuthorized) {
        onAuthRequired();
      } else {
        onSubmit();
      }
    };

    // “魔法增强”功能
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
      setIsEnhanced(!isEnhanced);
    };

    // 键盘快捷键 (Alt+Enter / Ctrl+Enter / Command+Enter)
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
    }, [isAuthorized, isLoading, isRegenerating]);

    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
      getPromptData: () => ({
        message,
        isPublic: visibility === 'public',
        model: selectedModel,
      }),
      clearMessage: () => setMessage(''),
    }));

    // Typewriter 初始化
    const handleTypewriterInit = (typewriter: any) => {
      typewriter
        .typeString("Create a personal website for me, I'm an engineer...")
        .changeDelay(50)
        .pauseFor(10)
        .deleteAll()
        .start();
    };

    return (
      <div
        className={cn(
          // 大容器，包裹文本输入与底部按钮
          'w-full border border-gray-300 dark:border-gray-700',
          'bg-white dark:bg-gray-700 rounded-md'
        )}
      >
        {/* 文本输入区域 + Typewriter */}
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder=""
            rows={5}
            className={cn(
              'w-full min-h-[150px] py-4 px-4 text-base leading-snug',
              'bg-transparent rounded-t-md focus:outline-none resize-none',
              'dark:text-white dark:placeholder-gray-400'
            )}
            disabled={isLoading || isRegenerating}
          />
          {/* Typewriter 占位：当文本为空且未聚焦时显示 */}
          {message === '' && !isLoading && !isRegenerating && !isFocused && (
            <div className="pointer-events-none text-gray-500 dark:text-gray-400 text-base font-normal absolute top-4 left-4 right-4 overflow-hidden">
              <Typewriter onInit={handleTypewriterInit} />
            </div>
          )}
        </div>

        {/* 分割线（可选） */}
        <div className="border-t border-gray-300 dark:border-gray-600" />

        {/* 底部按钮区：Public/Private, Model, Enhance, Create */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* 左侧：选择可见性 & 模型 */}
          <div className="flex items-center gap-2">
            {/* Visibility */}
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
                  'h-9 px-3 text-sm font-medium border border-gray-300 dark:border-gray-600',
                  'bg-white dark:bg-gray-800 dark:text-gray-100',
                  'rounded-md focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700',
                  (isLoading || isRegenerating) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe size={16} />
                    <span>Public</span>
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock size={16} />
                    <span>Private</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Model */}
            <Select
              value={selectedModel}
              onValueChange={(value) =>
                !isLoading && !isRegenerating && setSelectedModel(value)
              }
              disabled={isLoading || isRegenerating}
            >
              <SelectTrigger
                className={cn(
                  'h-9 px-3 text-sm font-medium border border-gray-300 dark:border-gray-600',
                  'bg-white dark:bg-gray-800 dark:text-gray-100',
                  'rounded-md focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700',
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
          </div>

          {/* 右侧：Enhance & Create */}
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      'h-9 px-3 text-sm font-medium border border-gray-300 dark:border-gray-600',
                      'bg-white dark:bg-gray-800 dark:text-gray-100',
                      'text-black dark:text-white',
                      'rounded-md focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700',
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
                'h-9 px-4 text-sm font-medium text-white rounded-md',
                'bg-gradient-to-r from-primary-500 to-primary-600',
                'hover:from-primary-600 hover:to-primary-700',
                'focus:outline-none shadow-md hover:shadow-lg transition-all',
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
