import { z } from 'zod';

export const teacherSchema = z.object({
  fullName: z.string().min(2, 'Informe o nome completo.'),
  email: z.string().email('E-mail inválido.'),
  teacherTitle: z.string().optional(),
  temporaryPassword: z.string().min(6, 'A senha temporária deve ter ao menos 6 caracteres.'),
  classId: z.string().optional(),
});

export type TeacherFormValues = z.infer<typeof teacherSchema>;
