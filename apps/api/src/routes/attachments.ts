import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { randomUUID } from 'crypto';

export const attachmentsRouter = Router();

const uploadUrlSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().min(1).max(10485760), // max 10MB
  mime_type: z.string().min(1).max(100),
});

const confirmAttachmentSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().min(1).max(10485760),
  mime_type: z.string().min(1).max(100),
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

      const fileExtension = file_name.split('.').pop() || 'dat';
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

      const { data, error } = await supabase
        .from('attachments')
        .insert({
          complaint_id: id,
          uploaded_by: req.user!.id,
          file_name,
          file_size,
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
