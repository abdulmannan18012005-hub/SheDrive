import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { uploadImage, deleteImage } from '../../config/cloudinary';

const router = Router();

// Upload CNIC or Document
router.post('/document', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { base64Data, folder } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Base64 image data is required' });
    }

    const result = await uploadImage(base64Data, folder || 'shedrive/documents');
    res.status(200).json({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error('Document upload endpoint error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Delete Document resource
router.delete('/document', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: 'Public ID is required' });
    }

    const success = await deleteImage(publicId);
    res.status(200).json({ success });
  } catch (error) {
    console.error('Document deletion error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
