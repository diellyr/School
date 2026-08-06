# Manual do usuário — Acompanha+

Este manual explica, em linguagem simples, o que cada tela do Acompanha+ faz e como usá-la.
Ele é voltado para quem usa o dia a dia do sistema (professores, coordenação, responsáveis) — não
para quem desenvolve o app. Para instruções técnicas (instalação, stack, deploy), veja o
[`README.md`](../README.md).

> O que aparece para você depende do seu perfil de acesso (Owner, Administrador, Professor,
> Responsável ou Aluno) — é normal um responsável não ver, por exemplo, o menu Administração.

## Sumário

- [Primeiro acesso](#primeiro-acesso)
- [Dashboards](#dashboards)
- [Cadastros](#cadastros)
- [Registros](#registros)
- [Comunicação](#comunicação)
- [Administração](#administração)
- [Privacidade e dados de demonstração](#privacidade-e-dados-de-demonstração)

## Primeiro acesso

Existem duas formas de começar a usar o sistema:

- **Criar uma conta real**: na tela de login, aba "Criar conta", informe seu nome, o nome da
  escola/rede, e-mail e senha. Isso cria sua organização e uma conta Owner (dono da plataforma),
  sem nenhum dado de exemplo — pronta para você importar ou cadastrar seus próprios dados.
- **Carregar dados de demonstração**: na tela de login ou em Configurações, o botão "Carregar
  dados de demonstração" cria escolas, turmas, alunos, responsáveis, professores e alguns
  registros de exemplo (atividades, notas, frequência, um alerta, um evento) — tudo claramente
  identificado como demonstração e removível a qualquer momento, sem afetar dados reais.

Depois de logado, o menu lateral está organizado em cinco grupos: **Dashboards**, **Cadastros**,
**Registros**, **Comunicação** e **Administração** — cada um explicado abaixo.

## Dashboards

### Dashboard Educação Infantil / Dashboard Ensino Fundamental

Tela de acompanhamento individual de um aluno. Escolha escola, turma e aluno nos filtros do topo
para ver:

- **Evolução por período**: três gráficos de linha (anual, semestral e bimestral) mostrando a
  tendência do aluno ao longo do tempo, com filtro por categoria (Educação Infantil) ou disciplina
  (Ensino Fundamental).
- **Distribuição por categoria/disciplina**: gráfico de barras com o resultado agrupado.
- **Comparação entre categorias/disciplinas**: gráfico radar mostrando em quais áreas o aluno teve
  melhor desempenho relativo — só aparece preenchido quando já há avaliações suficientes lançadas.
- **Frequência, observações recentes, alertas ativos e linha do tempo** do aluno.

Na Educação Infantil a escala usada é sempre R/B/O (Regular/Bom/Ótimo) — nunca aparece como nota
numérica para a família. No Ensino Fundamental as notas são normalizadas apenas para os gráficos de
tendência; o boletim mostra sempre o valor real lançado.

## Cadastros

| Tela | O que fazer aqui |
|---|---|
| **Alunos** | Cadastrar/editar alunos (dados pessoais, foto de até 5 MB em JPEG/PNG, turma). A ficha de cada aluno tem um botão "Ver dashboard" e uma seção "Acesso rápido" para ir direto a Avaliações/Notas, Frequência, Entrada e saída, Portfólio e Documentos daquele aluno. |
| **Responsáveis** | Cadastrar responsáveis (pais/tutores) e vincular a um ou mais alunos. |
| **Professores** | Cadastrar professores e vincular às turmas em que lecionam. |
| **Escolas** | Cadastrar as escolas/unidades da organização. |
| **Turmas** | Cadastrar turmas por escola, ano letivo, etapa (Educação Infantil ou Ensino Fundamental) e turno. |

## Registros

### Importação

Assistente em etapas para importar dados em lote a partir de **CSV, XLSX, PDF ou foto (OCR)**, com
mapeamento de colunas, validação, detecção de duplicidade e pré-visualização antes de confirmar.
Aceita até 10 arquivos por vez. **Importações vindas de PDF ou foto exigem revisão manual
obrigatória antes de confirmar** — a leitura automática desses formatos pode errar, especialmente
em fotos de boletins impressos.

### Lançamento manual

Não é um módulo em si — é um ponto de entrada único que reúne, em cards, os atalhos para
Atividades, Avaliações, Notas, Frequência, Entrada e saída, Observações, Alertas, Eventos e
Portfólio, filtrados pelo que você tem permissão de usar.

### Atividades

Cadastro de atividades por turma, com **categoria/campo de experiência** (Educação Infantil) ou
disciplina (Ensino Fundamental). O botão "Categorias" abre o gerenciador de categorias, onde é
possível **renomear**, **excluir** (só quando nenhuma atividade estiver mais usando a categoria) ou
**mesclar** uma categoria duplicada em outra — mesclar reatribui automaticamente todas as
atividades da categoria de origem para a categoria escolhida como destino.

### Avaliações

Lançamento em lote da escala **R/B/O** (Regular, Bom, Ótimo) para todos os alunos de uma atividade
da Educação Infantil, com rascunho e publicação.

### Notas

Lançamento de notas do Ensino Fundamental por turma, disciplina e período, respeitando a escala
configurada pela escola (conceitos ou numérica — a ordem de "melhor nota" nunca é assumida
automaticamente pelo sistema).

### Frequência

Lançamento de presença/falta em lote, por turma e data — marque todos presentes ou ajuste aluno a
aluno.

### Entrada e saída

Registro do **horário de entrada e saída** de cada aluno, por escola, turma, data e período.
Complementa a Frequência (que só registra presente/falta) quando a escola faz controle de
horário. Escolha escola → turma → data → período, e preencha os campos "Entrada" e "Saída" de cada
aluno da turma; salvar de novo no mesmo dia atualiza o horário já lançado em vez de duplicar.

## Comunicação

### Alertas

Ferramenta de apoio: você escolhe um aluno e o sistema analisa os registros recentes (atividades
avaliadas, período, nível predominante) e sugere um nível de atenção — **informativo, atenção,
acompanhamento ou orientação profissional** — junto com o motivo e quantos registros foram usados
para chegar a essa sugestão. **Nunca é um diagnóstico médico**; é um sinal para conversa entre
família e escola. Responsáveis e professores podem contestar um alerta ativo com uma nota.

### Observações

Anotações pedagógicas do professor sobre um aluno, com a opção de marcar como "visível para os
responsáveis" ou mantê-la interna. A família também pode registrar suas próprias observações, que
não ficam visíveis ao professor.

### Eventos

Cadastro de eventos escolares (reuniões, passeios, festas) com data/horário, local, público-alvo
(turma ou escola toda) e opção de exigir confirmação de presença dos responsáveis. Responsáveis
confirmam ou recusam presença diretamente na tela.

### Portfólio

Upload de fotos, vídeos, textos e outros trabalhos do aluno, organizados por categoria, com
confirmação obrigatória de autorização de uso de imagem antes de salvar.

### Documentos

Central de arquivos anexados a um aluno (boletins, atestados, etc.), com busca por nome e filtro
por categoria. Nesta versão, os arquivos ficam armazenados **somente no navegador** — não são
enviados a nenhum servidor.

### Relatórios

Ainda não disponível nesta versão.

### Recomendações

Conteúdo de orientação por faixa etária (de 0 a 12+ anos), para uso da escola e/ou da família.
Recomendações de fonte não validada ficam sinalizadas com um aviso, e recomendações novas só ficam
visíveis a todos depois de aprovadas por um administrador/Owner. **Nunca substituem orientação
profissional.**

## Administração

> Este grupo normalmente só aparece para Administradores e o Owner.

| Tela | O que fazer aqui |
|---|---|
| **Usuários** | Ver a lista de contas do sistema e bloquear/desbloquear acesso. |
| **Permissões do Owner** | Consultar a matriz de permissões padrão de cada perfil (o que cada perfil pode ver, criar, editar, excluir, etc. em cada módulo). A concessão de permissões extras por usuário específico ainda não tem tela própria nesta versão. |
| **Auditoria** | Histórico, somente leitura, de quem fez o quê e quando no sistema — com filtros por usuário/módulo/ação/período e exportação em CSV. |
| **Sincronização** | Tela de demonstração da futura sincronização com a nuvem: hoje simula pendências e conflitos só para fins de teste, sem estar conectada a nenhum servidor real. |
| **Backup e restauração** | Exportar todos os dados para um arquivo JSON (backup) e restaurar a partir desse arquivo, com uma prévia de quantos registros serão trazidos antes de confirmar. |
| **Configurações** | Tema claro/escuro, status de armazenamento, política de retenção de dados, e os botões para carregar ou remover os dados de demonstração. |

## Privacidade e dados de demonstração

- Coleta mínima de dados, sempre com finalidade explícita.
- O acesso a dados de uma criança é controlado por vínculo (responsável), turma e escola.
- Toda visualização de dado sensível, importação, exportação e exclusão fica registrada em Auditoria.
- Exclusões são lógicas por padrão (podem ser restauradas); exclusão definitiva exige permissão
  específica e motivo registrado.
- Nesta versão local, os dados ficam apenas no navegador (IndexedDB) — nada é enviado a servidores.
- Os dados carregados pelo botão "Carregar dados de demonstração" são fictícios e claramente
  identificados; podem ser removidos a qualquer momento em Configurações, sem afetar cadastros reais.
- O sistema **não realiza diagnóstico** de transtornos, deficiências ou atrasos — alertas e
  recomendações são sinais para diálogo entre família e escola, nunca uma conclusão médica.
