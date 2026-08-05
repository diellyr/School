# O que é real e o que está simulado

Esta versão entrega as **Fases 1 a 7** do plano por fases descrito no README. Esta página lista, sem
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

### Segurança e continuidade (Fase 6)

| Área | Detalhe |
|---|---|
| Fila de sincronização | `sync_queue` local (`src/features/sync/SyncPage.tsx`): simula pendências, sincroniza (com falhas ocasionais realistas) e resolve conflitos (manter local/remoto) — sempre rotulado como "modo local (IndexedDB)"/"simulado", nunca finge estar conectado a um servidor real |
| Políticas de retenção | CRUD de regras por tipo de entidade/prazo/ação (`src/features/settings/RetentionPoliciesCard.tsx`), persistidas em `data_retention_rules` |
| Auditoria avançada | Filtros por usuário/módulo/ação/período, exportação CSV, motivo da ação, e registro de `view_sensitive` ao abrir a ficha de um aluno (`src/features/audit/AuditPage.tsx`, `StudentDetailPage.tsx`) |
| Prontidão Supabase | `SupabaseBaseRepository` + `Supabase*Repository` reais para organizations/schools/classes/students/guardians/student_guardians (`src/repositories/supabase/*.ts`), schema SQL completo e políticas RLS por organização → escola → turma → aluno → responsável (`supabase/migrations/*.sql`), funções `security definer` para exclusão definitiva/auditoria/retenção. `RepositoryProvider` já alterna Local*/Supabase* por `isSupabaseConfigured` — **hoje sempre local**, pois nenhum projeto Supabase foi provisionado nem variável de ambiente configurada. Ver `supabase/README.md`. |

### Importação avançada (Fase 7)

| Área | Detalhe |
|---|---|
| PDF | Extração real de texto via PDF.js (`parsePdfFile` em `src/features/imports/parseFile.ts`); reconstrução de colunas por heurística de posição — funciona bem para PDFs gerados de planilhas, não para PDFs escaneados (aí é preciso usar a importação por imagem) |
| Imagem (OCR) | Reconhecimento de texto real via Tesseract.js (`parseImageFile`), com indicador de progresso durante o reconhecimento e confiança por linha vinda diretamente do motor (nunca inventada) |
| Confiança e revisão humana | Linhas com confiança abaixo de 70% são destacadas na pré-visualização; para qualquer importação vinda de PDF ou OCR, o botão "Confirmar importação" fica bloqueado até o usuário marcar explicitamente que revisou manualmente todas as linhas |

### Testes automatizados

RBAC (perfis e precedência de sobreposições), CRUD + exclusão lógica/restauração do repositório base,
carregamento/remoção idempotente dos dados de demonstração, e o motor de alertas (nunca conclui a
partir de um único registro).

## 🚧 Navegável, mas simulado (chega em fase futura)

| Módulo | Fase prevista |
|---|---|
| Relatórios e exportações (PDF/XLSX/CSV, boletim) | Fase futura |
| Criação automática de registros para relatórios EI/EF, eventos, observações, alertas e portfólio importados | Próxima iteração da Fase 3 |

## 🔒 Simulado por natureza do MVP local (fica pronto, mas "desligado")

| Item | Situação |
|---|---|
| Banco de dados em nuvem (Supabase) | Código completo e compilando (repositórios, schema SQL, RLS, funções privilegiadas — ver Fase 6 acima), mas **nenhuma migração foi executada contra um projeto real** e nenhuma variável `VITE_SUPABASE_*` está configurada — decisão explícita de ativar fica para quando houver um projeto Supabase real autorizado |
| Autenticação real (Supabase Auth) | `authStore.loginWithPassword()` isola o ponto de troca; hoje compara hash local |
| Row Level Security | Políticas SQL reais em `supabase/migrations/0002_rls_policies.sql`, nunca aplicadas contra um banco real; localmente a restrição de escopo é feita na camada de aplicação (hooks de permissão) |
| OCR em ambiente com rede restrita | O reconhecimento em si depende de um download de dados de idioma (Tesseract.js); em ambientes com bloqueio de saída para CDNs esse download falha — a extração de PDF e todo o resto do fluxo (progresso, confiança, revisão obrigatória) funcionam normalmente |

## Como verificar

```bash
npm run build   # type-check completo + build de produção
npm run test    # suíte de testes automatizados
npm run dev     # app completo, use "Carregar dados de demonstração" na tela de login
```

Testado manualmente (Playwright) o fluxo completo de cada módulo com dados de demonstração: login por
perfil, dashboards, lançamento de atividades/avaliações/notas/frequência, alertas, eventos, portfólio,
documentos e importação de CSV e PDF — incluindo a criação real de um aluno via importação, a detecção
de duplicidade, o bloqueio de confirmação sem revisão manual em importações de PDF/OCR, e o tratamento
de erro (sem crash) quando o download dos dados de idioma do OCR falha por restrição de rede do
ambiente de teste.
