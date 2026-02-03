import Constants from 'expo-constants';
import type {
  PaginatedPosts,
  Post,
  UserStories,
  Story,
  NearbyUser,
  SearchResults,
  Event,
  Comment,
} from '../types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.backendUrl;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  token?: string | null;
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Skip ngrok interstitial page
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, config);

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new ApiError(error.detail || 'Request failed', response.status);
    }
    throw new ApiError(`Server error: ${response.status}`, response.status);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text);
}

// ============= POSTS API =============
export const postsApi = {
  getFeed: (token: string, cursor?: string, limit: number = 20) =>
    apiRequest<PaginatedPosts>(
      `/api/posts?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`,
      { token }
    ),

  createPost: (token: string, content: string, images: string[] = []) =>
    apiRequest<Post>('/api/posts', {
      method: 'POST',
      body: { content, images },
      token,
    }),

  likePost: (token: string, postId: string) =>
    apiRequest<{ message: string; is_liked: boolean }>(
      `/api/posts/${postId}/like`,
      { method: 'POST', token }
    ),

  getComments: (token: string, postId: string) =>
    apiRequest<Comment[]>(`/api/posts/${postId}/comments`, { token }),

  addComment: (token: string, postId: string, content: string) =>
    apiRequest<Comment>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: { content },
      token,
    }),
};

// ============= STORIES API =============
export const storiesApi = {
  getFeed: (token: string) =>
    apiRequest<UserStories[]>('/api/stories/feed', { token }),

  createStory: (
    token: string,
    mediaType: 'image' | 'video',
    mediaUrl: string,
    thumbnailUrl?: string
  ) =>
    apiRequest<Story>('/api/stories', {
      method: 'POST',
      body: {
        media_type: mediaType,
        media_url: mediaUrl,
        thumbnail_url: thumbnailUrl,
      },
      token,
    }),

  markViewed: (token: string, storyId: string) =>
    apiRequest<{ message: string }>(`/api/stories/${storyId}/view`, {
      method: 'POST',
      token,
    }),

  deleteStory: (token: string, storyId: string) =>
    apiRequest<{ message: string }>(`/api/stories/${storyId}`, {
      method: 'DELETE',
      token,
    }),
};

// ============= USERS API =============
export const usersApi = {
  getProfile: (token: string) =>
    apiRequest<any>('/api/users/profile', { token }),

  updateProfile: (
    token: string,
    data: {
      name?: string;
      avatar?: string;
      bio?: string;
      location_sharing_enabled?: boolean;
    }
  ) =>
    apiRequest<any>('/api/users/profile', {
      method: 'PUT',
      body: data,
      token,
    }),

  getUser: (token: string, userId: string) =>
    apiRequest<any>(`/api/users/${userId}`, { token }),

  followUser: (token: string, userId: string) =>
    apiRequest<{ message: string; is_following: boolean }>(
      `/api/users/${userId}/follow`,
      { method: 'POST', token }
    ),

  getFollowers: (token: string, userId: string) =>
    apiRequest<{ followers: any[] }>(`/api/users/${userId}/followers`, { token }),

  getFollowing: (token: string, userId: string) =>
    apiRequest<{ following: any[] }>(`/api/users/${userId}/following`, { token }),
};

// ============= LOCATION API =============
export const locationApi = {
  updateLocation: (token: string, latitude: number, longitude: number) =>
    apiRequest<{ message: string }>('/api/users/location', {
      method: 'PUT',
      body: { latitude, longitude },
      token,
    }),

  toggleLocationSharing: (token: string, enabled: boolean) =>
    apiRequest<{ message: string }>(
      `/api/users/location-sharing?enabled=${enabled}`,
      { method: 'PUT', token }
    ),

  getNearbyUsers: (
    token: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    limit: number = 50
  ) =>
    apiRequest<NearbyUser[]>(
      `/api/users/nearby?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}&limit=${limit}`,
      { token }
    ),
};

// ============= SEARCH API =============
export const searchApi = {
  search: (token: string, query: string, type: 'all' | 'users' | 'events' = 'all') =>
    apiRequest<SearchResults>(
      `/api/search?q=${encodeURIComponent(query)}&type=${type}`,
      { token }
    ),
};

// ============= EVENTS API =============
export const eventsApi = {
  getEvents: (
    token: string,
    options?: {
      latitude?: number;
      longitude?: number;
      radius?: number;
      category?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (options?.latitude) params.append('latitude', options.latitude.toString());
    if (options?.longitude) params.append('longitude', options.longitude.toString());
    if (options?.radius) params.append('radius', options.radius.toString());
    if (options?.category) params.append('category', options.category);
    const queryString = params.toString();
    return apiRequest<Event[]>(
      `/api/events${queryString ? `?${queryString}` : ''}`,
      { token }
    );
  },

  getEvent: (token: string, eventId: string) =>
    apiRequest<Event>(`/api/events/${eventId}`, { token }),

  createEvent: (token: string, eventData: any) =>
    apiRequest<Event>('/api/events', {
      method: 'POST',
      body: eventData,
      token,
    }),

  rsvpEvent: (token: string, eventId: string) =>
    apiRequest<{ message: string; is_attending: boolean }>(
      `/api/events/${eventId}/rsvp`,
      { method: 'POST', token }
    ),

  getAttendees: (token: string, eventId: string) =>
    apiRequest<{ attendees: any[] }>(`/api/events/${eventId}/attendees`, { token }),
};

// ============= MESSAGES API =============
export const messagesApi = {
  getConversations: (token: string) =>
    apiRequest<{ conversations: any[] }>('/api/messages/conversations', { token }),

  getMessages: (token: string, userId: string) =>
    apiRequest<any[]>(`/api/messages/${userId}`, { token }),

  sendMessage: (token: string, receiverId: string, content: string) =>
    apiRequest<any>('/api/messages', {
      method: 'POST',
      body: { receiver_id: receiverId, content },
      token,
    }),
};

export { ApiError };
