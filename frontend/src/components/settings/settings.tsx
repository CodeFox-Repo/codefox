'use client';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useMemo, useState } from 'react';
import { ModeToggle } from '../mode-toggle';
import { toast } from 'sonner';
import { ActivityCalendar } from 'react-activity-calendar';
import { TeamSelector } from '../team-selector';
import { useQuery } from '@apollo/client';
import { AvatarUploader } from '../avatar-uploader';
import { useAuthContext } from '@/providers/AuthProvider';

const data = [
  {
    date: '2024-01-01',
    count: 2,
    level: 0,
  },
  {
    date: '2024-06-23',
    count: 2,
    level: 1,
  },
  {
    date: '2024-08-02',
    count: 16,
    level: 4,
  },
  {
    date: '2024-11-29',
    count: 11,
    level: 3,
  },
  {
    date: '2024-12-29',
    count: 11,
    level: 0,
  },
];

const formSchema = z.object({
  username: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
});

export default function UserSetting() {
  const [name, setName] = useState('');
  const { user, isLoading } = useAuthContext();
  const [avatarUrl, setAvatarUrl] = useState('');

  const avatarFallback = useMemo(() => {
    if (!name) return 'US';
    return name.substring(0, 2).toUpperCase();
  }, [name]);

  useEffect(() => {
    if (user) {
      setName(user.username || 'Anonymous');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    localStorage.setItem('ollama_user', values.username);
    window.dispatchEvent(new Event('storage'));
    toast.success('Name updated successfully');
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    form.setValue('username', e.currentTarget.value);
    setName(e.currentTarget.value);
  };

  const handleAvatarChange = (newUrl: string) => {
    setAvatarUrl(newUrl);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold mb-8">User Settings</h1>
        <div className="w-[100%] flex justify-center">
          <ActivityCalendar data={data} blockSize={12} blockMargin={5} />
        </div>
        {/* Profile Picture Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Profile Picture</h2>
          <div className="flex justify-center gap-4 px-2">
            <AvatarUploader
              currentAvatarUrl={avatarUrl}
              avatarFallback={avatarFallback}
              onAvatarChange={handleAvatarChange}
            />
          </div>
        </div>
        <div className="bg-border h-px" />

        {/* Username and Description Section */}
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Profile Information</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <FormLabel>Username</FormLabel>
                        <p className="text-muted-foreground">
                          Select your interface color scheme.
                        </p>
                      </div>
                      <div className="w-[200px]">
                        {' '}
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            value={name}
                            className="w-full rounded-[10px]"
                            onChange={(e) => handleChange(e)}
                          />
                        </FormControl>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <div className="h-px bg-border" />

        {/* Interface Theme Section */}
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Interface Theme</h2>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              Select your interface color scheme.
            </p>
            <ModeToggle />
          </div>
        </div>

        <div className="h-px bg-border" />
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Default Team</h2>
          <div className="flex items-center justify-between">
            <p className="w-[50%] text-muted-foreground">
              New projects and deployments from your personal scope will be
              created in the codesfox team.
            </p>
            <TeamSelector />
          </div>
        </div>
      </div>
    </div>
  );
}
