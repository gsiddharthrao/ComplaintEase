import { z } from 'zod';

/** Zod schema for user registration — validated on the frontend form AND the API */
export const registerSchema = z.object({
  email: z.string().email('Must be a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  full_name: z.string().min(2, 'At least 2 characters').max(100),
  role: z.enum(['employee', 'admin']).default('employee'),
  department_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Login is handled by Supabase Auth — we validate the shape before calling supabase.auth.signInWithPassword */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
