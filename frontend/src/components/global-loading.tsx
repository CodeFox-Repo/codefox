'use client';
import { FoxMark } from '@/components/root/fox-mark';

/**
 * The auth gate's cover while a stored session is validated. Branded and
 * quiet: a pulsing mark reads as "the product is coming", where a spinner
 * with "Loading..." read as a broken page whenever it lingered.
 */
export const LoadingPage = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <FoxMark className="h-12 w-12 animate-pulse" />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          codefox
        </p>
      </div>
    </div>
  );
};
