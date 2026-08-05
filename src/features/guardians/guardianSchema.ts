import { z } from 'zod';

export const guardianSchema = z.object({
  fullName: z.string().min(2, 'Informe o nome completo.'),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  phone: z.string().optional(),
  relationship: z.enum(['mother', 'father', 'grandparent', 'legal_guardian', 'other']),
  studentId: z.string().optional(),
});

export type GuardianFormValues = z.infer<typeof guardianSchema>;

export const RELATIONSHIP_LABELS: Record<GuardianFormValues['relationship'], string> = {
  mother: 'Mãe',
  father: 'Pai',
  grandparent: 'Avô/avó',
  legal_guardian: 'Responsável legal',
  other: 'Outro',
};
