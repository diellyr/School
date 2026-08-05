import type { BaseEntity } from './common';

export type SchoolEventType =
  | 'apenas_aluno'
  | 'presenca_obrigatoria_pais'
  | 'atividade_com_pais'
  | 'ajuda_voluntariado'
  | 'passeio'
  | 'reuniao'
  | 'apresentacao'
  | 'festa'
  | 'atividade_turma'
  | 'evento_escola'
  | 'todos_juntos'
  | 'outro';

export type SchoolEventStatus = 'draft' | 'published' | 'confirmed' | 'cancelled' | 'completed' | 'rescheduled';

export interface SchoolEvent extends BaseEntity {
  title: string;
  description?: string;
  schoolId: string;
  classId?: string;
  studentIds?: string[];
  audience: 'student' | 'class' | 'school' | 'custom';
  startAt: string;
  endAt?: string;
  location?: string;
  address?: string;
  responsibleUserId: string;
  type: SchoolEventType;
  requiresAuthorization: boolean;
  transportProvided: boolean;
  cost?: number;
  requiredItems?: string[];
  guardianAttendance: 'not_required' | 'optional' | 'required';
  requiresConfirmation: boolean;
  participantLimit?: number;
  attachmentIds?: string[];
  notes?: string;
  eventStatus: SchoolEventStatus;
}

export interface EventParticipant extends BaseEntity {
  eventId: string;
  studentId: string;
}

export type ConfirmationResponse = 'pending' | 'confirmed' | 'declined';

export interface EventConfirmation extends BaseEntity {
  eventId: string;
  guardianId: string;
  studentId: string;
  response: ConfirmationResponse;
  respondedAt?: string;
  note?: string;
}
