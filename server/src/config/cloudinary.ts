import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'shedrive',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

/**
 * Uploads a base64 encoded image to Cloudinary with automatic compression & optimization.
 */
export async function uploadImage(
  base64Data: string,
  folder: string = 'shedrive/documents'
): Promise<{ url: string; publicId: string }> {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    throw new Error('Image upload failed');
  }
}

/**
 * Deletes an image resource from Cloudinary when user accounts or documents are removed.
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary deletion failed:', error);
    return false;
  }
}
