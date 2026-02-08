import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useStories } from '../../hooks/useStories';
import { postsApi } from '../../lib/api';
import { colors } from '../../lib/theme';
import { LoadingFooter } from '../../components/common/LoadingFooter';
import { StoriesCarousel } from '../../components/stories/StoriesCarousel';
import { StoryViewer } from '../../components/stories/StoryViewer';
import { CreatePostModal } from '../../components/posts/CreatePostModal';
import { CreateStoryModal } from '../../components/stories/CreateStoryModal';
import type { Post } from '../../types';

export default function FeedScreen() {
  const { token, user } = useAuth();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState<{
    visible: boolean;
    userIndex: number;
    storyIndex: number;
  }>({ visible: false, userIndex: 0, storyIndex: 0 });

  // Infinite scroll for posts
  const {
    items: posts,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    loadMore,
    refresh,
    setItems: setPosts,
  } = useInfiniteScroll<Post>({
    fetchFn: async (cursor?: string) => {
      if (!token) throw new Error('Not authenticated');
      const response = await postsApi.getFeed(token, cursor);
      return {
        items: response.posts,
        nextCursor: response.next_cursor,
        hasMore: response.has_more,
      };
    },
    enabled: !!token,
  });

  // Stories
  const {
    userStories,
    loading: storiesLoading,
    refreshStories,
    markStoryViewed,
  } = useStories({ token, autoFetch: true });

  const handleLike = async (postId: string) => {
    if (!token) return;

    try {
      const response = await postsApi.likePost(token, postId);
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              is_liked: response.is_liked,
              likes_count: response.is_liked
                ? post.likes_count + 1
                : post.likes_count - 1,
            };
          }
          return post;
        })
      );
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleStoryPress = useCallback(
    (userId: string, storyIndex: number = 0) => {
      const userIndex = userStories.findIndex((us) => us.user.id === userId);
      if (userIndex !== -1) {
        setStoryViewerData({
          visible: true,
          userIndex,
          storyIndex,
        });
      }
    },
    [userStories]
  );

  const handleAddStoryPress = useCallback(() => {
    setShowCreateStory(true);
  }, []);

  const handleStoryCreated = useCallback(async () => {
    setShowCreateStory(false);
    await refreshStories();
  }, [refreshStories]);

  const handlePostCreated = useCallback(async () => {
    setShowCreatePost(false);
    await refresh();
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshStories()]);
  }, [refresh, refreshStories]);

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          {item.user.avatar ? (
            <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color={colors.textMuted} />
            </View>
          )}
          <Text style={styles.userName}>{item.user.name}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text style={styles.postContent}>{item.content}</Text>

      {/* Post Images */}
      {item.images.length > 0 && (
        <View style={styles.imagesContainer}>
          {item.images.length === 1 ? (
            <Image source={{ uri: item.images[0] }} style={styles.postImage} />
          ) : (
            <FlatList
              data={item.images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => `${item.id}-img-${index}`}
              renderItem={({ item: imageUri }) => (
                <Image source={{ uri: imageUri }} style={styles.postImage} />
              )}
            />
          )}
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Ionicons
            name={item.is_liked ? 'heart' : 'heart-outline'}
            size={24}
            color={item.is_liked ? colors.like : colors.textMuted}
          />
          <Text style={[styles.actionText, item.is_liked && { color: colors.like }]}>
            {item.likes_count}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={24} color={colors.textMuted} />
          <Text style={styles.actionText}>{item.comments_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity>
          <Ionicons name="bookmark-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeader = () => (
    <StoriesCarousel
      userStories={userStories}
      currentUserId={user?.id}
      loading={storiesLoading}
      onStoryPress={handleStoryPress}
      onAddStoryPress={handleAddStoryPress}
    />
  );

  const renderFooter = () => (
    <LoadingFooter loading={loadingMore} hasMore={hasMore} />
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyText}>No posts yet</Text>
        <Text style={styles.emptySubtext}>Follow users to see their posts</Text>
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />

      {/* Story Viewer Modal */}
      {storyViewerData.visible && (
        <StoryViewer
          userStories={userStories}
          initialUserIndex={storyViewerData.userIndex}
          initialStoryIndex={storyViewerData.storyIndex}
          onClose={() =>
            setStoryViewerData({ visible: false, userIndex: 0, storyIndex: 0 })
          }
          onStoryViewed={markStoryViewed}
        />
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Create Story Modal */}
      <CreateStoryModal
        visible={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onStoryCreated={handleStoryCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  postContent: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  imagesContainer: {
    marginBottom: 12,
    marginHorizontal: -16,
  },
  postImage: {
    width: '100%',
    height: 300,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
});
