import type { BaseEntity, EducationStage } from './common';

/** Registro de entrada e saída do aluno na escola em um dia — complementa a Frequência
 *  (presente/falta) com o horário real de chegada e saída, quando a escola faz esse controle. */
export interface CheckInOut extends BaseEntity {
  schoolId: string;
  classId: string;
  studentId: string;
  stage: EducationStage;
  date: string;
  period: string;
  checkInTime?: string;
  checkOutTime?: string;
  registeredBy: string;
  notes?: string;
}
