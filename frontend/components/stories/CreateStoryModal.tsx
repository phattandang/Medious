import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { uploadImage } from '../../lib/storage';
import { storiesApi } from '../../lib/api';
import { colors } from '../../lib/theme';

interface CreateStoryModalProps {
  visible: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
}

export function CreateStoryModal({
  visible,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const { token } = useAuth();
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: 'image' | 'video';
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedMedia({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
        });
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick media from gallery.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your camera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedMedia({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
        });
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  const handleSubmit = async () => {
    if (!selectedMedia || !token) return;

    try {
      setUploading(true);

      // Upload media to Supabase Storage
      const result = await uploadImage(selectedMedia.uri, 'stories');

      // Create story in backend
      await storiesApi.createStory(token, selectedMedia.type, result.url);

      // Reset and close
      setSelectedMedia(null);
      onStoryCreated();
    } catch (error: any) {
      console.error('Story creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create story.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedMedia(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>New Story</Text>
          <TouchableOpacity
            style={[styles.postButton, !selectedMedia && styles.postButtonDisabled]}
            onPress={handleSubmit}
            disabled={!selectedMedia || uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.postButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        {selectedMedia ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: selectedMedia.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setSelectedMedia(null)}
            >
              <Ionicons name="close-circle" size={32} color={colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={takePhoto}>
              <View style={styles.optionIcon}>
                <Ionicons name="camera" size={32} color={colors.primary} />
              </View>
              <Text style={styles.optionText}>Take Photo</Text>
              <Text style={styles.optionSubtext}>Use your camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionButton} onPress={pickFromGallery}>
              <View style={styles.optionIcon}>
                <Ionicons name="images" size={32} color={colors.primary} />
              </View>
              <Text style={styles.optionText}>Choose from Gallery</Text>
              <Text style={styles.optionSubtext}>Select an existing photo or video</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingHorizontal: 16,
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
  previewContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.backgroundAlt,
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  optionButton: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default CreateStoryModal;
