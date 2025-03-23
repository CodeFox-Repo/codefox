'use client';

import React, { useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPLOAD_AVATAR } from '../graphql/request';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useAuthContext } from '@/providers/AuthProvider';
import { logger } from '@/app/log/logger';

// Avatar URL normalization helper
export function normalizeAvatarUrl(
  avatarUrl: string | null | undefined
): string {
  if (!avatarUrl) return '';

  // Check if it's already an absolute URL (S3 case)
  if (avatarUrl.startsWith('https:') || avatarUrl.startsWith('http:')) {
    return avatarUrl;
  }

  // Check if it's a relative media path
  if (avatarUrl.startsWith('media/')) {
    // Convert to API route path
    return `/api/${avatarUrl}`;
  }

  // Handle paths that might not have the media/ prefix
  if (avatarUrl.includes('avatars/')) {
    const parts = avatarUrl.split('avatars/');
    return `/api/media/avatars/${parts[parts.length - 1]}`;
  }

  // Return as is for other cases
  return avatarUrl;
}

interface AvatarUploaderProps {
  currentAvatarUrl: string;
  avatarFallback: string;
  onAvatarChange: (newUrl: string) => void;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  currentAvatarUrl,
  avatarFallback,
  onAvatarChange,
}) => {
  const [uploadAvatar, { loading }] = useMutation(UPLOAD_AVATAR);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { refreshUserInfo } = useAuthContext();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size on client-side as well (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the maximum allowed limit (5MB)');
      return;
    }

    // Check file type on client-side
    const fileType = file.type;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(fileType)) {
      toast.error('Only JPEG, PNG, and WebP files are allowed');
      return;
    }

    // Create a preview URL
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const { data } = await uploadAvatar({
        variables: { file },
        context: {
          // Required for file uploads with Apollo Client
          headers: {
            'Apollo-Require-Preflight': 'true',
          },
        },
      });

      if (data?.uploadAvatar?.success) {
        // Store the original URL from backend
        const avatarUrl = data.uploadAvatar.avatarUrl;
        onAvatarChange(avatarUrl);
        toast.success('Avatar updated successfully');

        // Refresh the user information in the auth context
        await refreshUserInfo();
      }
    } catch (error) {
      logger.error('Error uploading avatar:', error);

      // Extract the error message if available
      let errorMessage = 'Failed to upload avatar';
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      }

      toast.error(errorMessage);
      setPreviewUrl(null);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Use preview URL if available, otherwise use the normalized current avatar URL
  const displayUrl = previewUrl || normalizeAvatarUrl(currentAvatarUrl);

  return (
    <button
      onClick={triggerFileInput}
      disabled={loading}
      className="flex justify-end"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <div className="relative group">
        <Avatar
          className="w-24 h-24 cursor-pointer transition-opacity hover:opacity-80"
          onClick={triggerFileInput}
        >
          <AvatarImage src={displayUrl} alt="User Avatar" />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 rounded-full transition-opacity">
          <span className="text-white text-sm">Upload</span>
        </div>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </button>
  );
};
