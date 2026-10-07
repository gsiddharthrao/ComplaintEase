import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { complaintsRouter } from './complaints.js';
import { commentsRouter } from './comments.js';
import { attachmentsRouter } from './attachments.js';
import { notificationsRouter } from './notifications.js';
import { adminRouter } from './admin.js';

export const v1Router = Router();

v1Router.use(healthRouter);
v1Router.use(authRouter);
v1Router.use(complaintsRouter);
v1Router.use(commentsRouter);
v1Router.use(attachmentsRouter);
v1Router.use(notificationsRouter);
v1Router.use(adminRouter);
