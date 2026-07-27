'use client';
import React from 'react';
import { cn } from '@/lib/utils';

export const BackgroundGradient = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'relative background-gradient group/card dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-background',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
BackgroundGradient.displayName = 'BackgroundGradient';
