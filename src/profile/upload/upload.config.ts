import { BadRequestException } from '@nestjs/common';
import { diskStorage, StorageEngine } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function diskStorageFor(subfolder: string): StorageEngine {
  const dest = join(UPLOADS_ROOT, subfolder);
  ensureDir(dest);
  return diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const userId: string = (req as { user?: { sub?: string } }).user?.sub ?? 'unknown';
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${userId}-${Date.now()}${ext}`);
    },
  });
}

// ─── Resume ───────────────────────────────────────────────────────────────────

const ALLOWED_RESUME_MIMETYPES = ['application/pdf'];
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

export const resumeUploadConfig = {
  storage: diskStorageFor('resumes'),
  limits: { fileSize: MAX_RESUME_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ): void => {
    if (!ALLOWED_RESUME_MIMETYPES.includes(file.mimetype)) {
      cb(new BadRequestException('Resume must be a PDF file.'), false);
      return;
    }
    cb(null, true);
  },
};

// ─── Profile Image ────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export const profileImageUploadConfig = {
  storage: diskStorageFor('profile-images'),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ): void => {
    if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      cb(new BadRequestException('Profile image must be JPEG, PNG, or WebP.'), false);
      return;
    }
    cb(null, true);
  },
};

/** Converts a disk path to a URL-relative path served via /uploads static route. */
export function toUploadUrl(subfolder: string, filename: string): string {
  return `/uploads/${subfolder}/${filename}`;
}
