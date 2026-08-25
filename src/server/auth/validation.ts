import { z } from 'zod';

export const phoneSchema = z
  .string()
  .min(1, 'شماره تلفن الزامی است')
  .refine((v) => /^09\d{9}$/.test(v.replace(/[^\d]/g, '').replace(/^(0098|98|0)/, '0')), {
    message: 'شماره موبایل نامعتبر است (مثال: 09123456789)',
  });

export const registerSchema = z.object({
  firstName: z.string().min(1, 'نام الزامی است').max(50),
  lastName: z.string().min(1, 'نام خانوادگی الزامی است').max(50),
  phone: phoneSchema,
  password: z
    .string()
    .min(6, 'رمز عبور حداقل ۶ کاراکتر باید باشد')
    .max(100, 'رمز عبور بیش از حد طولانی است'),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export const sendMessageSchema = z.object({
  body: z.string().max(10000).optional(),
  replyToId: z.string().cuid().optional().nullable(),
  forwardedFromId: z.string().cuid().optional().nullable(),
  attachments: z
    .array(z.string().cuid())
    .max(10, 'حداکثر ۱۰ فایل در هر پیام')
    .optional()
    .default([]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
