# Acompanha Escola

Aplicativo web responsivo para acompanhamento escolar de crianças na Educação Infantil e no Ensino
Fundamental, com foco em pais, professores, alunos, administradores e Owner (dono da plataforma).

Esta versão entrega as **Fases 1 a 7** do plano abaixo: roda inteiramente no navegador, persistindo
dados em **IndexedDB (Dexie.js)**. A arquitetura foi construída para que uma versão em nuvem
(Supabase/Postgres) seja plugada depois **sem reescrever as telas** — o código dessa camada já existe
e compila, mas nenhum projeto Supabase real foi provisionado (ver
[`docs/supabase-migration.md`](docs/supabase-migration.md) e [`supabase/README.md`](supabase/README.md)).

> Este é um ambiente de demonstração/desenvolvimento. Não insira dados reais de crianças.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Dexie.js (IndexedDB) · Zustand ·
React Hook Form + Zod · Recharts · dexie-react-hooks · Vitest

A importação de CSV (Papa Parse), XLSX (SheetJS), PDF (PDF.js) e imagens com OCR (Tesseract.js) está
funcionando no assistente de importação (Fases 3 e 7) — importações vindas de PDF ou OCR exigem revisão
humana explícita antes de confirmar.

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

Há duas formas de começar, e elas não se excluem:

- **Criar uma conta real:** na tela de login, aba **"Criar conta"**, informe nome, o nome da sua
  escola/rede, e-mail e senha. Isso cria uma organização própria e uma conta Owner, sem nenhum dado
  de demonstração — ideal para já começar a importar seus próprios dados (assistente de
  Importação). Nenhum dado de exemplo é necessário para isso.
- **Carregar dados de demonstração:** na tela de login ou em **Configurações** (depois de já estar
  logado, inclusive com uma conta real), clique em **"Carregar dados de demonstração"** (pede
  confirmação antes de criar os registros). Isso cria duas escolas, quatro turmas, alunos de
  Educação Infantil e Ensino Fundamental, responsáveis, professores, um administrador e um Owner de
  demonstração, além de atividades, notas, frequência, um alerta, um evento e uma recomendação de
  exemplo — todos claramente marcados e removíveis a qualquer momento sem afetar dados reais.

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
  features/       telas por módulo: alunos, responsáveis, escolas, turmas, auditoria, backup,
                  early-childhood (atividades/dashboard EI), elementary (notas/dashboard EF),
                  assessments, attendance, alerts (+ motor de regras), events, observations,
                  portfolio, documents, imports (assistente CSV/XLSX/PDF/OCR), sync (fila de
                  sincronização), recommendations…
  test/           setup do Vitest (fake-indexeddb, jest-dom)
docs/
  data-model.md            entidades, campos e relacionamentos
  supabase-migration.md    plano de migração, schema SQL e políticas RLS
  status.md                o que é real e o que está simulado, por módulo
supabase/
  migrations/*.sql         schema completo, políticas RLS e funções privilegiadas (não aplicadas)
  README.md                passo a passo para ativar a nuvem quando/se decidido
```

### Camada de repositório

Nenhuma tela acessa o Dexie/IndexedDB diretamente. Toda leitura/escrita passa por uma interface de
repositório (`src/repositories/interfaces/Repository.ts`) implementada por `Local*Repository` (Dexie) e,
para as entidades mais usadas, também por `Supabase*Repository` real (`src/repositories/supabase/*.ts`).
O `RepositoryProvider` (`src/repositories/RepositoryProvider.tsx`) é o único lugar que decide qual
implementação instanciar, condicionado a `isSupabaseConfigured` — hoje sempre local, pois nenhuma
variável `VITE_SUPABASE_*` está definida.

## Perfis e permissões

RBAC com cinco perfis (Owner, Administrador, Professor, Responsável, Aluno) definido em
`src/auth/permissions.ts`, com uma matriz padrão por perfil/módulo/ação e sobreposições granulares
por usuário/escola/turma/aluno (`user_permissions`, com data de início/expiração) que têm prioridade
sobre o padrão — ver a tela **Permissões do Owner** no app.

## O que está implementado nesta fase vs. o que está simulado

Veja o detalhamento completo em [`docs/status.md`](docs/status.md). Resumo:

- **Real e funcional:** estrutura do projeto, login demo com hashing de senha e bloqueio por
  tentativas inválidas, RBAC, IndexedDB via Dexie, CRUD completo de escolas/turmas/alunos/
  responsáveis/professores/usuários com exclusão lógica, auditoria (incluindo filtros, exportação CSV
  e registro de acesso a dados sensíveis), backup/restauração local (JSON), dados de demonstração,
  testes automatizados das regras críticas — **e também** os dashboards de Educação Infantil e Ensino
  Fundamental (com gráficos reais), lançamento manual de atividades/avaliações/notas/frequência/
  observações, motor de alertas educacionais (testado), eventos com confirmação de presença, portfólio
  com upload de arquivo, central de documentos, recomendações, o assistente completo de importação de
  CSV/XLSX/PDF/OCR (com criação real de alunos e frequência a partir do arquivo, confiança por linha e
  revisão humana obrigatória para PDF/OCR) — **incluindo os relatórios de Educação Infantil e Ensino
  Fundamental, que leem escola/turma/aluno/professor/atividade direto do arquivo e cadastram
  automaticamente o que ainda não existir**, a fila de sincronização simulada com resolução de
  conflitos, as políticas de retenção de dados, e a prontidão de código para Supabase (repositórios,
  schema SQL, RLS, funções privilegiadas — nunca aplicados a um projeto real sem decisão explícita).
- **Simulado nesta fase:** relatórios/exportações formais em PDF/XLSX, banco de dados em nuvem
  (Supabase — código pronto, mas nenhum projeto real provisionado) e a criação automática de registros
  para os demais tipos de importação (eventos, observações, alertas, portfólio importados)
  — navegáveis pelo menu com indicação clara do que é simulado.

## Plano de fases

1. **Fundação** ✅ — estrutura, login, layout, perfis, permissões, IndexedDB, escolas, turmas, alunos,
   responsáveis.
2. **Educação Infantil** ✅ — atividades, escala R/B/O, lançamento manual, dashboard, gráficos, observações.
3. **Importação** ✅ — CSV/XLSX, pré-visualização, mapeamento, validação, duplicidades, log. *(criação
   automática de registros cobre cadastro de aluno e frequência; demais tipos ficam no log para
   revisão manual)*
4. **Comunicação e rotina** ✅ — alertas, eventos, frequência, portfólio, documentos, recomendações.
5. **Ensino Fundamental** ✅ — escalas configuráveis, disciplinas, notas, dashboard próprio.
6. **Segurança e continuidade** ✅ — auditoria avançada, sincronização simulada, políticas de retenção,
   código de migração Supabase (schema, RLS, repositórios) pronto e dormente.
7. **Importação avançada** ✅ — PDF (extração real de texto), OCR de imagens (JPEG/PNG) com Tesseract.js,
   indicador de confiança por linha, revisão humana obrigatória antes de confirmar.

Relatórios/exportações formais (PDF/XLSX, boletim) ainda são simulados.

## Diretrizes éticas e educacionais

O sistema não diagnostica transtornos, deficiências ou atrasos, e nunca fundamenta um alerta em uma
única nota/atividade isolada. A escala R/B/O da Educação Infantil nunca é apresentada como nota
absoluta às famílias, e comparações entre alunos só podem usar dados agregados e anônimos da turma,
sem ranking. Veja `src/domain/alerts.ts` (mensagens por nível de alerta) e a página **Ajuda e
privacidade** no app.
