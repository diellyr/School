import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Badge } from '../../components/Badge';

interface GuideEntry {
  title: string;
  description: string;
  comingSoon?: boolean;
}

interface GuideGroup {
  group: string;
  entries: GuideEntry[];
}

const GUIDE: GuideGroup[] = [
  {
    group: 'Dashboards',
    entries: [
      {
        title: 'Dashboard Educação Infantil / Ensino Fundamental',
        description:
          'Acompanhamento individual de um aluno: escolha escola, turma e aluno para ver evolução por período (anual/semestral/bimestral), comparação entre categorias ou disciplinas, distribuição de resultados, frequência, observações recentes e linha do tempo.',
      },
    ],
  },
  {
    group: 'Cadastros',
    entries: [
      { title: 'Alunos', description: 'Cadastro completo do aluno (dados pessoais, foto, turma) e ficha individual com acesso rápido a dashboard, avaliações/notas, frequência, entrada e saída, portfólio e documentos.' },
      { title: 'Responsáveis', description: 'Cadastro de responsáveis (pais/tutores) e o vínculo com os alunos que acompanham.' },
      { title: 'Professores', description: 'Cadastro de professores e vínculo com as turmas em que lecionam.' },
      { title: 'Escolas', description: 'Cadastro das escolas/unidades da organização.' },
      { title: 'Turmas', description: 'Cadastro de turmas por escola, ano letivo, etapa (Educação Infantil ou Ensino Fundamental) e turno.' },
    ],
  },
  {
    group: 'Registros',
    entries: [
      {
        title: 'Importação',
        description:
          'Assistente para importar dados em lote a partir de CSV, XLSX, PDF ou foto (OCR), com mapeamento de colunas e revisão antes de confirmar. Importações vindas de PDF ou foto exigem revisão manual obrigatória — a leitura automática pode errar.',
      },
      { title: 'Lançamento manual', description: 'Ponto de entrada único que reúne Atividades, Avaliações, Notas, Frequência, Entrada e saída, Observações, Alertas, Eventos e Portfólio em um só lugar.' },
      { title: 'Atividades', description: 'Cadastro de atividades por turma e categoria/campo de experiência (Educação Infantil) ou disciplina (Ensino Fundamental). Também é onde se gerenciam (renomear/mesclar/excluir) as categorias.' },
      { title: 'Avaliações', description: 'Lançamento em lote da escala R/B/O (Regular/Bom/Ótimo) para os alunos de uma atividade da Educação Infantil — nunca aparece como nota numérica para a família.' },
      { title: 'Notas', description: 'Lançamento de notas do Ensino Fundamental por turma, disciplina e período, respeitando a escala configurada pela escola (conceitos ou numérica).' },
      { title: 'Frequência', description: 'Registro de presença/falta por turma e data, em lote para todos os alunos da turma.' },
      { title: 'Entrada e saída', description: 'Registro do horário de entrada e saída de cada aluno por escola, turma, data e período — complementa a Frequência quando a escola faz esse controle.' },
    ],
  },
  {
    group: 'Comunicação',
    entries: [
      {
        title: 'Alertas',
        description:
          'Analisa os registros recentes de um aluno e sugere um nível de atenção (informativo, atenção, acompanhamento ou orientação profissional) com o motivo e quantos registros foram usados. Nunca é um diagnóstico — é um sinal para conversa entre família e escola.',
      },
      { title: 'Observações', description: 'Anotações pedagógicas do professor (com opção de deixar visível ou não para a família) e observações que a própria família pode registrar.' },
      { title: 'Eventos', description: 'Cadastro de eventos escolares (reuniões, passeios, festas) com data, local e opção de exigir confirmação de presença dos responsáveis.' },
      { title: 'Portfólio', description: 'Upload de fotos, vídeos e trabalhos do aluno, organizados por categoria, com confirmação de autorização de uso de imagem.' },
      { title: 'Documentos', description: 'Central de arquivos anexados aos alunos (boletins, atestados, etc.), com busca e filtro por categoria.' },
      { title: 'Relatórios', description: 'Ainda não disponível nesta versão.', comingSoon: true },
      {
        title: 'Recomendações',
        description:
          'Conteúdo de orientação por faixa etária (0 a 12+ anos) para escola e/ou família. Recomendações de fonte não validada ficam sinalizadas, e novas recomendações só ficam visíveis depois de aprovadas. Nunca substituem orientação profissional.',
      },
    ],
  },
  {
    group: 'Administração',
    entries: [
      { title: 'Usuários', description: 'Lista de contas do sistema, com opção de bloquear/desbloquear acesso.' },
      {
        title: 'Permissões do Owner',
        description:
          'Mostra a matriz de permissões padrão por perfil (Owner, Administrador, Professor, Responsável, Aluno). A concessão de permissões extras por usuário/escola/turma/aluno ainda não tem tela própria nesta versão.',
      },
      { title: 'Auditoria', description: 'Histórico (somente leitura) de quem fez o quê e quando no sistema, com filtros e exportação em CSV.' },
      {
        title: 'Sincronização',
        description:
          'Tela de demonstração da futura sincronização com a nuvem — hoje simula pendências e conflitos para fins de teste, sem estar conectada a nenhum servidor real.',
      },
      { title: 'Backup e restauração', description: 'Exporta todos os dados para um arquivo JSON e permite restaurar a partir desse arquivo, com prévia antes de confirmar.' },
      { title: 'Configurações', description: 'Tema claro/escuro, status de armazenamento, política de retenção de dados, e os botões para carregar ou remover os dados de demonstração.' },
    ],
  },
];

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
        <CardHeader><CardTitle>Guia de uso — o que cada módulo faz</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {GUIDE.map((section) => (
            <div key={section.group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.group}</p>
              <dl className="space-y-3">
                {section.entries.map((entry) => (
                  <div key={entry.title}>
                    <dt className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {entry.title}
                      {entry.comingSoon && <Badge tone="warning">Em breve</Badge>}
                    </dt>
                    <dd className="text-sm text-slate-600 dark:text-slate-300">{entry.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
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
