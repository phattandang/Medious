import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import type { UserStories } from '../../types';

interface StoriesCarouselProps {
  userStories: UserStories[];
  currentUserId?: string;
  loading?: boolean;
  onStoryPress: (userId: string, storyIndex?: number) => void;
  onAddStoryPress: () => void;
}

export function StoriesCarousel({
  userStories,
  currentUserId,
  loading = false,
  onStoryPress,
  onAddStoryPress,
}: StoriesCarouselProps) {
  const currentUserStories = userStories.find(
    (us) => us.user.id === currentUserId
  );

  const renderAddStoryButton = () => (
    <TouchableOpacity
      style={styles.storyItem}
      onPress={() => {
        if (currentUserStories && currentUserStories.stories.length > 0) {
          onStoryPress(currentUserStories.user.id);
        } else {
          onAddStoryPress();
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.addStoryContainer}>
        {currentUserStories ? (
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            style={styles.gradientRing}
          >
            <View style={styles.avatarContainer}>
              {currentUserStories.user.avatar ? (
                <Image
                  source={{ uri: currentUserStories.user.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={24} color={colors.textMuted} />
                </View>
              )}
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.addIconContainer}>
            <Ionicons name="add" size={28} color={colors.primary} />
          </View>
        )}
        <View style={styles.addBadge}>
          <Ionicons name="add" size={12} color={colors.textInverse} />
        </View>
      </View>
      <Text style={styles.storyName} numberOfLines={1}>
        Your Story
      </Text>
    </TouchableOpacity>
  );

  const renderStoryItem = ({ item }: { item: UserStories }) => {
    if (item.user.id === currentUserId) return null;

    return (
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => onStoryPress(item.user.id)}
        activeOpacity={0.7}
      >
        {item.has_unviewed ? (
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            style={styles.gradientRing}
          >
            <View style={styles.avatarContainer}>
              {item.user.avatar ? (
                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={24} color={colors.textMuted} />
                </View>
              )}
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.viewedRing}>
            <View style={styles.avatarContainer}>
              {item.user.avatar ? (
                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={24} color={colors.textMuted} />
                </View>
              )}
            </View>
          </View>
        )}
        <Text style={styles.storyName} numberOfLines={1}>
          {item.user.name.split(' ')[0]}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading && userStories.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={userStories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.user.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        ListHeaderComponent={renderAddStoryButton}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  loadingContainer: {
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 0,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  addStoryContainer: {
    position: 'relative',
  },
  gradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewedRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.surface,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  storyName: {
    fontSize: 12,
    color: colors.text,
    marginTop: 6,
    textAlign: 'center',
  },
});

export default StoriesCarousel;
