import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../features/auth/LoginPage';
import { HomePage } from '../features/home/HomePage';
import { SchoolsPage } from '../features/schools/SchoolsPage';
import { ClassesPage } from '../features/classes/ClassesPage';
import { StudentsPage } from '../features/students/StudentsPage';
import { StudentDetailPage } from '../features/students/StudentDetailPage';
import { GuardiansPage } from '../features/guardians/GuardiansPage';
import { TeachersPage } from '../features/teachers/TeachersPage';
import { UsersPage } from '../features/users/UsersPage';
import { AuditPage } from '../features/audit/AuditPage';
import { PermissionsAdminPage } from '../features/permissions-admin/PermissionsAdminPage';
import { BackupPage } from '../features/backup/BackupPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { HelpPage } from '../features/help/HelpPage';
import { ComingSoon } from '../components/ComingSoon';
import { EarlyChildhoodDashboardPage } from '../features/early-childhood/EarlyChildhoodDashboardPage';
import { ActivitiesPage } from '../features/early-childhood/ActivitiesPage';
import { AssessmentsPage } from '../features/assessments/AssessmentsPage';
import { ObservationsPage } from '../features/observations/ObservationsPage';
import { ElementaryDashboardPage } from '../features/elementary/ElementaryDashboardPage';
import { GradesPage } from '../features/elementary/GradesPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { EventsPage } from '../features/events/EventsPage';
import { AlertsPage } from '../features/alerts/AlertsPage';
import { PortfolioPage } from '../features/portfolio/PortfolioPage';
import { DocumentsPage } from '../features/documents/DocumentsPage';
import { ImportsPage } from '../features/imports/ImportsPage';
import { ManualEntryHubPage } from '../features/manual-entry/ManualEntryHubPage';
import { RecommendationsPage } from '../features/recommendations/RecommendationsPage';
import { SyncPage } from '../features/sync/SyncPage';

const comingSoon = (title: string, phase: string) => <ComingSoon title={title} phase={phase} />;

export const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'educacao-infantil', element: <EarlyChildhoodDashboardPage /> },
      { path: 'ensino-fundamental', element: <ElementaryDashboardPage /> },

      { path: 'alunos', element: <StudentsPage /> },
      { path: 'alunos/:id', element: <StudentDetailPage /> },
      { path: 'responsaveis', element: <GuardiansPage /> },
      { path: 'professores', element: <TeachersPage /> },
      { path: 'escolas', element: <SchoolsPage /> },
      { path: 'turmas', element: <ClassesPage /> },

      { path: 'importacao', element: <ImportsPage /> },
      { path: 'lancamento-manual', element: <ManualEntryHubPage /> },
      { path: 'atividades', element: <ActivitiesPage /> },
      { path: 'avaliacoes', element: <AssessmentsPage /> },
      { path: 'notas', element: <GradesPage /> },
      { path: 'frequencia', element: <AttendancePage /> },

      { path: 'alertas', element: <AlertsPage /> },
      { path: 'observacoes', element: <ObservationsPage /> },
      { path: 'eventos', element: <EventsPage /> },
      { path: 'portfolio', element: <PortfolioPage /> },
      { path: 'documentos', element: <DocumentsPage /> },
      { path: 'relatorios', element: comingSoon('Relatórios', 'Fase 5/6') },
      { path: 'recomendacoes', element: <RecommendationsPage /> },

      { path: 'usuarios', element: <UsersPage /> },
      { path: 'permissoes', element: <PermissionsAdminPage /> },
      { path: 'auditoria', element: <AuditPage /> },
      { path: 'sincronizacao', element: <SyncPage /> },
      { path: 'backup', element: <BackupPage /> },
      { path: 'configuracoes', element: <SettingsPage /> },
      { path: 'perfil', element: <ProfilePage /> },
      { path: 'ajuda', element: <HelpPage /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
