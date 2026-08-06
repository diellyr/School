import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { APP_VERSION } from './version';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Em produção, alguns navegadores (sobretudo em celulares) mantêm uma aba antiga aberta na
 * memória por dias sem recarregar — o que faz o app continuar rodando uma versão desatualizada
 * mesmo depois de novas funcionalidades serem publicadas. Este componente verifica periodicamente
 * se já existe uma versão mais nova publicada e avisa o usuário, em vez de deixá-lo sem saber por
 * que o comportamento não bate com o que foi anunciado.
 */
export function UpdateChecker() {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let cancelled = false;
    const check = async () => {
      const deployed = await fetchDeployedVersion();
      if (!cancelled && deployed && deployed !== APP_VERSION) setNewVersion(deployed);
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!newVersion) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 bg-sky-600 px-4 py-2.5 text-sm text-white shadow-lg">
      <span>
        Nova versão do Acompanha+ disponível (v{newVersion}). Você está usando uma versão desatualizada (v{APP_VERSION}
        ).
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-white px-3 py-1 font-semibold text-sky-700 hover:bg-sky-50"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Atualizar agora
      </button>
    </div>
  );
}
