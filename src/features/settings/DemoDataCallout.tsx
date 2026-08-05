import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { useDemoDataActions, useDemoDataStatus } from './useDemoData';

export function DemoDataCallout() {
  const loaded = useDemoDataStatus();
  const { loading, handleLoad } = useDemoDataActions();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loaded === undefined || loaded) return null;

  return (
    <>
      <Card className="border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30">
        <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Nenhum dado carregado ainda</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Carregue os dados de demonstração para explorar escolas, turmas, alunos e responsáveis fictícios.
              </p>
            </div>
          </div>
          <Button onClick={() => setConfirmOpen(true)} loading={loading}>
            Carregar dados de demonstração
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Carregar dados de demonstração?"
        description="Serão criadas escolas, turmas, alunos, responsáveis, professores e demais registros fictícios, claramente identificados como dados de demonstração."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              await handleLoad();
              setConfirmOpen(false);
            }}
            loading={loading}
          >
            Confirmar e carregar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
