import React, { useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { DownloadIcon, GearIcon } from '@radix-ui/react-icons';
import PullModelForm from './pull-model-form';
import UserSetting from './settings/settings';

export default function DetailSettings() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="w-full">
        <div className="flex w-full gap-2 p-1 items-center cursor-pointer">
          <GearIcon className="w-4 h-4" />
          Settings
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="space-y-4">
          <DialogTitle>Settings</DialogTitle>
          <UserSetting />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
