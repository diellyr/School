import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { useAuthStore } from '../auth/authStore';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);

  if (!isDemoMode || dismissed) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>
        Ambiente de demonstração local — os dados ficam apenas neste navegador (IndexedDB) e podem ser perdidos se o
        histórico ou os dados do site forem apagados.
      </span>
      <button onClick={() => setDismissed(true)} className="ml-auto shrink-0 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40" aria-label="Dispensar aviso">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
