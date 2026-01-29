// ============= USER TYPES =============
export interface User {
  id: string;
  email: string;
  name: string;
  auth_provider: string;
  avatar?: string;
  bio?: string;
  followers_count?: number;
  following_count?: number;
  location_sharing_enabled?: boolean;
  created_at: string;
}

// ============= POST TYPES =============
export interface Post {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  images: string[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
}

export interface PaginatedPosts {
  posts: Post[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface Comment {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  created_at: string;
}

// ============= STORY TYPES =============
export interface Story {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url?: string;
  views_count: number;
  is_viewed: boolean;
  created_at: string;
  expires_at: string;
}

export interface UserStories {
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  stories: Story[];
  has_unviewed: boolean;
}

// ============= EVENT TYPES =============
export interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  location_name: string;
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  price: number;
  is_free: boolean;
  max_participants?: number;
  requirements?: string;
  images: string[];
  host: {
    id: string;
    name: string;
    avatar?: string;
  };
  attendees_count: number;
  is_attending: boolean;
  created_at: string;
}

// ============= LOCATION TYPES =============
export interface NearbyUser {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  distance_km: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

// ============= SEARCH TYPES =============
export interface SearchResults {
  users?: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
    bio?: string;
    followers_count: number;
    following_count: number;
  }>;
  events?: Array<{
    id: string;
    title: string;
    category: string;
    location_name: string;
    start_date: string;
    host: {
      id: string;
      name: string;
      avatar?: string;
    };
    attendees_count: number;
  }>;
}

// ============= MESSAGE TYPES =============
export interface Message {
  id: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  receiver: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  read: boolean;
  created_at: string;
}

export interface Conversation {
  partner: {
    id: string;
    name: string;
    avatar?: string;
  };
  last_message: string;
  last_message_time: string;
  unread_count: number;
}
