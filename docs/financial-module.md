# Módulo financeiro (Parcelas, Bolsas e Central de Alertas)

Este documento descreve a arquitetura do conjunto financeiro (`src/features/financial/`,
`src/features/scholarships/`, `src/features/notifications/`): mensalidades, descontos de
bolsa, baixa de pagamento e a Central de Alertas unificada. Complementa
[`docs/data-model.md`](data-model.md).

## Arquitetura

```
Telas (React)
  InstallmentsPage, ScholarshipsPage, FinancialDashboardPage, NotificationsPage,
  NotificationBell, StudentFinancialSection
       │
       ▼
Serviços puros (sem acesso a IndexedDB — testados por fixtures em memória)
  financialCalculationService  — desconto, valor final, status de parcela, valor restante
  scholarshipService           — vigência por competência, status de bolsa, conflito, prévia de impacto
  installmentGeneratorService  — prévia de geração em lote + detecção de duplicidade
  notificationRulesService     — quando gerar alerta de vencimento (parcela/bolsa) + dedup key
  financialDashboardService    — agregação de totais/gráficos
       │
       ▼
Repositórios (Dexie/IndexedDB hoje)
  LocalInstallmentRepository, LocalPaymentRepository, LocalScholarshipTypeRepository,
  LocalStudentScholarshipRepository, LocalNotificationRepository
```

Nenhuma tela calcula desconto, status ou dedup key na mão — sempre chama os serviços acima.
Isso é o que torna os 25 cenários da seção 13 do pedido testáveis sem precisar renderizar UI
nem tocar no IndexedDB (ver `*.test.ts` ao lado de cada serviço).

## Valores monetários

Todo valor é um **inteiro em centavos** (`originalAmountCents`, `finalAmountCents` etc.) — nunca
ponto flutuante. `formatCurrencyBRL(cents)` (em `src/lib/utils.ts`) é o único lugar que converte
para o formato `R$ 0,00` na exibição; `parseCurrencyToCents` faz o caminho inverso ao ler um
formulário. `calculateScholarshipDiscountCents` e `calculateFinalAmountCents`
(`financialCalculationService.ts`) fazem toda a matemática com `Math.round`, nunca deixando
sobrar erro de arredondamento.

## Status de parcela — regra de cálculo

`installmentStatus` é salvo no registro, mas o valor **autoritativo para exibição** é sempre
recalculado por `computeInstallmentStatus(installment, hoje)`:

- `cancelled` e `exempt` são estados manuais — nunca mudam com a data.
- Se `paidAmountCents > 0`: `paid` (se cobre o valor final) ou `partially_paid` (senão) —
  **independente da data**, por isso uma parcela paga nunca aparece como atrasada, esteja o
  pagamento antes, no dia ou depois do vencimento.
- Caso contrário, o status vem da diferença em dias até o vencimento: `overdue` (passou),
  `due_today` (hoje), `due_soon` (≤ 7 dias), `pending` (mais que 7 dias).

## Bolsas — regra de vigência (seção 3.5)

Regra única, centralizada em `scholarshipService.competenceWithinScholarship`: a
**competência da parcela** (formato `"AAAA-MM"`) é comparada ao intervalo
`[startDate, endDate]` da concessão, mês a mês — nunca a data de pagamento nem a data em que a
parcela foi gerada. Uma bolsa sem `endDate` vale indefinidamente a partir de `startDate`.

`findActiveScholarshipForCompetence` usa essa regra para decidir, ao gerar ou recalcular uma
parcela, se existe bolsa vigente naquela competência.

## Duas bolsas simultâneas (seção 3.7)

`scholarshipService.findOverlappingActiveScholarship` verifica se já existe uma concessão
ativa (não cancelada/suspensa) cujo intervalo de competências se sobrepõe ao da nova. Se
sim, `AssignScholarshipDialog` exige uma confirmação explícita ("substituir") antes de salvar;
ao confirmar, a bolsa antiga é marcada `cancelled` (com `cancelReason` registrado) e a nova
grava `replacesAssignmentId` — o histórico não é perdido.

## Alteração de bolsa (seção 3.6)

`EditScholarshipDialog` nunca aplica a mudança sem mostrar antes, via
`scholarshipService.previewScholarshipChangeImpact`, quantas parcelas seriam afetadas e qual
seria o valor total antes/depois — parcelas com `installmentStatus` `paid` ou `cancelled` são
sempre excluídas do recálculo (ficam congeladas para auditoria). A tela recalcula apenas se o
usuário marcar a caixa de confirmação.

## Central de Alertas

### Geração de alertas de vencimento (seção 4.6/4.7)

`notificationRulesService.determineInstallmentEvent`/`determineScholarshipEvent` decidem, para
o dia de hoje, se existe um evento a disparar:

| Situação | Evento | Prioridade |
|---|---|---|
| Parcela vence em 7 / 3 / 1 dias | `N_dias_antes` | Médio |
| Parcela vence hoje | `vence_hoje` | Alto |
| Parcela venceu ontem | `1_dia_apos` | Urgente |
| Parcela atrasada há N dias (N múltiplo de 7) | `atrasada_Nd` | Urgente |
| Bolsa termina em 30 / 15 / 7 dias | `N_dias_antes` | Médio |
| Bolsa termina hoje | `dia_do_termino` | Médio |
| Parcela com desconto de bolsa já expirada | `stale` | Urgente |

Cada evento vira uma `deduplicationKey` única (`categoria:tipo:id:evento`) — o mesmo evento
nunca é criado duas vezes; `LocalNotificationRepository.findByDeduplicationKey` verifica antes
de gravar. A reconciliação (`useNotificationReconciliation`, chamada uma vez por sessão pelo
`AppShell`) roda esse cálculo para todas as parcelas/bolsas ativas da organização — como este é
um app sem servidor, é o equivalente local a um job agendado; numa implantação real, o mesmo
cálculo rodaria num cron no backend.

### Encerramento automático

Pagar, cancelar ou isentar uma parcela chama
`repositories.notifications.resolveByRelatedEntity('installment', id, ator)` na hora — todos os
alertas pendentes daquela parcela são marcados `resolved`, sem esperar a próxima reconciliação.

### Central única (não um centro por módulo)

A tabela `notifications` (redefinida nesta versão — antes existia no schema mas não era usada
por nenhuma tela) é a fonte nativa, com leitura/resolução reais. Os alertas pedagógicos já
existentes (`Alert`, motor R/B/O em `/alertas`) aparecem **mesclados apenas para exibição** na
mesma central (`notificationAggregatorService.mapPedagogicalAlertToUnified`) — a tabela `alerts`
não é duplicada nem alterada; "resolver" um item pedagógico abre `/alertas`, onde o fluxo de
contestação já existe. Isso evita reescrever o motor de alertas pedagógicos (que já funcionava)
só para caber num formato novo.

## Permissões

Três módulos novos em `SystemModule`: `financial`, `scholarships`, `notifications`. Um novo
perfil, **Diretor** (`director`), com matriz própria em `src/auth/permissions.ts`
(`DIRECTOR_MATRIX`): concede/altera/cancela bolsas e dá baixa em pagamentos, mas não administra
usuários/permissões/auditoria. Professor não vê valores financeiros por padrão
(`TEACHER_MATRIX.financial = []`) — só passa a ver com uma `UserPermission` concedida
explicitamente pelo Owner. Responsável só vê parcelas/bolsas dos próprios filhos — o escopo é
aplicado na consulta (via `studentGuardians`), do mesmo jeito já usado em `/alertas` e
`/desenvolvimento`, nunca só escondendo botão.

## Como testar cada cenário (seção 13)

Todos os 25 cenários têm teste automatizado (`npm run test`) — ver
`src/features/financial/services/*.test.ts`, `src/repositories/local/notificationRepository.test.ts`
e `src/auth/permissions.test.ts`. Para testar manualmente na interface:

1. Entre como `admin@demo.escola.app` / `admin123` (ou carregue os dados de demonstração na
   tela de login, que já vêm com uma bolsa ativa, uma parcela paga, uma atrasada e uma
   parcialmente paga).
2. **Bolsas → Novo tipo**: cadastre um tipo com percentual entre 0 e 100 (tente >100 para ver a
   validação).
3. **Bolsas → Conceder bolsa**: conceda a um aluno que já tem bolsa ativa para ver o aviso de
   substituição.
4. **Parcelas → Nova cobrança → Gerar em lote**: gere um período que já tenha alguma parcela
   cadastrada, para ver o aviso de duplicidade.
5. **Parcelas → Dar baixa**: informe um valor menor que o final para ver "Parcialmente paga";
   depois **Desfazer** para ver o registro voltar a pendente/atrasada.
6. **Central de Alertas** (sino no topo): veja os alertas gerados automaticamente pela
   reconciliação; pague a parcela atrasada e confirme que o alerta correspondente some da lista
   de pendentes.
7. **Dashboard financeiro**: aplique os filtros de aluno/turma/competência e confirme que os
   gráficos e indicadores mudam.
8. Entre como `professor@demo.escola.app` e confirme que "Parcelas"/"Bolsas" não aparecem no
   menu nem no perfil do aluno.
9. Entre como `diretor@demo.escola.app` / `diretor123` e confirme acesso total ao financeiro.
10. Entre como `responsavel@demo.escola.app` e confirme que só vê as parcelas dos próprios
    filhos, sem botões de edição.

## Limitações conhecidas

- **Sem job/cron real**: a geração de alertas roda no navegador, uma vez por sessão — num
  ambiente real, isso rodaria num agendador no backend.
- **Comprovante de pagamento**: é um campo de texto livre (referência/nº do comprovante), não
  um upload de arquivo — o módulo de Documentos já existe no projeto, mas anexá-lo ao pagamento
  ficou fora do escopo desta entrega.
- **Importação de parcelas/pagamentos/bolsas via CSV/XLSX** não foi conectada ao assistente de
  importação existente (que hoje é focado em alunos/frequência/boletim) — apenas a
  **exportação** (CSV de parcelas, pagamentos, bolsas e alertas) foi implementada.
- **Notificações geradas automaticamente não são marcadas como dado de demonstração**
  (`isDemo`): ao remover os dados de demonstração, alertas já gerados para parcelas/bolsas de
  demonstração continuam na tabela `notifications` (órfãos, inofensivos, mas não são limpos
  automaticamente).
- **Datas do seed de demonstração são fixas** (ano letivo 2026, como o restante dos dados de
  demonstração do projeto) — os cenários de "atrasada"/"vence em breve" foram calibrados para
  fazer sentido em torno de agosto de 2026; passado esse período, os status mudam com o tempo
  real (o que é o comportamento correto do sistema, só deixa de refletir o cenário exato
  desenhado para a demonstração).
