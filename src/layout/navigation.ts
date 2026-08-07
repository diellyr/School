import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Award,
  Baby,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Database,
  DoorOpen,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Home,
  Images,
  Import,
  MessageSquare,
  RefreshCw,
  School as SchoolIcon,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Users2,
  Wallet,
} from 'lucide-react';
import type { SystemModule } from '../domain';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  module: SystemModule;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Início', icon: Home, module: 'reports', group: 'Geral' },
  { path: '/educacao-infantil', label: 'Dashboard Educação Infantil', icon: Baby, module: 'assessments', group: 'Dashboards' },
  { path: '/ensino-fundamental', label: 'Dashboard Ensino Fundamental', icon: GraduationCap, module: 'grades', group: 'Dashboards' },

  { path: '/alunos', label: 'Alunos', icon: Users, module: 'students', group: 'Cadastros' },
  { path: '/responsaveis', label: 'Responsáveis', icon: Users2, module: 'guardians', group: 'Cadastros' },
  { path: '/professores', label: 'Professores', icon: UserCog, module: 'teachers', group: 'Cadastros' },
  { path: '/escolas', label: 'Escolas', icon: SchoolIcon, module: 'schools', group: 'Cadastros' },
  { path: '/turmas', label: 'Turmas', icon: ClipboardList, module: 'classes', group: 'Cadastros' },

  { path: '/importacao', label: 'Importação', icon: Import, module: 'imports', group: 'Registros' },
  { path: '/lancamento-manual', label: 'Lançamento manual', icon: ClipboardCheck, module: 'manual_entry', group: 'Registros' },
  { path: '/atividades', label: 'Atividades', icon: Sparkles, module: 'activities', group: 'Registros' },
  { path: '/avaliacoes', label: 'Avaliações', icon: BookOpen, module: 'assessments', group: 'Registros' },
  { path: '/notas', label: 'Notas', icon: BarChart3, module: 'grades', group: 'Registros' },
  { path: '/frequencia', label: 'Frequência', icon: Activity, module: 'attendance', group: 'Registros' },
  { path: '/entrada-saida', label: 'Entrada e saída', icon: DoorOpen, module: 'check_in_out', group: 'Registros' },

  { path: '/parcelas', label: 'Parcelas', icon: Wallet, module: 'financial', group: 'Financeiro' },
  { path: '/bolsas', label: 'Bolsas', icon: Award, module: 'scholarships', group: 'Financeiro' },
  { path: '/dashboard-financeiro', label: 'Dashboard financeiro', icon: BarChart3, module: 'financial', group: 'Financeiro' },

  { path: '/central-de-alertas', label: 'Central de Alertas', icon: Bell, module: 'notifications', group: 'Comunicação' },
  { path: '/alertas', label: 'Alertas', icon: AlertTriangle, module: 'alerts', group: 'Comunicação' },
  { path: '/observacoes', label: 'Observações', icon: MessageSquare, module: 'observations', group: 'Comunicação' },
  { path: '/eventos', label: 'Eventos', icon: CalendarDays, module: 'events', group: 'Comunicação' },
  { path: '/portfolio', label: 'Portfólio', icon: Images, module: 'portfolio', group: 'Comunicação' },
  { path: '/documentos', label: 'Documentos', icon: FolderOpen, module: 'documents', group: 'Comunicação' },
  { path: '/relatorios', label: 'Relatórios', icon: FileText, module: 'reports', group: 'Comunicação' },
  { path: '/recomendacoes', label: 'Recomendações', icon: Sparkles, module: 'recommendations', group: 'Comunicação' },
  { path: '/desenvolvimento', label: 'Desenvolvimento', icon: Compass, module: 'family_development', group: 'Comunicação' },

  { path: '/usuarios', label: 'Usuários', icon: Users, module: 'users', group: 'Administração' },
  { path: '/permissoes', label: 'Permissões do Owner', icon: ShieldCheck, module: 'permissions', group: 'Administração' },
  { path: '/auditoria', label: 'Auditoria', icon: Database, module: 'audit', group: 'Administração' },
  { path: '/sincronizacao', label: 'Sincronização', icon: RefreshCw, module: 'sync', group: 'Administração' },
  { path: '/backup', label: 'Backup e restauração', icon: Database, module: 'backup', group: 'Administração' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, module: 'settings', group: 'Administração' },
  { path: '/ajuda', label: 'Ajuda e privacidade', icon: HelpCircle, module: 'reports', group: 'Administração' },
];

export const NAV_GROUPS = ['Geral', 'Dashboards', 'Cadastros', 'Registros', 'Financeiro', 'Comunicação', 'Administração'];
