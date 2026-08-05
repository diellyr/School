import { z } from 'zod';

export const eventSchema = z.object({
  title: z.string().min(2, 'Informe o título do evento.'),
  description: z.string().optional(),
  schoolId: z.string().min(1, 'Selecione a escola.'),
  classId: z.string().optional(),
  type: z.enum([
    'apenas_aluno', 'presenca_obrigatoria_pais', 'atividade_com_pais', 'ajuda_voluntariado', 'passeio',
    'reuniao', 'apresentacao', 'festa', 'atividade_turma', 'evento_escola', 'todos_juntos', 'outro',
  ]),
  startDate: z.string().min(1, 'Informe a data.'),
  startTime: z.string().min(1, 'Informe o horário.'),
  location: z.string().optional(),
  guardianAttendance: z.enum(['not_required', 'optional', 'required']),
  requiresConfirmation: z.boolean(),
  requiresAuthorization: z.boolean(),
  cost: z.string().optional(),
});

export type EventFormValues = z.infer<typeof eventSchema>;

export const EVENT_TYPE_LABELS: Record<EventFormValues['type'], string> = {
  apenas_aluno: 'Apenas do aluno',
  presenca_obrigatoria_pais: 'Presença obrigatória dos pais',
  atividade_com_pais: 'Atividade com os pais',
  ajuda_voluntariado: 'Ajuda/voluntariado dos pais',
  passeio: 'Passeio',
  reuniao: 'Reunião',
  apresentacao: 'Apresentação',
  festa: 'Festa',
  atividade_turma: 'Atividade da turma',
  evento_escola: 'Evento da escola',
  todos_juntos: 'Todos juntos',
  outro: 'Outro',
};
