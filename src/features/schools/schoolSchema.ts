import { z } from 'zod';

export const schoolSchema = z.object({
  name: z.string().min(2, 'Informe o nome da escola.'),
  document: z.string().optional(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type SchoolFormValues = z.infer<typeof schoolSchema>;
