import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Modal,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import type { UserStories, Story } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

interface StoryViewerProps {
  userStories: UserStories[];
  initialUserIndex: number;
  initialStoryIndex: number;
  onClose: () => void;
  onStoryViewed: (storyId: string) => void;
}

export function StoryViewer({
  userStories,
  initialUserIndex,
  initialStoryIndex,
  onClose,
  onStoryViewed,
}: StoryViewerProps) {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [isPaused, setIsPaused] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const currentUser = userStories[currentUserIndex];
  const currentStory = currentUser?.stories[currentStoryIndex];

  // Mark story as viewed when displayed
  useEffect(() => {
    if (currentStory && !currentStory.is_viewed) {
      onStoryViewed(currentStory.id);
    }
  }, [currentStory, onStoryViewed]);

  // Start progress animation
  const startProgress = useCallback(() => {
    progressAnim.setValue(0);
    progressAnimation.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    progressAnimation.current.start(({ finished }) => {
      if (finished) {
        goToNextStory();
      }
    });
  }, [progressAnim]);

  // Stop progress animation
  const stopProgress = useCallback(() => {
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }
  }, []);

  // Go to next story or next user
  const goToNextStory = useCallback(() => {
    if (currentStoryIndex < currentUser.stories.length - 1) {
      // Next story in current user
      setCurrentStoryIndex((prev) => prev + 1);
    } else if (currentUserIndex < userStories.length - 1) {
      // Next user
      setCurrentUserIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      // No more stories
      onClose();
    }
  }, [currentStoryIndex, currentUserIndex, currentUser, userStories.length, onClose]);

  // Go to previous story or previous user
  const goToPreviousStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      // Previous story in current user
      setCurrentStoryIndex((prev) => prev - 1);
    } else if (currentUserIndex > 0) {
      // Previous user - go to their last story
      const prevUserIndex = currentUserIndex - 1;
      setCurrentUserIndex(prevUserIndex);
      setCurrentStoryIndex(userStories[prevUserIndex].stories.length - 1);
    }
  }, [currentStoryIndex, currentUserIndex, userStories]);

  // Handle tap on left/right side
  const handleTap = (event: any) => {
    const x = event.nativeEvent.locationX;
    if (x < SCREEN_WIDTH / 3) {
      goToPreviousStory();
    } else if (x > (SCREEN_WIDTH * 2) / 3) {
      goToNextStory();
    }
  };

  // Handle long press (pause)
  const handlePressIn = () => {
    setIsPaused(true);
    stopProgress();
  };

  const handlePressOut = () => {
    setIsPaused(false);
    startProgress();
  };

  // Start/restart progress when story changes
  useEffect(() => {
    startProgress();
    return () => stopProgress();
  }, [currentUserIndex, currentStoryIndex, startProgress, stopProgress]);

  if (!currentUser || !currentStory) {
    return null;
  }

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Story Content */}
        <TouchableWithoutFeedback
          onPress={handleTap}
          onLongPress={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={200}
        >
          <View style={styles.storyContent}>
            {currentStory.media_type === 'video' ? (
              <Video
                source={{ uri: currentStory.media_url }}
                style={styles.media}
                resizeMode={ResizeMode.COVER}
                shouldPlay={!isPaused}
                isLooping={false}
                isMuted={false}
              />
            ) : (
              <Image
                source={{ uri: currentStory.media_url }}
                style={styles.media}
                resizeMode="cover"
              />
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Overlay Content */}
        <SafeAreaView style={styles.overlay} edges={['top']}>
          {/* Progress Bars */}
          <View style={styles.progressContainer}>
            {currentUser.stories.map((story, index) => (
              <View key={story.id} style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  {index < currentStoryIndex ? (
                    // Completed
                    <View style={[styles.progressBarFill, { width: '100%' }]} />
                  ) : index === currentStoryIndex ? (
                    // Current - animated
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              {currentUser.user.avatar ? (
                <Image
                  source={{ uri: currentUser.user.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={16} color="#94A3B8" />
                </View>
              )}
              <Text style={styles.userName}>{currentUser.user.name}</Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(currentStory.created_at)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Pause Indicator */}
        {isPaused && (
          <View style={styles.pauseIndicator}>
            <Ionicons name="pause" size={40} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </View>
    </Modal>
  );
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  storyContent: {
    flex: 1,
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingTop: 8,
    gap: 4,
  },
  progressBarContainer: {
    flex: 1,
    height: 3,
  },
  progressBarBackground: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  pauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },
});

export default StoryViewer;
