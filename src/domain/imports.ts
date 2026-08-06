import type { BaseEntity } from './common';

export type ImportDocumentType =
  | 'student_registration'
  | 'early_childhood_report'
  | 'elementary_report'
  | 'bncc_checklist_report'
  | 'attendance'
  | 'events'
  | 'observations'
  | 'alerts'
  | 'portfolio'
  | 'generic';

export type ImportFileFormat = 'xls' | 'xlsx' | 'csv' | 'pdf' | 'jpeg' | 'jpg' | 'png';

export type ImportPeriodicity = 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

export type StorageDestination = 'local' | 'cloud';

export type ImportStatus =
  | 'draft'
  | 'extracting'
  | 'mapping'
  | 'validating'
  | 'previewing'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled';

export interface ImportBatch extends BaseEntity {
  documentType: ImportDocumentType;
  fileFormat: ImportFileFormat;
  fileName: string;
  fileSizeBytes: number;
  fileHash: string;
  schoolId?: string;
  classId?: string;
  studentId?: string;
  periodicity: ImportPeriodicity;
  periodLabel: string;
  storageDestination: StorageDestination;
  importStatus: ImportStatus;
  totalRowsFound: number;
  totalImported: number;
  totalRejected: number;
  totalDuplicates: number;
  columnMapping?: Record<string, string>;
  errors?: string[];
  syncStatus?: 'pending' | 'synced' | 'error';
  operationRef: string;
}

export type ImportRowValidation = 'valid' | 'warning' | 'error' | 'duplicate';

export interface ImportRow extends BaseEntity {
  importId: string;
  rowIndex: number;
  rawValue: Record<string, unknown>;
  interpretedValue: Record<string, unknown>;
  confidence?: number; // 0-1, relevante para OCR
  targetField?: string;
  validation: ImportRowValidation;
  validationNotes?: string;
  resolution?: 'ignore' | 'update_existing' | 'create_new_version' | 'merge' | 'cancel';
  linkedStudentId?: string;
}

export interface StorageLog extends BaseEntity {
  entityType: string;
  entityId: string;
  destination: StorageDestination;
  syncedAt?: string;
  syncStatus: 'not_applicable' | 'pending' | 'synced' | 'error';
}

export type SyncQueueStatus = 'pending' | 'in_progress' | 'synced' | 'conflict' | 'error';

export interface SyncQueueItem extends BaseEntity {
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  attempts: number;
  lastAttemptAt?: string;
  syncStatus: SyncQueueStatus;
  conflictLocalVersion?: Record<string, unknown>;
  conflictRemoteVersion?: Record<string, unknown>;
  errorMessage?: string;
}
