import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GitHub Releases APK Download URL (single source of truth for backend).
 * Uses the "latest" permalink so new releases auto-resolve without code changes.
 * Override via GITHUB_APK_DOWNLOAD_URL env var if needed.
 */
const APK_DOWNLOAD_URL = process.env.GITHUB_APK_DOWNLOAD_URL ||
  'https://github.com/abdulmannan18012005-hub/SheDrive/releases/latest/download/SheDrive.apk';

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
    cdnProvider: 'GitHub Releases',
    downloadUrl: APK_DOWNLOAD_URL,
    releaseNotes: 'Official release of SheDrive Pakistan. APK hosted via GitHub Releases for reliable, high-speed downloads.'
  });
});

/**
 * GET /api/v1/app/download
 * Performs 302 redirect to GitHub Releases APK asset
 */
router.get('/download', (_req: Request, res: Response) => {
  res.redirect(302, APK_DOWNLOAD_URL);
});

export default router;
