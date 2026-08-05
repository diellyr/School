import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';

export function HelpPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Ajuda e privacidade</h1>

      <Card>
        <CardHeader><CardTitle>Sobre este sistema</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Este é um ambiente de acompanhamento escolar para Educação Infantil e Ensino Fundamental, inspirado na
            BNCC, nas diretrizes do MEC para a Educação Infantil e em referências internacionais (UNESCO, UNICEF).
          </p>
          <p>
            O sistema <strong>não realiza diagnóstico</strong> de transtornos, deficiências ou atrasos. Alertas
            educacionais são sinais para acompanhamento e diálogo entre família e escola — nunca uma conclusão
            médica. Quando uma preocupação persistir, procure a coordenação pedagógica e, se necessário, um
            pediatra ou profissional habilitado.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Privacidade e LGPD</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <ul className="list-disc space-y-1 pl-5">
            <li>Coleta mínima de dados, sempre com finalidade explícita.</li>
            <li>Acesso a dados de crianças é controlado por vínculo (responsável), turma e escola.</li>
            <li>Toda visualização de dado sensível, importação, exportação e exclusão é registrada em auditoria.</li>
            <li>Exclusões são lógicas por padrão; a exclusão definitiva exige permissão específica e motivo registrado.</li>
            <li>Nesta versão local, os dados ficam apenas no navegador (IndexedDB) — nada é enviado a servidores.</li>
            <li>Senhas nunca são armazenadas em texto puro, mesmo no modo de demonstração.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ambiente de demonstração</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-600 dark:text-slate-300">
          <p>
            Os dados carregados pelo botão "Carregar dados de demonstração" são fictícios e claramente identificados.
            Eles podem ser removidos a qualquer momento em Configurações, sem afetar cadastros reais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
