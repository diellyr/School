import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Search, User } from 'lucide-react';
import { db } from '../db/schema';
import { useCurrentRole } from '../auth/usePermission';

export function GlobalSearch() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const role = useCurrentRole();

  const results = useLiveQuery(async () => {
    const normalized = term.trim().toLowerCase();
    if (normalized.length < 2) return [];
    const students = await db.students.filter((s) => s.status === 'active').toArray();
    return students
      .filter((s) => s.fullName.toLowerCase().includes(normalized) || (s.socialName ?? '').toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [term]);

  if (role === 'student') return null;

  return (
    <div className="relative hidden w-full max-w-sm sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar aluno por nome…"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-900"
        aria-label="Pesquisa global de alunos"
      />
      {open && term.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {(results ?? []).length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Nenhum aluno encontrado.</p>
          ) : (
            (results ?? []).map((s) => (
              <button
                key={s.id}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                onMouseDown={() => navigate(`/alunos/${s.id}`)}
              >
                <User className="h-4 w-4 text-slate-400" />
                {s.fullName}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
