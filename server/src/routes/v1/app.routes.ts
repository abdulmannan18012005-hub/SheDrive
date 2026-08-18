import { Router, Request, Response } from 'express';

const router = Router();

// Configure production Object Storage / CDN release URL
const DEFAULT_CDN_URL = process.env.APK_DOWNLOAD_CDN_URL || 
  'https://bulntofrddglxyxhtykf.supabase.co/storage/v1/object/public/releases/SheDrive-latest.apk';

/**
 * GET /api/v1/app/info
 * Returns current public release metadata
 */
router.get('/info', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    appName: 'SheDrive',
    packageName: 'com.shedrive.app',
    version: '1.0.0',
    versionCode: 1,
    releaseDate: 'August 2026',
    fileSize: '80.0 MB',
    minAndroidVersion: '8.0 (Oreo)',
    downloadUrl: DEFAULT_CDN_URL,
    releaseNotes: 'Official initial production release of SheDrive Pakistan. Female-only ride hailing with direct fare bidding and 24/7 SOS safety.'
  });
});

/**
 * GET /api/v1/app/download
 * Performs direct HTTP 302 redirect to production Object Storage CDN
 */
router.get('/download', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="SheDrive-latest.apk"');
  res.redirect(302, DEFAULT_CDN_URL);
});

export default router;
