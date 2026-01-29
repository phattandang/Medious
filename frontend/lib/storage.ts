import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export type StorageBucket = 'posts' | 'stories' | 'avatars';

interface UploadResult {
  url: string;
  path: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
}

/**
 * Upload an image to Supabase Storage
 * @param uri Local file URI from image picker
 * @param bucket Storage bucket name
 * @param folder Optional subfolder within the bucket
 * @returns Public URL of the uploaded image
 */
export async function uploadImage(
  uri: string,
  bucket: StorageBucket = 'posts',
  folder: string = ''
): Promise<UploadResult> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 11);
    const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = folder
      ? `${folder}/${timestamp}_${randomId}.${extension}`
      : `${timestamp}_${randomId}.${extension}`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine content type
    const contentType = getContentType(extension);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, decode(base64), {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(error.message || 'Failed to upload image');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error(error.message || 'Failed to upload image');
  }
}

/**
 * Upload multiple images in parallel
 * @param uris Array of local file URIs
 * @param bucket Storage bucket name
 * @param folder Optional subfolder within the bucket
 * @param onProgress Optional progress callback
 * @returns Array of public URLs
 */
export async function uploadMultipleImages(
  uris: string[],
  bucket: StorageBucket = 'posts',
  folder: string = '',
  onProgress?: (progress: { completed: number; total: number }) => void
): Promise<string[]> {
  const results: string[] = [];
  let completed = 0;

  for (const uri of uris) {
    const result = await uploadImage(uri, bucket, folder);
    results.push(result.url);
    completed++;
    onProgress?.({ completed, total: uris.length });
  }

  return results;
}

/**
 * Upload a video to Supabase Storage
 * @param uri Local file URI from video picker
 * @param bucket Storage bucket name
 * @returns Object with video URL and thumbnail URL
 */
export async function uploadVideo(
  uri: string,
  bucket: StorageBucket = 'stories'
): Promise<{ videoUrl: string; thumbnailUrl?: string }> {
  try {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 11);
    const extension = uri.split('.').pop()?.toLowerCase() || 'mp4';
    const fileName = `${timestamp}_${randomId}.${extension}`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Upload video
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, decode(base64), {
        contentType: getContentType(extension),
        upsert: false,
      });

    if (error) {
      throw new Error(error.message || 'Failed to upload video');
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      videoUrl: urlData.publicUrl,
      thumbnailUrl: undefined, // Thumbnail generation would require additional processing
    };
  } catch (error: any) {
    console.error('Video upload error:', error);
    throw new Error(error.message || 'Failed to upload video');
  }
}

/**
 * Delete a file from Supabase Storage
 * @param path File path in the bucket
 * @param bucket Storage bucket name
 */
export async function deleteFile(
  path: string,
  bucket: StorageBucket
): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(error.message || 'Failed to delete file');
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(extension: string): string {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
  };

  return types[extension.toLowerCase()] || 'application/octet-stream';
}
