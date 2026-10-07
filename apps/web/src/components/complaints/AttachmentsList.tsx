import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import { Paperclip, Download, Upload, File } from 'lucide-react';

interface AttachmentsListProps {
  complaintId: string;
}

export const AttachmentsList: React.FC<AttachmentsListProps> = ({ complaintId }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments', complaintId],
    queryFn: () => api.attachments.list(complaintId),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds the 10 MB maximum limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Get signed upload URL from API
      const { upload_url, storage_path } = await api.attachments.getUploadUrl(complaintId, {
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      });

      // 2. Upload file directly to Supabase Storage via signed URL
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload to storage bucket failed.');
      }

      // 3. Confirm attachment in database
      await api.attachments.confirm(complaintId, {
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_path,
      });

      queryClient.invalidateQueries({ queryKey: ['attachments', complaintId] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Attached Evidence ({attachments.length})
        </h4>

        <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors">
          <Upload className="w-3.5 h-3.5" />
          <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {uploadError && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
          {uploadError}
        </div>
      )}

      {/* Files List */}
      {isLoading ? (
        <p className="text-xs text-slate-400">Loading attachments...</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-slate-400">No attachments uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-brand-300 transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <File className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatFileSize(item.file_size)} • {item.uploader?.full_name || 'Staff'}
                  </p>
                </div>
              </div>

              {item.download_url && (
                <a
                  href={item.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors shrink-0"
                  title="Download attachment"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

