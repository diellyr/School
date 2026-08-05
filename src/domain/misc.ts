import type { BaseEntity } from './common';

export interface Consent extends BaseEntity {
  guardianId: string;
  studentId: string;
  type: 'image_use' | 'data_processing' | 'field_trip' | 'other';
  description: string;
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  documentId?: string;
}

export type RecommendationAgeRange = '0-2' | '3-5' | '6-8' | '9-11' | '12+';

export interface Recommendation extends BaseEntity {
  title: string;
  content: string;
  ageRange: RecommendationAgeRange;
  bnccField?: string;
  subject?: string;
  category?: string;
  environment: 'school' | 'family' | 'both';
  source: string;
  sourceValidated: boolean;
  reviewedAt?: string;
  approvedBy?: string;
  published: boolean;
}

export type NotificationType = 'alert' | 'event' | 'message' | 'system';

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkTo?: string;
  read: boolean;
  createdAt: string;
}

export interface DataRetentionRule extends BaseEntity {
  entityType: string;
  retentionDays: number;
  action: 'archive' | 'delete';
  description?: string;
}
