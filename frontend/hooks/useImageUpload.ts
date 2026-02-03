import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { uploadMultipleImages, StorageBucket } from '../lib/storage';

interface UseImageUploadOptions {
  maxImages?: number;
  bucket?: StorageBucket;
  folder?: string;
}

interface UseImageUploadReturn {
  selectedImages: string[];
  uploading: boolean;
  uploadProgress: { completed: number; total: number };
  error: string | null;
  pickFromGallery: () => Promise<void>;
  pickFromCamera: () => Promise<void>;
  removeImage: (index: number) => void;
  clearImages: () => void;
  uploadImages: () => Promise<string[]>;
}

export function useImageUpload(
  options: UseImageUploadOptions = {}
): UseImageUploadReturn {
  const { maxImages = 4, bucket = 'posts', folder = '' } = options;

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Request permission for media library
  const requestMediaPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access media library is required');
      return false;
    }
    return true;
  }, []);

  // Request permission for camera
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access camera is required');
      return false;
    }
    return true;
  }, []);

  // Pick images from gallery
  const pickFromGallery = useCallback(async () => {
    try {
      setError(null);

      const hasPermission = await requestMediaPermission();
      if (!hasPermission) return;

      const remainingSlots = maxImages - selectedImages.length;
      if (remainingSlots <= 0) {
        setError(`Maximum ${maxImages} images allowed`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newImages = result.assets.map((asset) => asset.uri);
        setSelectedImages((prev) => [...prev, ...newImages].slice(0, maxImages));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to pick images');
      console.error('Gallery picker error:', err);
    }
  }, [maxImages, selectedImages.length, requestMediaPermission]);

  // Take photo with camera
  const pickFromCamera = useCallback(async () => {
    try {
      setError(null);

      if (selectedImages.length >= maxImages) {
        setError(`Maximum ${maxImages} images allowed`);
        return;
      }

      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        setSelectedImages((prev) => [...prev, result.assets[0].uri].slice(0, maxImages));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to take photo');
      console.error('Camera error:', err);
    }
  }, [maxImages, selectedImages.length, requestCameraPermission]);

  // Remove image at index
  const removeImage = useCallback((index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all images
  const clearImages = useCallback(() => {
    setSelectedImages([]);
    setError(null);
  }, []);

  // Upload all selected images
  const uploadImages = useCallback(async (): Promise<string[]> => {
    if (selectedImages.length === 0) {
      return [];
    }

    try {
      setUploading(true);
      setError(null);
      setUploadProgress({ completed: 0, total: selectedImages.length });

      const urls = await uploadMultipleImages(
        selectedImages,
        bucket,
        folder,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      return urls;
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
      console.error('Upload error:', err);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [selectedImages, bucket, folder]);

  return {
    selectedImages,
    uploading,
    uploadProgress,
    error,
    pickFromGallery,
    pickFromCamera,
    removeImage,
    clearImages,
    uploadImages,
  };
}

export default useImageUpload;
