import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Lock, Send, User, Trash2 } from 'lucide-react';

interface CommentsThreadProps {
  complaintId: string;
}

export const CommentsThread: React.FC<CommentsThreadProps> = ({ complaintId }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const canPostInternal = profile?.role === 'dept_head' || profile?.role === 'admin';

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', complaintId],
    queryFn: () => api.comments.list(complaintId),
  });

  const addCommentMutation = useMutation({
    mutationFn: (data: { body: string; is_internal: boolean }) =>
      api.comments.create(complaintId, data),
    onSuccess: () => {
      setBody('');
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ['comments', complaintId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => api.comments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', complaintId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    addCommentMutation.mutate({ body: body.trim(), is_internal: isInternal });
  };

  return (
    <div className="space-y-6">
      {/* Existing Comments */}
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading discussion...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-400">No comments yet. Start the conversation below.</p>
        ) : (
          comments.map((comment) => {
            const isAuthor = comment.author_id === profile?.id;
            const canDelete = isAuthor || profile?.role === 'admin';

            return (
              <div
                key={comment.id}
                className={`p-4 rounded-xl border transition-all ${
                  comment.is_internal
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900">
                      {comment.author?.full_name || 'Staff'}
                    </span>
                    {comment.is_internal && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                        <Lock className="w-2.5 h-2.5" />
                        Internal Staff Note
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">
                      {new Date(comment.created_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {comment.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Form */}
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <label htmlFor="comment-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Add to Discussion
        </label>
        <textarea
          id="comment-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write an update, question, or note..."
          rows={3}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          {canPostInternal ? (
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <span className="flex items-center gap-1 text-amber-800">
                <Lock className="w-3 h-3" />
                Staff Internal Note (Hidden from employee)
              </span>
            </label>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={addCommentMutation.isPending || !body.trim()}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors ml-auto"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

