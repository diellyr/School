import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from './navigation';

export function Breadcrumbs({ trailingLabel }: { trailingLabel?: string }) {
  const { pathname } = useLocation();
  const current = NAV_ITEMS.find((item) => item.path === pathname || (item.path !== '/' && pathname.startsWith(item.path)));

  const crumbs = [{ label: 'Início', path: '/' }];
  if (current && current.path !== '/') {
    crumbs.push({ label: current.label, path: current.path });
  }

  return (
    <nav aria-label="breadcrumbs" className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      {crumbs.map((c, i) => (
        <span key={c.path} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {i === crumbs.length - 1 && !trailingLabel ? (
            <span className="font-medium text-slate-700 dark:text-slate-200">{c.label}</span>
          ) : (
            <Link to={c.path} className="hover:text-sky-600">
              {c.label}
            </Link>
          )}
        </span>
      ))}
      {trailingLabel && (
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{trailingLabel}</span>
        </span>
      )}
    </nav>
  );
}
