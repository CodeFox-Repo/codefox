'use client';
import { Button } from '@/components/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface SaveChangesBarProps {
  onSave: () => void;
  onReset: () => void;
}

const SaveChangesBar = ({ onSave, onReset }: SaveChangesBarProps) => {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 flex flex-wrap items-center justify-end gap-2 rounded-2xl border bg-background p-2 shadow sm:left-auto">
      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
      <span className="text-sm text-foreground">Unsaved changes</span>
      <Button
        variant="outline"
        className="px-3 py-1 text-sm font-medium rounded-full"
        onClick={onReset}
      >
        Discard changes
      </Button>
      <Button
        variant="default"
        className="px-4 py-1 text-sm font-medium rounded-full"
        onClick={onSave}
      >
        Save file
      </Button>
    </div>
  );
};

export default SaveChangesBar;
