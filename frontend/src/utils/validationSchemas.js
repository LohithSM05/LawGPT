import { z } from 'zod';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=~`[\]/\\;']).{8,}$/;

export const ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'lawyer', label: 'Lawyer' },
  { value: 'admin', label: 'Admin' },
];

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(PASSWORD_REGEX, 'Include an uppercase letter, a lowercase letter, a number, and a special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['student', 'researcher', 'lawyer', 'admin']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  avatar: z.union([z.string().trim().url('Enter a valid URL'), z.literal('')]).optional(),
});
