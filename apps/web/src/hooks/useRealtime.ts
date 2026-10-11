import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.js';

/**
 * Sets up live WebSocket subscriptions via Supabase Realtime
 * for complaints, comments, attachments, and in-app notifications.
 * Automatically invalidates corresponding TanStack Query caches,
 * handling INSERT, UPDATE, and DELETE events.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // 1. Channel for complaints changes
    const complaintChannel = supabase
      .channel('realtime:complaints')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        (payload) => {
          console.log('⚡ Realtime Complaint Change:', payload);
          queryClient.invalidateQueries({ queryKey: ['complaints'] });
          queryClient.invalidateQueries({ queryKey: ['admin-complaints-feed'] });
          const complaintId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (complaintId) {
            queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
          }
        },
      )
      .subscribe();

    // 2. Channel for comments changes
    const commentChannel = supabase
      .channel('realtime:comments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          console.log('⚡ Realtime Comment Change:', payload);
          const complaintId = (payload.new as any)?.complaint_id || (payload.old as any)?.complaint_id;
          if (complaintId) {
            queryClient.invalidateQueries({
              queryKey: ['comments', complaintId],
            });
          }
        },
      )
      .subscribe();

    // 3. Channel for attachments changes
    const attachmentChannel = supabase
      .channel('realtime:attachments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attachments' },
        (payload) => {
          console.log('📎 Realtime Attachment Change:', payload);
          const complaintId = (payload.new as any)?.complaint_id || (payload.old as any)?.complaint_id;
          if (complaintId) {
            queryClient.invalidateQueries({
              queryKey: ['attachments', complaintId],
            });
          }
        },
      )
      .subscribe();

    // 4. Channel for user notifications
    const notificationChannel = supabase
      .channel(`realtime:notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔔 Realtime Notification:', payload);
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(complaintChannel);
      supabase.removeChannel(commentChannel);
      supabase.removeChannel(attachmentChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [user, queryClient]);
}
