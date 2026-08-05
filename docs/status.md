# O que é real e o que está simulado

Esta versão entrega a **Fase 1 (Fundação)** do plano por fases descrito no README. Esta página lista,
sem ambiguidade, o que funciona de ponta a ponta hoje e o que ainda é placeholder navegável.

## ✅ Real e funcional

| Área | Detalhe |
|---|---|
| Estrutura do projeto | React + TypeScript + Vite + Tailwind, arquitetura modular por `features/`, camada de repositório desacoplada do IndexedDB |
| Persistência | IndexedDB via Dexie.js, com schema versionado (`src/db/schema.ts`) cobrindo todas as ~40 entidades do modelo de dados |
| Autenticação | Login demo com 5 perfis, senha com hash SHA-256 (nunca texto puro), bloqueio após 5 tentativas inválidas, expiração de sessão (TTL) |
| RBAC | Matriz de permissões por perfil/módulo/ação (`src/auth/permissions.ts`) + estrutura de sobreposição granular por usuário/escola/turma/aluno com validade (`user_permissions`) |
| Escolas / Turmas | CRUD completo, com criação automática de ano letivo quando necessário |
| Alunos | CRUD completo, ficha do aluno com dados, responsáveis vinculados e histórico de matrícula; escopo de visualização restrito para o perfil Aluno |
| Responsáveis | CRUD completo, vínculo N:N com alunos (`student_guardians`), um responsável pode ter vários filhos e um aluno pode ter vários responsáveis |
| Professores | Cadastro (cria usuário + atribuição de turma) e listagem |
| Usuários | Listagem, bloqueio/desbloqueio manual (Owner/Admin) |
| Auditoria | Login, criação e edição de escolas/turmas/alunos/responsáveis/professores/usuários já gravam em `audit_logs`, com tela de consulta |
| Permissões do Owner | Visualização da matriz padrão por perfil e das sobreposições cadastradas (editor completo de concessão fica para fase futura) |
| Backup local | Exportação de todos os dados do IndexedDB para JSON e restauração com pré-visualização por tabela |
| Dados de demonstração | Botão de carregar/remover, com confirmação, registros claramente marcados (`isDemo`), idempotente |
| Testes automatizados | RBAC (perfis e precedência de sobreposições), CRUD + exclusão lógica/restauração do repositório base, carregamento/remoção idempotente dos dados de demonstração |
| Tema | Modo claro/escuro persistido, layout responsivo (mobile, tablet, desktop) |

## 🚧 Navegável, mas simulado (chega em fase futura)

Estas rotas existem no menu e mostram uma tela "Módulo previsto para a Fase X" — a navegação, o
roteamento e as permissões que decidem se o item aparece no menu já estão prontos; falta a tela em si.

| Módulo | Fase prevista |
|---|---|
| Dashboard Educação Infantil (escala R/B/O, gráficos, radar, comparativos) | Fase 2 |
| Lançamento manual de atividades/avaliações | Fase 2 |
| Atividades / Avaliações | Fase 2 |
| Importação de arquivos (CSV, XLSX, PDF, imagens/OCR) | Fases 3 e 7 |
| Frequência (lançamento) | Fase 4 |
| Alertas educacionais (motor de regras) e central de alertas do professor | Fase 4 |
| Observações (lançamento) | Fase 4 |
| Eventos escolares (cadastro/calendário) | Fase 4 |
| Portfólio (upload de itens) | Fase 4 |
| Documentos (central) | Fase 4 |
| Recomendações (curadoria/publicação) | Fase 4 |
| Notas / Dashboard Ensino Fundamental | Fase 5 |
| Relatórios e exportações (PDF/XLSX/CSV) | Fases 5–6 |
| Sincronização com nuvem | Fase 6 |

> Observação: os dados de demonstração já incluem exemplos de atividades R/B/O, notas, frequência,
> um alerta e um evento no IndexedDB — isso valida que o **modelo de dados e a camada de persistência**
> estão prontos para essas telas; o que falta é a interface de cada módulo.

## 🔒 Simulado por natureza do MVP local (fica pronto, mas "desligado")

| Item | Situação |
|---|---|
| Banco de dados em nuvem (Supabase) | Arquitetura pronta (`Repository<T>`, `RepositoryProvider`, stub `Supabase*Repository`), toggle em Configurações mostrado como indisponível nesta versão |
| Autenticação real (Supabase Auth) | `authStore.loginWithPassword()` isola o ponto de troca; hoje compara hash local |
| Row Level Security | Só existe como SQL sugerido em `docs/supabase-migration.md`; localmente a restrição de escopo é feita na camada de aplicação (hooks de permissão) |
| OCR / leitura de PDF | Bibliotecas (`pdfjs-dist`, `tesseract.js`) já instaladas, sem tela de importação ainda |

## Como verificar

```bash
npm run build   # type-check completo + build de produção
npm run test    # suíte de testes (17 casos cobrindo RBAC, repositório e seed)
npm run dev     # app completo, use "Carregar dados de demonstração" na tela de login
```
