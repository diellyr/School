# Histórico de versões

Este projeto segue um versionamento alinhado ao plano de fases descrito no `README.md`
(Fase 1 → Fase 7). Cada versão indica o que passou a estar **real e funcional**; o que
continua simulado em cada momento está detalhado em `docs/status.md`.

## v0.1.0 — Fase 1: Fundação

Primeira entrega executável do sistema.

**Adicionado**
- Estrutura do projeto (React 19 + TypeScript + Vite + Tailwind CSS v4), organizada em
  `domain/`, `repositories/`, `auth/`, `layout/`, `features/`.
- Modelo de dados completo (~40 entidades) em `src/domain/`, espelhando o futuro schema
  Postgres/Supabase.
- Camada de repositório desacoplada do IndexedDB (`Repository<T>` + `Local*Repository`
  via Dexie.js), com esqueleto de referência para `Supabase*Repository`.
- Autenticação simulada (modo demo) com 5 perfis (Owner, Administrador, Professor,
  Responsável, Aluno), hash de senha (SHA-256), bloqueio após tentativas inválidas e
  expiração de sessão.
- RBAC: matriz de permissões por perfil/módulo/ação, com sobreposições granulares por
  usuário/escola/turma/aluno e validade (`user_permissions`).
- CRUD completo de Escolas, Turmas, Alunos (com ficha detalhada) e Responsáveis, com
  exclusão lógica e restauração.
- Cadastro de Professores e listagem/bloqueio de Usuários.
- Auditoria funcional (`audit_logs`) para login, criação e edição.
- Backup local: exportação/restauração de todos os dados em JSON, com pré-visualização.
- Dados de demonstração: carregar/remover com confirmação, registros claramente
  marcados, operação idempotente.
- Layout responsivo (mobile/tablet/desktop), modo claro/escuro, busca global,
  breadcrumbs, estados vazios e skeleton loading.
- 17 testes automatizados (Vitest) cobrindo RBAC, CRUD/exclusão lógica do repositório
  base e carregamento/remoção dos dados de demonstração.
- Documentação: `README.md`, `docs/data-model.md`, `docs/supabase-migration.md`
  (schema SQL + políticas RLS sugeridas), `docs/status.md`.

**Simulado nesta versão** (navegável, com indicação clara da fase futura): dashboards de
Educação Infantil e Ensino Fundamental, importação de arquivos, lançamento manual,
alertas, eventos, portfólio, documentos, relatórios, sincronização com nuvem. Ver
`docs/status.md` para o detalhamento completo.

## v0.2.0 — Fase 2: Educação Infantil

- Atividades: cadastro por turma e categoria/campo de experiência BNCC.
- Avaliações: lançamento em lote da escala R/B/O por atividade, rascunho/publicação.
- Observações: professor (com controle de visibilidade) e responsável.
- Dashboard individual: cards, evolução por período, distribuição por categoria, radar
  por campo de experiência (com amostra mínima configurável), linha do tempo — a escala
  R/B/O nunca é exibida como nota numérica às famílias.

## v0.3.0 — Fase 3: Importação

- Assistente completo em etapas: tipo de documento, escopo/período/periodicidade (nunca
  deduzida da data do arquivo), armazenamento (aviso em destaque), upload, mapeamento de
  colunas (com sugestão automática por sinônimos), validação, duplicidades,
  pré-visualização com correção manual, confirmação e log.
- Parsing real de CSV (Papa Parse) e XLSX (SheetJS).
- Criação automática de registros para **Cadastro de aluno** e **Frequência**, com
  detecção de duplicidade; demais tipos ficam registrados no log para revisão manual.

## v0.4.0 — Fase 4: Comunicação e rotina

- Frequência: lançamento em lote por turma e data.
- Eventos: cadastro completo e confirmação de presença pelos responsáveis.
- Alertas: motor de regras simplificado e testado (nunca conclui a partir de um único
  registro), central com contestação/contexto.
- Portfólio: upload de arquivo vinculado ao aluno.
- Documentos: central com busca, filtro por categoria e download.
- Recomendações: cadastro com faixa etária, fonte e fluxo de aprovação.

## v0.5.0 — Fase 5: Ensino Fundamental

- Notas: lançamento por turma/disciplina/período respeitando a escala configurada pela
  escola (conceitos ou numérica) — a ordem de "melhor nota" nunca é assumida pelo código.
- Dashboard: notas normalizadas por escala apenas para gráficos de tendência (nunca
  misturando escalas diferentes), tabela de notas real, recuperações, frequência.

## v0.6.0 — Fase 6: Segurança e continuidade

- Sincronização: fila local (`sync_queue`), tela dedicada para simular pendências,
  sincronizar e resolver conflitos (manter local/remoto) — sempre rotulado como
  simulação em modo local, nunca finge estar conectada a um servidor real.
- Políticas de retenção de dados: CRUD de regras por tipo de entidade/prazo/ação.
- Auditoria avançada: filtros por usuário/módulo/ação/período, exportação CSV, motivo
  da ação, e registro automático de `view_sensitive` ao abrir a ficha de um aluno.
- Prontidão Supabase: `SupabaseBaseRepository` genérica e `Supabase*Repository` reais
  para organizations/schools/classes/students/guardians/student_guardians; schema SQL
  completo (~38 tabelas) e políticas RLS por organização → escola → turma → aluno →
  responsável; funções `security definer` para exclusão definitiva, gravação de
  auditoria e aplicação de políticas de retenção. `RepositoryProvider` já alterna
  Local*/Supabase* por `isSupabaseConfigured` — **nenhum projeto Supabase real foi
  provisionado nesta versão**, nenhuma variável de ambiente configurada, nenhuma
  migração executada; o app continua 100% em IndexedDB local.

## v0.7.0 — Fase 7: Importação avançada

- PDF: extração real de texto via PDF.js, com reconstrução heurística de colunas por
  posição — funciona bem para PDFs gerados de planilhas, não para PDFs escaneados.
- Imagem (OCR): reconhecimento real de texto via Tesseract.js, com indicador de
  progresso durante o reconhecimento e confiança por linha vinda diretamente do motor
  (nunca inventada).
- Pré-visualização: linhas com confiança abaixo de 70% destacadas; para qualquer
  importação vinda de PDF ou OCR, a confirmação fica bloqueada até o usuário marcar
  explicitamente que revisou manualmente todas as linhas.

## v0.8.0 — Contas reais, importação em lote e boletim BNCC

- Renomeado de "Acompanha Escola" para **Acompanha+** (login, barra lateral, título da aba,
  documentação).
- **Conta real sem depender de dados de demonstração**: aba "Criar conta" na tela de login cria uma
  organização própria e um usuário Owner reais (não-demo), permitindo logar num banco vazio e já
  começar a importar dados de teste. Carregar dados de demonstração continua disponível, na tela de
  login e em Configurações, para qualquer conta.
- **Relatórios de Educação Infantil e Ensino Fundamental sem pré-cadastro**: leem escola, turma,
  aluno, professor e atividade/disciplina direto do arquivo e cadastram automaticamente o que ainda
  não existir. Professores criados por essa via ficam com o login bloqueado até um Owner/Admin
  definir uma senha real em Professores.
- **Upload de até 10 arquivos por importação**, combinando formatos, com lista individual, remoção
  antes de confirmar, um mapeamento aplicado ao lote inteiro e resultado agregado + detalhado por
  arquivo.
- **Boletim por habilidades BNCC (checklist)**: interpretador dedicado para boletins impressos no
  formato "uma habilidade por linha × colunas de semestre" — o único tipo de importação que não
  exige nenhum pré-cadastro, já que lê escola/aluno/turma/data de nascimento do cabeçalho da
  própria folha. Não preenche os níveis R/B/O automaticamente (testado contra fotos reais: a leitura
  célula a célula não é confiável o suficiente) — anexa o arquivo original ao aluno em Documentos
  para lançamento manual em Avaliações.
- **OCR sem depender de CDN externo**: motor de reconhecimento, núcleo WebAssembly e dados de
  idioma (português) passam a ser hospedados no próprio app; antes de reconhecer o texto, o app
  testa as 4 rotações possíveis da imagem e usa a de maior confiança.
- Número da versão visível na tela de login e na barra lateral (`src/app/version.ts`).

## v0.8.1 — Aviso de atualização disponível

- Investigado relato de importação "sem OCR e sem opção de vários arquivos": o app em si já
  tinha essas funcionalidades (v0.8.0), mas o navegador do usuário estava com uma aba antiga
  aberta havia dias, rodando a versão anterior sem nenhuma dessas melhorias — problema comum em
  navegadores de celular, que mantêm abas na memória sem recarregar.
- **Aviso de nova versão**: o app agora verifica periodicamente (a cada 10 minutos e ao voltar
  para a aba) se já existe uma versão mais nova publicada e mostra uma barra fixa oferecendo
  atualizar com um clique, em vez do usuário continuar sem saber que está numa versão antiga.

## v0.8.2 — Progresso visível durante toda a leitura de OCR

- Investigado novo relato de importação "trava e não carrega nem 1 arquivo": desta vez era real —
  ao ler uma foto de boletim, o app testa o motor de OCR em 4 rotações da imagem antes do
  reconhecimento final (ver v0.8.0), e essa etapa toda acontecia sem nenhum indicador de progresso
  na tela. Numa foto grande e num aparelho mais lento isso pode levar dezenas de segundos, tempo
  em que a tela realmente parecia travada, mesmo com o processamento avançando normalmente.
- **Barra de progresso agora aparece assim que o arquivo é selecionado** (0%) e acompanha todas as
  etapas — carregar o motor de OCR, testar as 4 rotações e o reconhecimento final — em vez de ficar
  muda até a última etapa. Vale tanto para a importação de boletim BNCC quanto para a importação
  genérica por foto/OCR.

## v0.8.3 — Falha isolada por arquivo na confirmação do boletim BNCC

- Investigado relato "importou só o aluno, nada mais" após confirmar um boletim BNCC. Reproduzido em
  teste automatizado ponta a ponta que a criação de escola/turma/aluno/documento é sempre feita em
  conjunto — mas identificado que, se qualquer etapa depois da criação do aluno falhasse (ex.: gerar
  o hash do arquivo via `crypto.subtle`, indisponível em alguns navegadores embutidos de apps mesmo
  em HTTPS), a importação inteira parava sem aviso nenhum: o aluno já cadastrado ficava, mas escola
  reaproveitada/nova, turma, documento e log de importação nunca eram concluídos.
- **Hash do arquivo com alternativa**: se `crypto.subtle` não estiver disponível, usa um
  identificador simples baseado em nome/tamanho/data do arquivo em vez de travar a importação
  inteira — o hash aqui só serve para detectar duplicidade, não para segurança.
- **Falha isolada por arquivo**: se mesmo assim algum arquivo do lote falhar ao confirmar, os demais
  continuam sendo processados normalmente, e a tela de resultado agora lista quais arquivos falharam
  e por quê, em vez de simplesmente não terminar em silêncio.

## v0.8.4 — Casamento de escola/turma/aluno por nome tolera acentuação e espaçamento

- Investigado relato de que uma importação criou o documento e o aluno, mas o aluno não aparecia
  no Dashboard de Educação Infantil ao filtrar por escola/turma. A causa mais provável: como o
  nome da escola/turma é digitado (ou lido por OCR) de novo a cada importação, uma pequena
  diferença — acento, espaço duplo, maiúscula/minúscula — fazia o casamento por nome não
  reconhecer um registro já existente e criar um **novo** escola/turma quase idêntico, em vez de
  reaproveitar o correto. O aluno ficava então associado a uma escola/turma "duplicada" diferente
  da que aparecia selecionada no filtro do dashboard.
- **Casamento por nome agora ignora acentos, maiúsculas/minúsculas e espaçamento** ao decidir se
  cria escola, turma, aluno, professor, categoria/campo de experiência ou atividade — em todos os
  tipos de importação automática (EI, EF e boletim BNCC).
- **Turma agora também precisa ser do mesmo estágio (Educação Infantil/Ensino Fundamental)** para
  ser reaproveitada — um nome de turma como "B2" pode existir em mais de um estágio na mesma
  escola.
- Isso evita duplicidade em importações **futuras**; não mescla automaticamente duplicidades já
  criadas em tentativas anteriores — para essas, edite a ficha do aluno (em Alunos) e corrija a
  escola/turma manualmente.

## v0.9.0 — Leitura experimental de R/B/O do boletim BNCC (sempre em rascunho)

- A pedido explícito do usuário, mesmo após medir e mostrar que a leitura célula a célula tem baixa
  confiabilidade (ver v0.8.0): implementada uma tentativa de leitura automática do nível R/B/O de
  cada habilidade do boletim, usando a posição de cada palavra reconhecida na página para
  reconstruir a tabela (habilidade → coluna de semestre) — não depende mais só da leitura célula a
  célula recortada, mas de nenhuma forma resolve a causa raiz: fotos com inclinação/desfoque
  continuam produzindo texto pouco confiável.
- **Nunca publica automaticamente**: toda avaliação lida vira um rascunho (`publicationStatus:
  'draft'`) associado a uma Atividade criada para aquela habilidade, com a confiança da leitura
  registrada. Nada fica visível às famílias sem revisão.
- **Tela de revisão no resultado da importação**: lista cada avaliação lida (descrição, semestre,
  confiança, nível ajustável), com botão "Aprovar" individual e "Aprovar todas" em lote — só depois
  de aprovada a avaliação é publicada.
- **Testado contra foto real e documentado o resultado**: nessa foto específica, de ~30-40
  habilidades só 2 tiveram nível reconhecido com confiança minimamente utilizável (15-16%), e a
  descrição da habilidade associada a cada uma frequentemente sai ilegível — a tela de revisão
  deixa isso visível (confiança baixa, texto estranho) em vez de esconder a limitação.

## v0.9.1 — Dashboard individual do aluno, foto, edição de atividades

- **Ficha do aluno**: removida a mensagem antiga "chegam nas próximas fases" (estava desatualizada
  desde as Fases 2 e 5 — os dashboards já existem). Agora mostra um botão "Ver dashboard" que abre
  o Dashboard de Educação Infantil ou Ensino Fundamental já com a escola, turma e aluno certos
  selecionados, e uma seção de acesso rápido para Avaliações/Notas, Frequência, Portfólio e
  Documentos deste aluno.
- **Foto do aluno**: cadastro e edição de aluno passam a aceitar uma foto (JPEG ou PNG, até 5 MB),
  exibida no lugar das iniciais em Alunos e na ficha do aluno.
- **Atividades**: cada atividade agora pode ser **editada** e **excluída** (exclusão lógica,
  restaurável), além de um atalho "Lançar" que abre Avaliações (Educação Infantil) ou Notas (Ensino
  Fundamental) já com a atividade/turma/disciplina/período certos. A tabela também mostra o estágio
  de cada atividade. A criação de categoria direto no formulário de atividade já existia e continua
  disponível.
- **Avaliações** e **Notas** agora indicam explicitamente para qual etapa são (Educação Infantil e
  Ensino Fundamental, respectivamente), com link cruzado para a outra tela.

## v0.9.2 — Gerenciar categorias em Atividades

- Botão **"Categorias"** em Atividades abre uma lista de todas as categorias/campos de experiência
  já cadastrados, com opção de **renomear** e **excluir** (exclusão lógica) cada uma — antes só era
  possível criar uma categoria nova direto no formulário de atividade, sem forma de corrigir o nome
  de uma já existente.

## v0.9.3 — Evolução por categoria em 3 granularidades e gráfico aranha corrigido

- **Evolução por período** nos dois dashboards individuais (Educação Infantil e Ensino Fundamental)
  agora mostra três gráficos de linha lado a lado — **Anual**, **Semestral** e **Bimestral** — cada
  um só aparece preenchido quando há pelo menos dois pontos reais naquela granularidade (o período é
  texto livre digitado nas Atividades/Notas; quando não dá para identificar o semestre com
  confiança, o ponto fica de fora do gráfico semestral em vez de agrupar errado).
- Um filtro de **categoria** (Educação Infantil) ou **disciplina** (Ensino Fundamental) permite ver a
  evolução de um único campo isoladamente, em vez de sempre misturar tudo numa média geral.
- **Gráfico aranha corrigido**: antes só considerava categorias com um campo BNCC pré-definido — uma
  categoria criada manualmente pelo usuário (o caso mais comum hoje) nunca aparecia nele, mesmo com
  avaliações lançadas. Agora usa o nome de qualquer categoria/disciplina, mostrando em quais delas o
  aluno teve o melhor desempenho relativo.

## v0.9.4 — Corrigida a duplicação de categorias e adicionada a mesclagem

- **Causa raiz corrigida**: ao criar uma atividade e digitar um nome no campo "Ou criar nova
  categoria", o sistema sempre criava uma categoria nova — mesmo se já existisse uma com o mesmo
  nome (ou o mesmo nome com acentuação/maiúsculas/espaçamento diferentes). Digitar o nome mais de
  uma vez em telas diferentes gerava categorias **duplicadas**, e renomear uma delas no gerenciador
  de Categorias não corrigia as atividades que continuaram ligadas às outras duplicatas — por isso os
  gráficos (principalmente o gráfico aranha) continuavam mostrando as categorias erradas mesmo depois
  de renomear. Agora o sistema primeiro procura uma categoria já existente com nome equivalente antes
  de criar uma nova.
- **Mesclar categorias**: o gerenciador de Categorias (botão "Categorias" em Atividades) ganhou um
  botão **"Mesclar"** em cada categoria, para corrigir duplicatas que já existem. Ao mesclar, todas as
  atividades ligadas à categoria duplicada são reatribuídas para a categoria escolhida como destino, e
  a duplicada é removida (exclusão lógica). Isso é o que resolve os dados já cadastrados incorretamente
  — sem precisar recriar atividades.

## v0.9.5 — Corrigido o caminho que ainda deixava categoria "fantasma" nos gráficos

- A mesclagem lançada na v0.9.4 resolve duplicatas, mas quem excluía uma categoria duplicada
  **direto pelo ícone de lixeira** (em vez de usar "Mesclar") continuava com o problema: a
  categoria some da lista, mas as atividades continuam apontando para o registro excluído, e
  os gráficos buscam o nome da categoria pelo ID sem checar se ela foi excluída — por isso o
  nome antigo insistia em aparecer mesmo depois de excluir.
- **Exclusão direta agora é bloqueada** quando ainda há atividades usando a categoria (o botão de
  lixeira fica desabilitado, com uma dica explicando para mesclar em outra categoria primeiro) —
  isso evita esse problema para quem for excluir uma categoria daqui em diante.
- **Reparo do que já ficou "fantasma"**: o gerenciador de Categorias agora detecta categorias já
  excluídas que ainda têm atividades ligadas a elas e mostra um aviso no topo, com a opção de
  "Mesclar" essas atividades para uma categoria ativa — corrigindo diretamente os gráficos sem
  precisar recriar nada.

## v0.9.6 — Atividade excluída agora some de verdade do dashboard do aluno

- Encontrada a causa de "mesclei/excluí as categorias erradas e o gráfico continua igual" mesmo depois
  da v0.9.5: se a **atividade** (não só a categoria) fosse excluída diretamente em Atividades, o
  dashboard individual (Educação Infantil) continuava buscando essa atividade pelo ID sem checar se
  ela tinha sido excluída — então a avaliação lançada nela, e a categoria (mesmo já excluída),
  continuavam aparecendo nos gráficos como se nada tivesse mudado.
- Agora o dashboard ignora atividades excluídas ao montar os gráficos — excluir uma atividade em
  Atividades remove imediatamente ela (e a avaliação lançada nela) de todos os gráficos do aluno,
  como já acontecia para o restante do sistema.

## v0.9.7 — Mensagem do gráfico radar deixava de ser clara sobre "3 quê"

- O aviso de dados insuficientes do gráfico radar ("Comparação entre categorias"/"...entre disciplinas")
  dizia "são necessárias pelo menos 3 atividades avaliadas por categoria", o que dava a entender que
  eram necessárias 3 **categorias** — na verdade é cada categoria/disciplina que precisa de pelo menos 3
  avaliações/notas lançadas nela para entrar no gráfico. A mensagem agora deixa isso explícito e mostra
  quantas avaliações cada categoria/disciplina já tem (ex.: "Autonomia: 2/3"), para ficar claro o que
  falta lançar.

## v0.9.8 — Gráfico radar com anéis e legenda R/B/O

- O gráfico radar de Educação Infantil ("Comparação entre categorias") agora mostra os anéis
  claramente rotulados e coloridos: **R (regular) no centro**, **B (bom) no meio**, **O (ótimo)**
  na borda externa — mesmas cores usadas em "Distribuição por categoria" — com uma legenda abaixo
  do gráfico explicando cada anel.

## v0.9.9 — Quarto anel (ponto zero) no gráfico radar

- O gráfico radar de Educação Infantil ganhou um quarto anel, no centro, representando o ponto
  zero — a ordem de fora para dentro agora é **Ótimo → Bom → Regular → 0**, com a legenda abaixo
  do gráfico atualizada para mostrar os quatro anéis e suas cores.

## v0.10.0 — Novo módulo: Entrada e saída

- Registros ganhou o módulo **Entrada e saída**, para registrar o horário de chegada e de saída de
  cada aluno por escola, turma, data e período — complementa a Frequência (presente/falta) com o
  horário real de entrada/saída, quando a escola faz esse controle. Lançamento em lote por turma
  (como em Frequência), com edição de um horário já lançado no mesmo dia. Também disponível a
  partir de "Lançamento manual".

## Próximas versões previstas

| Versão | Escopo |
|---|---|
| v1.0.0 | Sistema completo conforme escopo do briefing original (relatórios/exportações formais em PDF/XLSX, ativação real do Supabase quando decidido) |
