'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import PullModel from './pull-model';
import {
  AvatarFallback,
  AvatarImage,
  SmallAvatar,
} from '@/components/ui/avatar';
import { GearIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useMemo, useState, memo, useEffect } from 'react';
import { EventEnum } from '../const/EventEnum';
import { useAuthContext } from '@/providers/AuthProvider';
import { LogOut } from 'lucide-react';
import { normalizeAvatarUrl } from './avatar-uploader';

interface UserSettingsProps {
  isSimple: boolean;
}

/**
 * UserSettingsBar component for managing user settings and actions.
 *
 * @param param0 - Props for UserSettings, including isSimple flag.
 * @returns UserSettings JSX element.
 */
export const UserSettingsBar = ({ isSimple }: UserSettingsProps) => {
  const { user, isLoading, logout } = useAuthContext();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleLogout = useMemo(() => {
    return () => {
      router.push('/');
      // router.push('/login');
      logout();
    };
  }, [logout, router]);

  const avatarFallback = useMemo(() => {
    if (!user?.username) return 'US';
    return user.username.substring(0, 2).toUpperCase();
  }, [user?.username]);

  const displayUsername = useMemo(() => {
    if (isLoading) return 'Loading...';
    return user?.username || 'Anonymous';
  }, [isLoading, user?.username]);

  // Normalize the avatar URL
  const normalizedAvatarUrl = useMemo(() => {
    return normalizeAvatarUrl(user?.avatarUrl);
  }, [user?.avatarUrl]);

  const handleSettingsClick = () => {
    // First navigate using Next.js router
    router.push('/settings');

    // Then dispatch the event
    setTimeout(() => {
      const event = new Event(EventEnum.SETTING);
      window.dispatchEvent(event);
    }, 0);
  };

  const avatarButton = useMemo(() => {
    return (
      <Button
        size="setting"
        variant="ghost"
        className={`flex justify-start ${
          isSimple ? 'w-10 h-12 p-auto' : 'gap-2 w-full h-12 p-1'
        }`}
      >
        <SmallAvatar className="flex items-center justify-center">
          {/* Use normalized avatar URL */}
          <AvatarImage
            src={normalizedAvatarUrl}
            alt="User"
            key={user?.avatarUrl}
          />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </SmallAvatar>
      </Button>
    );
  }, [
    avatarFallback,
    displayUsername,
    isSimple,
    normalizedAvatarUrl,
    user?.avatarUrl,
  ]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{avatarButton}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <div
            className="flex w-full gap-2 p-1 items-center cursor-pointer"
            onClick={handleSettingsClick}
          >
            <GearIcon className="w-4 h-4" />
            Settings
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem className="">
          <div
            className="flex w-full gap-2 p-1 items-center cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" strokeWidth={1.4} />
            <span>Logout</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default memo(UserSettingsBar);
