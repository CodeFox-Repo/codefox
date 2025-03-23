import { gql, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { LocalStore } from '@/lib/storage';
import { GET_MODEL_TAGS } from '@/graphql/request';
import { useAuthContext } from '@/providers/AuthProvider';
import { logger } from '@/app/log/logger';

interface ModelsCache {
  models: string[];
  lastUpdate: number;
}
const CACHE_DURATION = 30 * 60 * 1000;
export const useModels = () => {
  const { isAuthorized } = useAuthContext();
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    undefined
  );

  const shouldUpdateCache = (): boolean => {
    try {
      const cachedData = sessionStorage.getItem(LocalStore.models);
      if (!cachedData) return true;
      const { lastUpdate } = JSON.parse(cachedData) as ModelsCache;
      const now = Date.now();
      return now - lastUpdate > CACHE_DURATION;
    } catch {
      return true;
    }
  };

  const getCachedModels = (): string[] => {
    try {
      const cachedData = sessionStorage.getItem(LocalStore.models);
      if (!cachedData) return [];
      const { models } = JSON.parse(cachedData) as ModelsCache;
      return models;
    } catch {
      return [];
    }
  };

  const updateCache = (models: string[]) => {
    const cacheData: ModelsCache = {
      models,
      lastUpdate: Date.now(),
    };
    sessionStorage.setItem(LocalStore.models, JSON.stringify(cacheData));
  };

  const { data, loading, error } = useQuery<{
    getAvailableModelTags: string[];
  }>(GET_MODEL_TAGS, {
    skip: !isAuthorized || !shouldUpdateCache(),
    onCompleted: (data) => {
      logger.info(data);
      if (data?.getAvailableModelTags) {
        updateCache(data.getAvailableModelTags);
      }
    },
  });

  if (error) {
    logger.info(error);
    toast.error('Failed to load models');
  }

  const currentModels = !shouldUpdateCache()
    ? getCachedModels()
    : data?.getAvailableModelTags || getCachedModels();

  // Update selectedModel when models are loaded
  useEffect(() => {
    if (currentModels.length > 0 && !selectedModel) {
      setSelectedModel(currentModels[0]);
    }
  }, [currentModels, selectedModel]);

  return {
    models: currentModels,
    loading,
    error,
    selectedModel,
    setSelectedModel,
  };
};
