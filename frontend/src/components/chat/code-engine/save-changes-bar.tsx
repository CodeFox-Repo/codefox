'use client';
import { Button } from '@/components/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface SaveChangesBarProps {
  onSave: () => void;
  onReset: () => void;
}

const SaveChangesBar = ({ onSave, onReset }: SaveChangesBarProps) => {
  return (
    <div className="fixed bottom-4 right-4 flex items-center space-x-2 p-2 border rounded-full shadow bg-background">
      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
      <span className="text-sm text-foreground">Unsaved Changes</span>
      <Button
        variant="outline"
        className="px-3 py-1 text-sm font-medium rounded-full"
        onClick={onReset}
      >
        Reset
      </Button>
      <Button
        variant="default"
        className="px-4 py-1 text-sm font-medium rounded-full"
        onClick={onSave}
      >
        Save
      </Button>
    </div>
  );
};

export default SaveChangesBar;
