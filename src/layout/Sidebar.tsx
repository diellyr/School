import { NavLink } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from './navigation';
import { usePermission } from '../auth/usePermission';
import { cn } from '../lib/utils';

function NavItems() {
  return (
    <>
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group);
        return (
          <div key={group} className="mb-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <SidebarLink key={item.path} {...item} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function SidebarLink({ path, label, icon: Icon, module }: (typeof NAV_ITEMS)[number]) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const canView = usePermission(module, 'view');
  if (!canView) return null;
  return (
    <NavLink
      to={path}
      end={path === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col dark:border-slate-800 dark:bg-slate-900">
        <SidebarHeader />
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavItems />
        </nav>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50" onClick={onCloseMobile} aria-hidden />
          <aside className="relative z-10 flex h-full w-72 flex-col bg-white dark:bg-slate-900">
            <SidebarHeader />
            <nav className="flex-1 overflow-y-auto px-3 py-4" onClick={onCloseMobile}>
              <NavItems />
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarHeader() {
  return (
    <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white">
        <GraduationCap className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">Acompanha Escola</p>
        <p className="text-[11px] leading-tight text-slate-400">Educação Infantil &amp; Fundamental</p>
      </div>
    </div>
  );
}
