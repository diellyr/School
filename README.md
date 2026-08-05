# Acompanha Escola

Aplicativo web responsivo para acompanhamento escolar de crianças na Educação Infantil e no Ensino
Fundamental, com foco em pais, professores, alunos, administradores e Owner (dono da plataforma).

Esta versão é o **MVP local, Fase 1 (Fundação)**: roda inteiramente no navegador, persistindo dados em
**IndexedDB (Dexie.js)**. A arquitetura foi construída para que uma versão em nuvem (Supabase/Postgres)
seja plugada depois **sem reescrever as telas** — veja [`docs/supabase-migration.md`](docs/supabase-migration.md).

> Este é um ambiente de demonstração/desenvolvimento. Não insira dados reais de crianças.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Dexie.js (IndexedDB) · Zustand ·
React Hook Form + Zod · Recharts · dexie-react-hooks · Vitest

As dependências de importação de arquivos (SheetJS, Papa Parse, PDF.js, Tesseract.js/OCR) já estão
instaladas e prontas para as Fases 3 e 7.

## Como executar

```bash
npm install
npm run dev       # http://localhost:5173
```

Outros comandos:

```bash
npm run build      # type-check (tsc -b) + build de produção
npm run test        # roda a suíte de testes (Vitest)
npm run test:watch  # testes em modo watch
npm run lint         # oxlint
```

Não é necessário nenhum backend, chave de API ou variável de ambiente para rodar esta versão —
tudo funciona localmente no navegador via IndexedDB.

## Primeiro acesso

Na tela de login, clique em **"Carregar dados de demonstração"** (pede confirmação antes de criar
os registros). Isso cria duas escolas, quatro turmas, alunos de Educação Infantil e Ensino
Fundamental, responsáveis, professores, um administrador e um Owner, além de atividades, notas,
frequência, um alerta, um evento e uma recomendação de exemplo.

### Acessos de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Owner | `owner@demo.escola.app` | `owner123` |
| Administrador | `admin@demo.escola.app` | `admin123` |
| Professor(a) | `professor@demo.escola.app` | `prof123` |
| Responsável | `responsavel@demo.escola.app` | `resp123` |
| Aluno(a) | `aluno@demo.escola.app` | `aluno123` |

As senhas de demonstração nunca são gravadas em texto puro (hash SHA-256 no IndexedDB) e só existem
neste modo local — a arquitetura já está preparada para o Supabase Auth assumir a autenticação real.

Em **Configurações → Dados de demonstração** é possível remover todos os registros de demonstração
(claramente marcados) sem afetar cadastros reais.

## Estrutura do projeto

```
src/
  app/            bootstrap, roteamento, tema (claro/escuro)
  domain/         tipos de todas as entidades do modelo de dados (seção "Modelo de dados")
  db/             schema Dexie (IndexedDB) + seed de dados de demonstração
  repositories/   camada de repositório (interfaces + implementação Local*/Dexie + stub Supabase*)
  auth/           autenticação demo, RBAC (matriz de permissões) e hooks de autorização
  layout/         casca do app: sidebar, header, breadcrumbs, busca global, menu do usuário
  components/     componentes de UI reutilizáveis (Button, Card, Dialog, formulários, estados vazios…)
  features/       telas por módulo (alunos, responsáveis, escolas, turmas, auditoria, backup…)
  test/           setup do Vitest (fake-indexeddb, jest-dom)
docs/
  data-model.md            entidades, campos e relacionamentos
  supabase-migration.md    plano de migração, schema SQL e políticas RLS sugeridas
  status.md                o que é real e o que está simulado, por módulo
```

### Camada de repositório

Nenhuma tela acessa o Dexie/IndexedDB diretamente. Toda leitura/escrita passa por uma interface de
repositório (`src/repositories/interfaces/Repository.ts`) implementada hoje por `Local*Repository`
(Dexie). O `RepositoryProvider` (`src/repositories/RepositoryProvider.tsx`) é o único lugar que decide
qual implementação instanciar — quando o Supabase entrar (Fase 6), basta trocar essa fábrica por
`Supabase*Repository` (mesma interface, ver `src/repositories/supabase/*.example.ts`) sem tocar nas
páginas.

## Perfis e permissões

RBAC com cinco perfis (Owner, Administrador, Professor, Responsável, Aluno) definido em
`src/auth/permissions.ts`, com uma matriz padrão por perfil/módulo/ação e sobreposições granulares
por usuário/escola/turma/aluno (`user_permissions`, com data de início/expiração) que têm prioridade
sobre o padrão — ver a tela **Permissões do Owner** no app.

## O que está implementado nesta fase vs. o que está simulado

Veja o detalhamento completo em [`docs/status.md`](docs/status.md). Resumo:

- **Real e funcional:** estrutura do projeto, login demo com hashing de senha e bloqueio por
  tentativas inválidas, RBAC, IndexedDB via Dexie, CRUD completo de escolas/turmas/alunos/
  responsáveis/professores/usuários com exclusão lógica, auditoria, backup/restauração local (JSON),
  dados de demonstração, testes automatizados das regras críticas.
- **Simulado nesta fase:** dashboards de Educação Infantil e Ensino Fundamental, importação de
  arquivos, lançamento manual de atividades/notas/frequência, alertas automáticos, eventos,
  portfólio, documentos, relatórios/exportações, sincronização com nuvem — todos navegáveis pelo
  menu com indicação clara da fase em que serão entregues.

## Plano de fases

1. **Fundação** *(esta entrega)* — estrutura, login, layout, perfis, permissões, IndexedDB, escolas,
   turmas, alunos, responsáveis.
2. **Educação Infantil** — atividades, escala R/B/O, lançamento manual, dashboard, gráficos, observações.
3. **Importação** — CSV/XLSX, pré-visualização, mapeamento, validação, duplicidades, log.
4. **Comunicação e rotina** — alertas, eventos, frequência, portfólio, documentos.
5. **Ensino Fundamental** — escalas configuráveis, disciplinas, notas, dashboard próprio, relatórios.
6. **Segurança e continuidade** — auditoria avançada, sincronização, políticas, migração Supabase.
7. **Importação avançada** — PDF, OCR (JPEG/PNG), indicador de confiança, revisão humana.

## Diretrizes éticas e educacionais

O sistema não diagnostica transtornos, deficiências ou atrasos, e nunca fundamenta um alerta em uma
única nota/atividade isolada. A escala R/B/O da Educação Infantil nunca é apresentada como nota
absoluta às famílias, e comparações entre alunos só podem usar dados agregados e anônimos da turma,
sem ranking. Veja `src/domain/alerts.ts` (mensagens por nível de alerta) e a página **Ajuda e
privacidade** no app.
