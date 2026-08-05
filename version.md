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

## Próximas versões previstas

| Versão | Escopo |
|---|---|
| v1.0.0 | Sistema completo conforme escopo do briefing original (relatórios/exportações formais em PDF/XLSX, ativação real do Supabase quando decidido) |
