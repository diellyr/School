import { z } from 'zod';

export const classSchema = z.object({
  name: z.string().min(2, 'Informe o nome da turma.'),
  schoolId: z.string().min(1, 'Selecione a escola.'),
  academicYearId: z.string().min(1, 'Selecione o ano letivo.'),
  stage: z.enum(['early_childhood', 'elementary']),
  grade: z.string().min(1, 'Informe a série/etapa.'),
  shift: z.enum(['morning', 'afternoon', 'full_time', 'evening']),
});

export type ClassFormValues = z.infer<typeof classSchema>;
