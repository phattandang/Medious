import { useState, useCallback, useEffect } from 'react';
import { storiesApi } from '../lib/api';
import type { UserStories, Story } from '../types';

interface UseStoriesOptions {
  token: string | null;
  autoFetch?: boolean;
}

interface UseStoriesReturn {
  userStories: UserStories[];
  loading: boolean;
  error: string | null;
  refreshStories: () => Promise<void>;
  markStoryViewed: (storyId: string) => Promise<void>;
  createStory: (
    mediaType: 'image' | 'video',
    mediaUrl: string,
    thumbnailUrl?: string
  ) => Promise<Story>;
  deleteStory: (storyId: string) => Promise<void>;
}

export function useStories(options: UseStoriesOptions): UseStoriesReturn {
  const { token, autoFetch = true } = options;

  const [userStories, setUserStories] = useState<UserStories[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stories feed
  const refreshStories = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const stories = await storiesApi.getFeed(token);
      setUserStories(stories);
    } catch (err: any) {
      setError(err.message || 'Failed to load stories');
      console.error('Stories fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Mark story as viewed
  const markStoryViewed = useCallback(
    async (storyId: string) => {
      if (!token) return;

      try {
        await storiesApi.markViewed(token, storyId);

        // Update local state
        setUserStories((prev) =>
          prev.map((userStory) => ({
            ...userStory,
            stories: userStory.stories.map((story) =>
              story.id === storyId ? { ...story, is_viewed: true } : story
            ),
            has_unviewed: userStory.stories.some(
              (s) => s.id !== storyId && !s.is_viewed
            ),
          }))
        );
      } catch (err: any) {
        console.error('Mark viewed error:', err);
        // Don't throw, as this is a non-critical operation
      }
    },
    [token]
  );

  // Create new story
  const createStory = useCallback(
    async (
      mediaType: 'image' | 'video',
      mediaUrl: string,
      thumbnailUrl?: string
    ): Promise<Story> => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      try {
        setError(null);
        const story = await storiesApi.createStory(
          token,
          mediaType,
          mediaUrl,
          thumbnailUrl
        );

        // Refresh stories to include the new one
        await refreshStories();

        return story;
      } catch (err: any) {
        setError(err.message || 'Failed to create story');
        throw err;
      }
    },
    [token, refreshStories]
  );

  // Delete story
  const deleteStory = useCallback(
    async (storyId: string) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      try {
        setError(null);
        await storiesApi.deleteStory(token, storyId);

        // Update local state
        setUserStories((prev) =>
          prev
            .map((userStory) => ({
              ...userStory,
              stories: userStory.stories.filter((s) => s.id !== storyId),
            }))
            .filter((userStory) => userStory.stories.length > 0)
        );
      } catch (err: any) {
        setError(err.message || 'Failed to delete story');
        throw err;
      }
    },
    [token]
  );

  // Auto-fetch on mount (only when token exists)
  useEffect(() => {
    if (autoFetch && token) {
      refreshStories();
    } else if (!token) {
      // No token, just stop loading
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, token]);

  return {
    userStories,
    loading,
    error,
    refreshStories,
    markStoryViewed,
    createStory,
    deleteStory,
  };
}

export default useStories;
