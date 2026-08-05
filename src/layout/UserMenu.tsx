import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../auth/authStore';
import { ROLE_DEFINITIONS } from '../domain';
import { initials } from '../lib/utils';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!session) return null;
  const roleLabel = ROLE_DEFINITIONS.find((r) => r.role === session.role)?.label ?? session.role;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
          {initials(session.user.fullName)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium leading-tight text-slate-800 dark:text-slate-100">{session.user.fullName}</span>
          <span className="block text-[11px] leading-tight text-slate-400">{roleLabel}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            onMouseDown={() => navigate('/perfil')}
          >
            <UserIcon className="h-4 w-4" /> Meu perfil
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            onMouseDown={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
