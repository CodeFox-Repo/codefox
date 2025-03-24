// components/rate-limit-modal.tsx
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface RateLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  limit?: number;
}

export const RateLimitModal = ({
  isOpen,
  onClose,
  limit = 3,
}: RateLimitModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Daily Limit Reached</DialogTitle>
          </div>
          <DialogDescription>
            You've reached your daily project creation limit.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-4">
            Your current plan allows creating up to {limit} projects per day.
            This limit resets at midnight UTC.
          </p>
          <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Try editing or reusing one of your existing projects, or wait
              until tomorrow to create a new one.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>I understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
