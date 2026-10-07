// @complaintease/shared
// Central export for all shared types and Zod schemas.
// Both the API and the web app import from here to ensure type safety across the stack.
export * from './types/enums.js';
export * from './types/complaint.js';
export * from './types/user.js';
export * from './types/department.js';
export * from './types/category.js';
export * from './types/comment.js';
export * from './types/notification.js';
export * from './schemas/complaint.schema.js';
export * from './schemas/auth.schema.js';
export * from './schemas/comment.schema.js';
export * from './schemas/transition.schema.js';
