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

## Próximas versões previstas

| Versão | Fase | Escopo |
|---|---|---|
| v0.2.0 | Fase 2 — Educação Infantil | Atividades, escala R/B/O, lançamento manual, dashboard, gráficos, observações |
| v0.3.0 | Fase 3 — Importação | CSV/XLSX, pré-visualização, mapeamento, validação, duplicidades, log |
| v0.4.0 | Fase 4 — Comunicação e rotina | Alertas, eventos, frequência, portfólio, documentos |
| v0.5.0 | Fase 5 — Ensino Fundamental | Escalas configuráveis, disciplinas, notas, dashboard próprio, relatórios |
| v0.6.0 | Fase 6 — Segurança e continuidade | Auditoria avançada, sincronização, políticas, migração Supabase |
| v0.7.0 | Fase 7 — Importação avançada | PDF, OCR (JPEG/PNG), indicador de confiança, revisão humana |
| v1.0.0 | — | Sistema completo conforme escopo do briefing original |
