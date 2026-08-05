# Modelo de dados

Todas as entidades abaixo existem como tipos TypeScript em `src/domain/*.ts` e como tabelas Dexie em
`src/db/schema.ts`. Esta é a mesma forma que as tabelas assumirão no Postgres/Supabase (Fase 6) — ver
o schema SQL em [`supabase-migration.md`](./supabase-migration.md).

## Campos comuns (`BaseEntity`)

Toda entidade principal carrega estes campos (`src/domain/common.ts`):

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string (uuid) | Identificador único |
| `organizationId` | string | Organização à qual o registro pertence (multi-tenant) |
| `createdAt` / `updatedAt` | string (ISO) | Timestamps |
| `createdBy` / `updatedBy` | string (user id) | Autoria e última edição |
| `version` | number | Incrementada a cada `update()` (controle de concorrência) |
| `status` | `active \| archived \| deleted` | Ciclo de vida do registro (exclusão lógica) |
| `deletedAt` / `deletedBy` / `deleteReason` | opcionais | Preenchidos na exclusão lógica |
| `isDemo` | boolean opcional | Marca registros de demonstração, removíveis em bloco |

> Observação de design: quando uma entidade também precisa de um "status de negócio" (ex.: situação
> de uma matrícula, de uma avaliação publicada, de um evento), esse campo recebe um nome próprio
> (`enrollmentStatus`, `publicationStatus`, `eventStatus`, `alertStatus`, `attendanceStatus`,
> `importStatus`, `teacherAlertStatus`) para não colidir com o `status` de ciclo de vida do `BaseEntity`.

## Estrutura organizacional (`domain/org.ts`)

| Entidade | Campos principais | Relacionamentos |
|---|---|---|
| `Organization` | name, legalName, document, cloudStorageEnabled, retentionPolicyDays | raiz multi-tenant |
| `School` | name, document, address, phone, email | pertence a `Organization` |
| `SchoolUnit` | name, address | pertence a `School` |
| `AcademicYear` | year, startDate, endDate, isCurrent | pertence a `School` |
| `Class` | name, stage, grade, shift, homeroomTeacherId | pertence a `School` + `AcademicYear` |
| `Enrollment` | enrollmentDate, enrollmentStatus, internalCode, reason | liga `Student` a `Class`/`School`/`AcademicYear`; preserva histórico de trocas |

## Pessoas (`domain/people.ts`)

| Entidade | Campos principais | Relacionamentos |
|---|---|---|
| `Student` | fullName, socialName, birthDate, photoUrl, schoolId, classId, matriculationStatus, accessibility, authorizedNotes | N:N com `Guardian` via `StudentGuardian` |
| `Guardian` | fullName, document, email, phone, relationship | N:N com `Student` |
| `StudentGuardian` | relationship, isPrimary, canPickUp, financialResponsible | tabela de vínculo (um aluno pode ter vários responsáveis; um responsável, vários filhos) |
| `AppUser` | fullName, email, role, passwordHash, isBlocked, guardianId?, studentId?, failedLoginAttempts | conta de acesso; `role` = owner/admin/teacher/guardian/student |
| `TeacherAssignment` | classId, subject?, isHomeroom, academicYearId | liga um `AppUser` (professor) a uma `Class` |

## RBAC (`domain/rbac.ts`)

| Entidade | Campos principais |
|---|---|
| `UserPermission` | userId, role?, schoolId?, classId?, studentId?, module, actions[], grantedBy, validFrom, validUntil? |

`actions` é um subconjunto de `view, create, edit, import, export, approve, delete, administer`.
Sobreposições mais específicas (aluno > turma > escola) vencem o padrão do perfil — ver
`src/auth/permissions.ts`.

## Avaliação — Educação Infantil e Ensino Fundamental (`domain/assessment.ts`)

| Entidade | Campos principais |
|---|---|
| `AssessmentScale` | schoolId, stage, name, type (`concept\|numeric\|pass_fail\|custom`), levels[], minValue?, maxValue?, isDefault |
| `AssessmentCategory` | schoolId, stage, kind (`bncc_field\|custom`), bnccField?, name |
| `Activity` | schoolId, classId, stage, title, categoryId?/subject?, type, date, period, createdByTeacherId |
| `Assessment` | activityId, studentId, rboLevel? (Educação Infantil), scaleId?/scaleLevelCode?/numericScore? (Ensino Fundamental), publicationStatus |
| `Grade` | studentId, classId, subject, period, scaleId, scaleLevelCode?/numericScore?, isRecovery, publicationStatus |

A escala R/B/O (Educação Infantil) usa valores auxiliares internos R=1, B=2, O=3 **apenas** para
tendências/gráficos — nunca exibidos como nota às famílias (`RBO_INTERNAL_VALUE` em `assessment.ts`).

## Frequência, observações, alertas

| Entidade | Arquivo | Campos principais |
|---|---|---|
| `Attendance` | `attendance.ts` | studentId, classId, date, attendanceStatus, justification |
| `TeacherObservation` | `observations.ts` | studentId, teacherId, categoryId?, text, visibleToGuardians, publicationStatus |
| `ParentObservation` | `observations.ts` | studentId, guardianId, text |
| `AlertRule` | `alerts.ts` | schoolId?, minActivitiesRequired, minPeriodsForPattern, rLevelPercentThreshold — configurável pelo Owner |
| `Alert` | `alerts.ts` | studentId, level (`informativo\|atencao\|acompanhamento\|orientacao_profissional`), reason, recordsUsed, confidence, recommendations[], alertStatus |
| `AlertAcknowledgement` | `alerts.ts` | alertId, acknowledgedBy, note? |
| `TeacherAlert` | `alerts.ts` | studentId, teacherId, priority, suggestedAction, visibleToGuardianIds[], teacherAlertStatus |

## Eventos, portfólio, documentos

| Entidade | Arquivo | Campos principais |
|---|---|---|
| `SchoolEvent` | `events.ts` | title, schoolId, classId?, audience, startAt, type, guardianAttendance, requiresConfirmation, eventStatus |
| `EventParticipant` | `events.ts` | eventId, studentId |
| `EventConfirmation` | `events.ts` | eventId, guardianId, studentId, response |
| `PortfolioItem` | `portfolio.ts` | studentId, category, bnccField?/subject?, fileIds[], visibility, imageAuthorization, tags[] |
| `StoredDocument` | `documents.ts` | studentId?, schoolId, category, fileName, hash, versionOf?, storageLocation |

## Importação e sincronização

| Entidade | Arquivo | Campos principais |
|---|---|---|
| `ImportBatch` | `imports.ts` | documentType, fileFormat, periodicity, storageDestination, importStatus, totalImported/Rejected/Duplicates, operationRef |
| `ImportRow` | `imports.ts` | importId, rawValue, interpretedValue, confidence? (OCR), validation, resolution |
| `StorageLog` | `imports.ts` | entityType, entityId, destination, syncStatus |
| `SyncQueueItem` | `imports.ts` | entityType, entityId, operation, payload, syncStatus, conflictLocalVersion/RemoteVersion |

## Auditoria, consentimento, recomendações, notificações, retenção

| Entidade | Arquivo | Campos principais |
|---|---|---|
| `AuditLog` | `audit.ts` | userId, role, action, module, entityId?, previousValue?/newValue?, result — **append-only, imutável** |
| `Consent` | `misc.ts` | guardianId, studentId, type, granted, grantedAt?/revokedAt? |
| `Recommendation` | `misc.ts` | title, content, ageRange, environment, source, sourceValidated, published |
| `Notification` | `misc.ts` | userId, type, title, body, read |
| `DataRetentionRule` | `misc.ts` | entityType, retentionDays, action (`archive\|delete`) |

## Diagrama de relacionamentos (simplificado)

```
Organization ─┬─ School ─┬─ SchoolUnit
              │          ├─ AcademicYear ─── Class ─── TeacherAssignment ─── AppUser(teacher)
              │          └─ Class ─── Enrollment ─── Student ─── StudentGuardian ─── Guardian
              │                                          │
              │                                          ├─ Activity ─── Assessment
              │                                          ├─ Grade
              │                                          ├─ Attendance
              │                                          ├─ TeacherObservation / ParentObservation
              │                                          ├─ Alert ─── AlertAcknowledgement
              │                                          ├─ PortfolioItem / StoredDocument
              │                                          └─ EventParticipant ─── SchoolEvent
              └─ AppUser (owner/admin/guardian/student) ─── UserPermission
```
