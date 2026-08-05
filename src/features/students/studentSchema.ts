import { z } from 'zod';

export const studentSchema = z.object({
  fullName: z.string().min(2, 'Informe o nome completo.'),
  socialName: z.string().optional(),
  birthDate: z.string().min(1, 'Informe a data de nascimento.'),
  schoolId: z.string().min(1, 'Selecione a escola.'),
  classId: z.string().min(1, 'Selecione a turma.'),
  internalCode: z.string().optional(),
  matriculationStatus: z.enum(['active', 'pending', 'transferred', 'graduated', 'withdrawn']),
  authorizedNotes: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
