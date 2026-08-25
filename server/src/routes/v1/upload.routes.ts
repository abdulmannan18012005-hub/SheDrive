import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { uploadImage, deleteImage } from '../../config/cloudinary';
import { uploadRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

const ALLOWED_FOLDERS = new Set([
  'shedrive/documents',
  'shedrive/avatars',
  'shedrive/vehicles',
  'shedrive/receipts',
  'shedrive/support',
]);

const MAX_BASE64_LENGTH = 14 * 1024 * 1024; // ~10MB decoded file size limit

// Upload CNIC or Document
router.post('/document', authenticateToken, uploadRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { base64Data, folder } = req.body;
    if (!base64Data || typeof base64Data !== 'string') {
      return res.status(400).json({ error: 'Valid base64 image data is required' });
    }

    // Enforce payload size limit to prevent memory exhaustion
    if (base64Data.length > MAX_BASE64_LENGTH) {
      return res.status(413).json({ error: 'Payload too large. Maximum image file size is 10MB.' });
    }

    // Validate folder parameter against strict whitelist
    const targetFolder = (folder && ALLOWED_FOLDERS.has(folder)) ? folder : 'shedrive/documents';

    // Verify image header or data uri format
    const isDataUri = base64Data.startsWith('data:image/');
    const isRawBase64 = /^[A-Za-z0-9+/=]+$/.test(base64Data.substring(0, 100));
    if (!isDataUri && !isRawBase64) {
      return res.status(400).json({ error: 'Invalid image data format. Only JPEG, PNG, and WebP images are permitted.' });
    }

    const result = await uploadImage(base64Data, targetFolder);
    res.status(200).json({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error: any) {
    console.error('Document upload endpoint error:', error?.message || error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Delete Document resource
router.delete('/document', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId } = req.body;
    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({ error: 'Valid Public ID string is required' });
    }

    // Verify publicId belongs to shedrive namespace
    if (!publicId.startsWith('shedrive/')) {
      return res.status(403).json({ error: 'Invalid document resource identifier' });
    }

    const success = await deleteImage(publicId);
    res.status(200).json({ success });
  } catch (error: any) {
    console.error('Document deletion error:', error?.message || error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
