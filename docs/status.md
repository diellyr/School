# O que é real e o que está simulado

Esta versão entrega as **Fases 1 a 5** do plano por fases descrito no README. Esta página lista, sem
ambiguidade, o que funciona de ponta a ponta hoje e o que ainda é placeholder navegável.

## ✅ Real e funcional

### Fundação (Fase 1)

| Área | Detalhe |
|---|---|
| Estrutura do projeto | React + TypeScript + Vite + Tailwind, arquitetura modular por `features/`, camada de repositório desacoplada do IndexedDB |
| Persistência | IndexedDB via Dexie.js, com schema versionado (`src/db/schema.ts`) cobrindo todas as ~40 entidades do modelo de dados |
| Autenticação | Login demo com 5 perfis, senha com hash SHA-256 (nunca texto puro), bloqueio após 5 tentativas inválidas, expiração de sessão (TTL) |
| RBAC | Matriz de permissões por perfil/módulo/ação (`src/auth/permissions.ts`) + estrutura de sobreposição granular por usuário/escola/turma/aluno com validade (`user_permissions`) |
| Escolas / Turmas | CRUD completo, com criação automática de ano letivo quando necessário |
| Alunos | CRUD completo, ficha do aluno com dados, responsáveis vinculados e histórico de matrícula; escopo de visualização restrito para o perfil Aluno |
| Responsáveis | CRUD completo, vínculo N:N com alunos (`student_guardians`) |
| Professores / Usuários | Cadastro, listagem, bloqueio/desbloqueio manual |
| Auditoria | Ações sensíveis (login, criação, edição, importação, publicação) gravam em `audit_logs`, com tela de consulta |
| Permissões do Owner | Visualização da matriz padrão por perfil e das sobreposições cadastradas |
| Backup local | Exportação de todos os dados do IndexedDB para JSON e restauração com pré-visualização por tabela |
| Dados de demonstração | Carregar/remover com confirmação, registros marcados (`isDemo`), idempotente |
| Tema | Modo claro/escuro persistido, layout responsivo |

### Educação Infantil (Fase 2)

| Área | Detalhe |
|---|---|
| Atividades | Cadastro por turma, categoria/campo de experiência BNCC (com criação de categoria embutida no formulário) |
| Avaliações | Lançamento em lote da escala R/B/O por atividade, com rascunho e publicação |
| Observações | Professor (com controle de visibilidade para responsáveis) e comentários das famílias |
| Dashboard | Cards de indicadores, evolução por período (linha), distribuição por categoria (barras), radar por campo de experiência (com amostra mínima configurável), linha do tempo, alertas ativos — a escala nunca é exibida como nota numérica às famílias |

### Comunicação e rotina (Fase 4)

| Área | Detalhe |
|---|---|
| Frequência | Lançamento em lote por turma e data, com atalhos "marcar todos" |
| Eventos | Cadastro completo (tipo, presença dos pais, autorização, custo) e confirmação de presença pelos responsáveis |
| Alertas | Motor de regras simplificado (`src/features/alerts/alertEngine.ts`, testado) que nunca conclui a partir de um único registro; central com contestação/contexto |
| Portfólio | Upload de arquivo (leitura local + hash), vínculo ao aluno, visualização em galeria |
| Documentos | Central com busca, filtro por categoria, download; populada automaticamente por uploads do portfólio |
| Recomendações | Cadastro com faixa etária, ambiente, fonte e sinalização de "fonte não validada"; fluxo de aprovação para publicação |

### Ensino Fundamental (Fase 5)

| Área | Detalhe |
|---|---|
| Notas | Lançamento por turma/disciplina/período respeitando a escala configurada pela escola (conceitos ou numérica) — a ordem de "melhor nota" nunca é assumida pelo código |
| Dashboard | Notas normalizadas por escala apenas para gráficos de tendência (nunca misturando escalas diferentes), tabela de notas com o valor real lançado, recuperações, abaixo do critério, frequência |

### Importação (Fase 3)

| Área | Detalhe |
|---|---|
| Assistente em etapas | Tipo de documento → escopo/período/periodicidade (nunca deduzida da data) → armazenamento (aviso em destaque) → upload → mapeamento de colunas → validação/duplicidades → pré-visualização com correção manual → confirmação → log |
| Parsing real | CSV (Papa Parse) e XLSX (SheetJS) |
| Criação automática de registros | **Cadastro de aluno** e **Frequência** criam/atualizam registros reais, com detecção de duplicidade (nome/aluno+data) |
| Demais tipos | Relatórios EI/EF, eventos, observações, alertas e portfólio passam pelo pipeline completo (upload, mapeamento, log), mas ainda não criam os registros automaticamente — ficam no log de importação para revisão manual |
| Log de importação | Tela própria com histórico, contagens de encontrados/importados/rejeitados/duplicados e local de armazenamento |

### Testes automatizados

RBAC (perfis e precedência de sobreposições), CRUD + exclusão lógica/restauração do repositório base,
carregamento/remoção idempotente dos dados de demonstração, e o motor de alertas (nunca conclui a
partir de um único registro).

## 🚧 Navegável, mas simulado (chega em fase futura)

| Módulo | Fase prevista |
|---|---|
| Relatórios e exportações (PDF/XLSX/CSV, boletim) | Fases 5–6 |
| Sincronização com nuvem | Fase 6 |
| Importação de PDF e imagens com OCR | Fase 7 |
| Criação automática de registros para relatórios EI/EF, eventos, observações, alertas e portfólio importados | Próxima iteração da Fase 3 |

## 🔒 Simulado por natureza do MVP local (fica pronto, mas "desligado")

| Item | Situação |
|---|---|
| Banco de dados em nuvem (Supabase) | Arquitetura pronta (`Repository<T>`, `RepositoryProvider`, stub `Supabase*Repository`), toggle mostrado como indisponível nesta versão — inclusive no assistente de importação |
| Autenticação real (Supabase Auth) | `authStore.loginWithPassword()` isola o ponto de troca; hoje compara hash local |
| Row Level Security | Só existe como SQL sugerido em `docs/supabase-migration.md`; localmente a restrição de escopo é feita na camada de aplicação (hooks de permissão) |
| OCR / leitura de PDF | Bibliotecas (`pdfjs-dist`, `tesseract.js`) já instaladas, sem tela de importação ainda |

## Como verificar

```bash
npm run build   # type-check completo + build de produção
npm run test    # suíte de testes automatizados
npm run dev     # app completo, use "Carregar dados de demonstração" na tela de login
```

Testado manualmente (Playwright) o fluxo completo de cada módulo com dados de demonstração: login por
perfil, dashboards, lançamento de atividades/avaliações/notas/frequência, alertas, eventos, portfólio,
documentos e importação de CSV — incluindo a criação real de um aluno via importação e a detecção de
duplicidade.
