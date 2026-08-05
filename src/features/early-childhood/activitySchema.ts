import { z } from 'zod';

export const activitySchema = z.object({
  classId: z.string().min(1, 'Selecione a turma.'),
  title: z.string().min(2, 'Informe o título da atividade.'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  newCategoryName: z.string().optional(),
  type: z.enum(['prova', 'trabalho', 'projeto', 'atividade', 'participacao', 'leitura', 'producao_textual', 'avaliacao_pratica', 'recuperacao', 'outro']),
  date: z.string().min(1, 'Informe a data.'),
  period: z.string().min(1, 'Informe o período (ex.: 2026-B1).'),
});

export type ActivityFormValues = z.infer<typeof activitySchema>;

export const ACTIVITY_TYPE_LABELS: Record<ActivityFormValues['type'], string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  projeto: 'Projeto',
  atividade: 'Atividade',
  participacao: 'Participação',
  leitura: 'Leitura',
  producao_textual: 'Produção textual',
  avaliacao_pratica: 'Avaliação prática',
  recuperacao: 'Recuperação',
  outro: 'Outro',
};
