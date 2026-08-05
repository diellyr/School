import { createBrowserRouter, Navigate } from 'react-router-dom';
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

const comingSoon = (title: string, phase: string) => <ComingSoon title={title} phase={phase} />;

export const router = createBrowserRouter([
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
      { path: 'educacao-infantil', element: comingSoon('Dashboard Educação Infantil', 'Fase 2') },
      { path: 'ensino-fundamental', element: comingSoon('Dashboard Ensino Fundamental', 'Fase 5') },

      { path: 'alunos', element: <StudentsPage /> },
      { path: 'alunos/:id', element: <StudentDetailPage /> },
      { path: 'responsaveis', element: <GuardiansPage /> },
      { path: 'professores', element: <TeachersPage /> },
      { path: 'escolas', element: <SchoolsPage /> },
      { path: 'turmas', element: <ClassesPage /> },

      { path: 'importacao', element: comingSoon('Importação', 'Fase 3') },
      { path: 'lancamento-manual', element: comingSoon('Lançamento manual', 'Fase 2') },
      { path: 'atividades', element: comingSoon('Atividades', 'Fase 2') },
      { path: 'avaliacoes', element: comingSoon('Avaliações', 'Fase 2') },
      { path: 'notas', element: comingSoon('Notas', 'Fase 5') },
      { path: 'frequencia', element: comingSoon('Frequência', 'Fase 4') },

      { path: 'alertas', element: comingSoon('Alertas', 'Fase 4') },
      { path: 'observacoes', element: comingSoon('Observações', 'Fase 4') },
      { path: 'eventos', element: comingSoon('Eventos', 'Fase 4') },
      { path: 'portfolio', element: comingSoon('Portfólio', 'Fase 4') },
      { path: 'documentos', element: comingSoon('Documentos', 'Fase 4') },
      { path: 'relatorios', element: comingSoon('Relatórios', 'Fase 5/6') },
      { path: 'recomendacoes', element: comingSoon('Recomendações', 'Fase 4') },

      { path: 'usuarios', element: <UsersPage /> },
      { path: 'permissoes', element: <PermissionsAdminPage /> },
      { path: 'auditoria', element: <AuditPage /> },
      { path: 'sincronizacao', element: comingSoon('Sincronização', 'Fase 6') },
      { path: 'backup', element: <BackupPage /> },
      { path: 'configuracoes', element: <SettingsPage /> },
      { path: 'perfil', element: <ProfilePage /> },
      { path: 'ajuda', element: <HelpPage /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
