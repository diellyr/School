import type { BaseEntity } from './common';

export type PortfolioCategory =
  | 'desenho'
  | 'foto'
  | 'video'
  | 'trabalho'
  | 'producao_textual'
  | 'audio'
  | 'certificado'
  | 'projeto';

export interface PortfolioItem extends BaseEntity {
  studentId: string;
  date: string;
  category: PortfolioCategory;
  description?: string;
  bnccField?: string;
  subject?: string;
  teacherId?: string;
  fileIds: string[];
  teacherComment?: string;
  guardianComment?: string;
  visibility: 'family_only' | 'school_and_family';
  imageAuthorization: boolean;
  tags: string[];
}
