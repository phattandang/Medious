import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import { postsApi } from '../../lib/api';
import { colors } from '../../lib/theme';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export function CreatePostModal({
  visible,
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const { token, user } = useAuth();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  const {
    selectedImages,
    uploading,
    uploadProgress,
    pickFromGallery,
    pickFromCamera,
    removeImage,
    clearImages,
    uploadImages,
  } = useImageUpload({ maxImages: 4, bucket: 'posts' });

  const canPost = content.trim().length > 0 || selectedImages.length > 0;

  const handleSubmit = async () => {
    if (!token || !canPost) return;

    try {
      setPosting(true);

      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        imageUrls = await uploadImages();
      }

      await postsApi.createPost(token, content.trim(), imageUrls);

      setContent('');
      clearImages();
      onPostCreated();
    } catch (error: any) {
      console.error('Post creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create post.');
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    setContent('');
    clearImages();
    onClose();
  };

  const isLoading = posting || uploading;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={isLoading}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>New Post</Text>
            <TouchableOpacity
              style={[styles.postButton, !canPost && styles.postButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canPost || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Upload Progress */}
          {uploading && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Uploading images ({uploadProgress.completed}/{uploadProgress.total})
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* User Info */}
            <View style={styles.userInfo}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.userName}>{user?.name}</Text>
            </View>

            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textMuted}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={2000}
              editable={!isLoading}
            />

            {/* Selected Images */}
            {selectedImages.length > 0 && (
              <View style={styles.imagesContainer}>
                {selectedImages.map((uri, index) => (
                  <View key={uri} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.selectedImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                      disabled={isLoading}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={pickFromGallery}
              disabled={isLoading || selectedImages.length >= 4}
            >
              <Ionicons
                name="images-outline"
                size={24}
                color={selectedImages.length >= 4 ? colors.border : colors.primary}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  selectedImages.length >= 4 && styles.actionButtonTextDisabled,
                ]}
              >
                Gallery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={pickFromCamera}
              disabled={isLoading || selectedImages.length >= 4}
            >
              <Ionicons
                name="camera-outline"
                size={24}
                color={selectedImages.length >= 4 ? colors.border : colors.primary}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  selectedImages.length >= 4 && styles.actionButtonTextDisabled,
                ]}
              >
                Camera
              </Text>
            </TouchableOpacity>

            <Text style={styles.imageCount}>
              {selectedImages.length}/4 images
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  postButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: colors.border,
  },
  postButtonText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: 14,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.backgroundAlt,
  },
  progressText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  textInput: {
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  imageWrapper: {
    position: 'relative',
    width: '48%',
  },
  selectedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  actionButtonTextDisabled: {
    color: colors.border,
  },
  imageCount: {
    marginLeft: 'auto',
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default CreatePostModal;
