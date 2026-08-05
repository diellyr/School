import type { BaseEntity } from './common';

export type DocumentCategory =
  | 'relatorio_original'
  | 'arquivo_importado'
  | 'relatorio_processado'
  | 'boletim'
  | 'autorizacao'
  | 'comunicado'
  | 'comprovante'
  | 'anexo';

export interface StoredDocument extends BaseEntity {
  studentId?: string;
  schoolId: string;
  classId?: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
  tags: string[];
  versionOf?: string; // aponta para o documento anterior, se for nova versão
  storageLocation: 'local' | 'cloud';
  blobRef?: string; // referência ao blob no IndexedDB
  url?: string; // referência remota (Supabase Storage)
}
