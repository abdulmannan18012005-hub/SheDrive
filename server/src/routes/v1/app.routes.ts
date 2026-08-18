import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Dedicated Cloudflare R2 Global CDN Object Storage URL
 * Handles 80 MB APK binaries with 0 egress fees and direct browser attachments.
 */
const CLOUDFLARE_R2_CDN_URL = process.env.CLOUDFLARE_R2_DOWNLOAD_URL || 
  'https://download.shedrive.great-site.net/SheDrive-latest.apk';

/**
 * GET /api/v1/app/info
 * Returns official release metadata backed by Cloudflare R2
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
    cdnProvider: 'Cloudflare R2',
    downloadUrl: CLOUDFLARE_R2_CDN_URL,
    releaseNotes: 'Official release of SheDrive Pakistan. High-speed 1-click download hosted via Cloudflare R2 Global CDN.'
  });
});

/**
 * GET /api/v1/app/download
 * Performs direct 302 redirect to Cloudflare R2 CDN storage payload
 */
router.get('/download', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="SheDrive-latest.apk"');
  res.redirect(302, CLOUDFLARE_R2_CDN_URL);
});

export default router;
