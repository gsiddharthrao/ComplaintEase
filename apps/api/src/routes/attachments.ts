import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { randomUUID } from 'crypto';

export const attachmentsRouter = Router();

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt', 'text'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
};

export const uploadUrlSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().min(1).max(10485760), // max 10MB
  mime_type: z.enum(ALLOWED_MIME_TYPES),
});

export const confirmAttachmentSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().min(1).max(10485760),
  mime_type: z.enum(ALLOWED_MIME_TYPES),
  storage_path: z.string().min(1),
});

/**
 * POST /api/v1/complaints/:id/attachments/upload-url
 * Generates a signed upload URL to Supabase Storage bucket 'attachments'
 */
attachmentsRouter.post(
  '/complaints/:id/attachments/upload-url',
  requireAuth,
  validateBody(uploadUrlSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { file_name } = req.body;
      const supabase = req.supabase!;

      // Verify access to complaint first
      const { data: complaint, error: compErr } = await supabase
        .from('complaints')
        .select('id')
        .eq('id', id)
        .single();

      if (compErr || !complaint) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Complaint not found or inaccessible',
            requestId: req.id,
          },
        });
        return;
      }

      const rawExt = file_name.includes('.') ? file_name.split('.').pop() : 'dat';
      const fileExtension = (rawExt || 'dat').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'dat';
      const storagePath = `${req.user!.id}/${id}/${randomUUID()}.${fileExtension}`;

      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUploadUrl(storagePath);

      if (error) {
        throw error;
      }

      res.json({
        data: {
          storage_path: storagePath,
          upload_url: data.signedUrl,
          token: data.token,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/complaints/:id/attachments
 * Registers attachment metadata in DB after successful storage upload
 */
attachmentsRouter.post(
  '/complaints/:id/attachments',
  requireAuth,
  validateBody(confirmAttachmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { file_name, file_size, mime_type, storage_path } = req.body;
      const supabase = req.supabase!;

      // 1. Verify caller has access to the complaint
      const { data: complaint, error: compErr } = await supabase
        .from('complaints')
        .select('id')
        .eq('id', id)
        .single();

      if (compErr || !complaint) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Complaint not found or inaccessible',
            requestId: req.id,
          },
        });
        return;
      }

      // 2. Validate storage_path ownership and format
      const expectedPrefix = `${req.user!.id}/${id}/`;
      if (!storage_path.startsWith(expectedPrefix)) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Storage path does not belong to the authenticated user or complaint',
            requestId: req.id,
          },
        });
        return;
      }

      const filenamePart = storage_path.slice(expectedPrefix.length);
      const safeFilenameRegex = /^[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+$/;
      if (
        !filenamePart ||
        filenamePart.includes('..') ||
        filenamePart.includes('/') ||
        filenamePart.includes('\\') ||
        !safeFilenameRegex.test(filenamePart)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_STORAGE_PATH',
            message: 'Storage path format is invalid',
            requestId: req.id,
          },
        });
        return;
      }

      // 3. Server-side validation: ensure path extension matches declared MIME type
      const ext = filenamePart.split('.').pop()?.toLowerCase() || '';
      const allowedExts = MIME_TO_EXTENSIONS[mime_type] || [];
      if (!allowedExts.includes(ext)) {
        res.status(400).json({
          error: {
            code: 'METADATA_MISMATCH',
            message: `Declared MIME type '${mime_type}' does not match file extension '.${ext}'`,
            requestId: req.id,
          },
        });
        return;
      }

      // 4. Server-side storage object verification (fail-closed)
      // Confirms that the client has actually uploaded the file into Supabase Storage
      // at the exact expected path before creating any database record.
      if (typeof supabase.storage?.from !== 'function') {
        res.status(502).json({
          error: {
            code: 'STORAGE_UNAVAILABLE',
            message: 'Storage service is unavailable for object verification',
            requestId: req.id,
          },
        });
        return;
      }

      const storageBucket = supabase.storage.from('attachments');
      if (typeof storageBucket.list !== 'function') {
        res.status(502).json({
          error: {
            code: 'STORAGE_UNAVAILABLE',
            message: 'Storage listing operation is unavailable',
            requestId: req.id,
          },
        });
        return;
      }

      const folder = `${req.user!.id}/${id}`;
      let fileList: any[];
      try {
        const { data, error: listErr } = await storageBucket.list(folder, {
          search: filenamePart,
        });

        if (listErr) {
          res.status(502).json({
            error: {
              code: 'STORAGE_VERIFICATION_ERROR',
              message: `Failed to verify storage object: ${listErr.message || 'Storage listing error'}`,
              requestId: req.id,
            },
          });
          return;
        }

        if (!Array.isArray(data)) {
          res.status(502).json({
            error: {
              code: 'STORAGE_VERIFICATION_ERROR',
              message: 'Unexpected storage response format during object verification',
              requestId: req.id,
            },
          });
          return;
        }

        fileList = data;
      } catch (err: any) {
        res.status(502).json({
          error: {
            code: 'STORAGE_VERIFICATION_ERROR',
            message: `Storage object verification failed: ${err?.message || 'Unknown storage error'}`,
            requestId: req.id,
          },
        });
        return;
      }

      // Check object existence at the exact path
      const matchedObj = fileList.find((f: any) => f.name === filenamePart);
      if (!matchedObj) {
        res.status(400).json({
          error: {
            code: 'STORAGE_OBJECT_NOT_FOUND',
            message: `Expected uploaded object '${filenamePart}' was not found in storage at '${folder}'`,
            requestId: req.id,
          },
        });
        return;
      }

      // Require usable actual size metadata
      const rawSize = matchedObj.metadata?.size ?? matchedObj.metadata?.contentLength;
      const actualBytes =
        typeof rawSize === 'number'
          ? rawSize
          : rawSize !== undefined && rawSize !== null
            ? Number(rawSize)
            : NaN;

      if (isNaN(actualBytes) || actualBytes <= 0) {
        res.status(400).json({
          error: {
            code: 'STORAGE_METADATA_UNAVAILABLE',
            message: 'Uploaded object in storage is missing usable size metadata',
            requestId: req.id,
          },
        });
        return;
      }

      // Validate 10 MB maximum limit against actual bytes
      if (actualBytes > 10485760) {
        res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Uploaded file in storage (${actualBytes} B) exceeds the 10MB maximum limit`,
            requestId: req.id,
          },
        });
        return;
      }

      // Reject significant discrepancies between reported and actual size (> 1KB)
      if (Math.abs(actualBytes - file_size) > 1024) {
        res.status(400).json({
          error: {
            code: 'METADATA_MISMATCH',
            message: `Reported file size (${file_size} B) deviates significantly from actual stored object size (${actualBytes} B)`,
            requestId: req.id,
          },
        });
        return;
      }

      // Validate stored content type where trustworthy Storage metadata is available
      const storedMime = matchedObj.metadata?.mimetype ?? matchedObj.metadata?.contentType;
      if (storedMime && typeof storedMime === 'string') {
        const normalizedStoredMime = storedMime.split(';')[0].trim().toLowerCase();
        if (normalizedStoredMime !== mime_type.toLowerCase()) {
          res.status(400).json({
            error: {
              code: 'METADATA_MISMATCH',
              message: `Stored object content type '${normalizedStoredMime}' does not match declared MIME type '${mime_type}'`,
              requestId: req.id,
            },
          });
          return;
        }
      }

      // 5. Insert attachment metadata using verified actual size from storage
      const { data, error } = await supabase
        .from('attachments')
        .insert({
          complaint_id: id,
          uploaded_by: req.user!.id,
          file_name,
          file_size: actualBytes,
          mime_type,
          storage_path,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/complaints/:id/attachments
 * Returns all attachments for complaint, with signed download URLs
 */
attachmentsRouter.get(
  '/complaints/:id/attachments',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const supabase = req.supabase!;

      const { data, error } = await supabase
        .from('attachments')
        .select(`
          id,
          complaint_id,
          uploaded_by,
          file_name,
          file_size,
          mime_type,
          storage_path,
          created_at,
          uploader:profiles!attachments_uploaded_by_fkey(full_name)
        `)
        .eq('complaint_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Generate signed URLs for private downloads (valid for 1 hour)
      const enriched = await Promise.all(
        (data || []).map(async (item: any) => {
          const { data: signedData } = await supabase.storage
            .from('attachments')
            .createSignedUrl(item.storage_path, 3600);

          return {
            ...item,
            download_url: signedData?.signedUrl || null,
          };
        }),
      );

      res.json({ data: enriched });
    } catch (err) {
      next(err);
    }
  },
);

