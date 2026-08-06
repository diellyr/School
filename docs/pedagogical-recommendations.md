# Recomendações pedagógicas para famílias (Educação Infantil)

Este documento descreve a arquitetura do módulo **Desenvolvimento** (`src/features/pedagogical/`):
recomendações práticas de atividades em família a partir das avaliações R/B/O da Educação
Infantil, organizadas pelos 5 Campos de Experiência da BNCC. Complementa
[`docs/data-model.md`](data-model.md) e o [Manual do usuário](manual-usuario.md).

> Voltado a crianças de até 5 anos e 11 meses. O sistema **não realiza diagnóstico** — ver
> seção "Segurança pedagógica" abaixo.

## Arquitetura

```
Interface (React)
   │  DevelopmentPage, ExperienceFieldCard, SkillHelpDialog, WeeklyPlanSection, FamilyPreferencesForm
   ▼
pedagogicalRecommendationService (orquestrador)
   │
   ├─▶ assessmentAnalysisService       — liga Activity+Assessment a uma Skill; recorrência/transição
   ├─▶ recommendationPriorityService   — pontuação interna (nunca exibida ao usuário)
   ├─▶ activitySelectionService        — escolhe atividades evitando repetição e respeitando preferências
   ├─▶ weeklyPlanGeneratorService      — distribui as escolhas pelos dias (2 a 5 atividades/semana)
   └─▶ recommendationExplanationService — texto da justificativa mostrado à família
   │
   ▼
PedagogicalRepository (interface)
   │
   ├── JsonPedagogicalRepository   (produção, hoje) → src/data/pedagogical-rules.json
   ├── InMemoryPedagogicalRepository (testes)
   └── PedagogicalApiRepository   (futuro) → API → Postgres/Supabase
```

A interface **nunca** importa `pedagogical-rules.json` diretamente — sempre passa por
`repositories.pedagogical` (`useRepositories()`), que hoje resolve para
`JsonPedagogicalRepository` (ver `RepositoryProvider.tsx`). Trocar a fonte de dados no futuro é
trocar essa única linha, sem tocar em nenhuma tela ou service.

Os 5 services de `src/features/pedagogical/services/` são **funções puras** (recebem dados,
devolvem dados, não tocam o IndexedDB) — por isso são testados com fixtures em memória
(`testFixtures.ts`), sem precisar de banco. Só o orquestrador e a página conhecem o
`PedagogicalRepository`; só a página e os repositórios locais tocam o IndexedDB.

## Separação entre avaliação e conteúdo pedagógico

Uma `Assessment` (avaliação de um aluno) nunca guarda texto de recomendação — só o resultado
R/B/O, ligado a uma `Activity` cujo `title` é casado (por texto) a uma `Skill` do catálogo. A
`Skill` é que carrega a orientação e a biblioteca de atividades, reaproveitável por qualquer
aluno:

```
Assessment (aluno X, atividade Y, resultado R)
        │  Activity Y.title = "Resolve conflitos respeitando regras e combinações."
        ▼  (casamento por texto normalizado — nunca por ID hardcoded)
Skill "conflict-resolution"  ──1:N──▶  8 FamilyActivity diferentes na biblioteca
```

## `src/data/pedagogical-rules.json`

```jsonc
{
  "metadata": { "version": "1.0.0", "schemaVersion": 1, "status": "published", ... },
  "experienceFields": [
    {
      "id": "eu_outro_nos",              // um dos 5 BnccField (domain/assessment.ts)
      "name": "O eu, o outro e o nós",
      "source": { "institution": "MEC", "framework": "BNCC", "sourceType": "official-framework" },
      "skills": [
        {
          "id": "conflict-resolution",
          "name": "Resolução de conflitos",
          "matchTexts": ["resolve conflitos respeitando regras e combinacoes"], // ver "Casamento de texto" abaixo
          "bnccReference": null,          // nunca inventamos código BNCC (seção 21/23)
          "source": { "sourceType": "school-indicator", ... },
          "familyGuidance": { "importance": "...", "howToHelp": [...], "recommendedFrequencyPerWeek": 2, ... },
          "activityOptions": [ { "id": "conflict-01", "title": "Teatro com bonecos", "instructions": [...], ... }, ... ]
        }
      ]
    }
  ]
}
```

Hoje: **5 campos, 25 habilidades, 158 atividades** (`node -e "console.log(require('./src/data/pedagogical-rules.json'))"` para inspecionar).
Tipos completos em `src/domain/pedagogical.ts` (`ExperienceField`, `Skill`, `FamilyActivity`,
`PedagogicalRules`).

### Casamento de texto (Activity → Skill)

`assessmentAnalysisService` normaliza o `title` da `Activity` (`normalizeSentence` em
`lib/utils.ts` — minúsculas, sem acento, sem pontuação, mas **preserva espaços** entre palavras,
diferente de `normalizeForMatch`) e casa contra os `matchTexts` de cada `Skill`
(`matchSkillByNormalizedText` em `repositories/pedagogical/matchSkill.ts`):

1. Igualdade exata do texto normalizado → confiança 1.0.
2. Um texto contém o outro → confiança 0.85.
3. Sobreposição de palavras (quantas palavras do `matchText` aparecem no título) → confiança
   proporcional.
4. Confiança abaixo de 0.6 → **não classificada** (nunca inventa uma habilidade — seção 32). A
   atividade aparece num `<details>` recolhível no fim da página, para revisão manual futura.

## Regras de recomendação (seção 11 do briefing)

`recommendationPriorityService.calculateSkillPriority` implementa os 7 casos, sempre com
prioridade **crescendo com recorrência real**, nunca com um único resultado:

| Situação | `reasonCode` | Prioridade | Mensagem |
|---|---|---|---|
| 1ª vez em R | `first-r` | moderada | "foi classificada como em desenvolvimento no relatório atual" |
| R em 2+ períodos seguidos | `recurring-r` | alta, cresce com a recorrência (+ pequeno bônus se outras habilidades do mesmo campo também estão em R) | "permaneceu... em N períodos consecutivos" |
| Acabou de virar R (vinha de B/O) | `variation-to-r` | moderada, mas com linguagem de "variação a observar", nunca "regressão" | sugere conversar com a escola, nunca especialista |
| R → B | `reinforcement-r-to-b` | baixa (reforço leve, não repete como antes) | "evoluiu de Em desenvolvimento para Bom" |
| B → O | `reinforcement-b-to-o` | **zero** — some da lista de prioridades | "excelente progresso... não precisa mais de prioridade" |
| O → B | `variation-o-to-b` | muito baixa | "não costuma indicar perda de capacidade" |
| B estável | `stable-attention` | mínima | reforço ocasional opcional |

A pontuação (`score`) é só um número interno para ordenar — **nunca exibido ao usuário** (o
`SkillHelpDialog` mostra o texto de `recommendationExplanationService`, nunca o número).

## Anti-repetição

`activitySelectionService.selectActivitiesForSkill` recebe `recentActivityIds` (atividades
recomendadas dentro da janela `FamilyPreferences.avoidRepeatWeeks`, padrão 3 semanas, calculado
pela página via `ActivityHistoryRepository.findRecentByStudent`) e as exclui do pool — a não ser
que **todas** as opções estejam recentes, caso em que permite repetir (para nunca deixar uma
habilidade sem sugestão nenhuma). Uma vez usada, uma atividade só reaparece depois de sair dessa
janela — por isso o sistema nunca sugere sempre a primeira opção cadastrada.

## Plano da semana

`weeklyPlanGeneratorService.generateWeeklyPlanItems` pega os candidatos (já ordenados por
prioridade), corta em **2 a 5 itens** (nunca mais, mesmo que `maxActivitiesPerWeek` da família
seja maior) e distribui pelos `FamilyPreferences.availableDays` (ou uma rotação padrão
seg-sex). Cada `WeeklyPlanItem` carrega sua própria `reason` — a explicação nunca fica presa só
no momento da geração.

Ações na tela (`WeeklyPlanSection`): marcar como realizada, não conseguimos fazer, gostei/não
gostei, repetir outra semana, substituir, remover — cada uma atualiza o `WeeklyPlanItem.itemStatus`
e o `ActivityHistory` correspondente (nunca cria streak, ranking ou penalidade — seção 15).

## Segurança pedagógica

- Nunca infere condições médicas (dislexia, TDAH, autismo, etc.) — grep no código por essas
  palavras não deve retornar nada em `src/features/pedagogical/`.
- R nunca é "reprovação"; B nunca é "insuficiente" — `recommendationExplanationService.test.ts`
  testa que nenhuma explicação contém linguagem diagnóstica.
- Em recorrência real (`recurring-r`, 2+ períodos), a orientação é conversar com a **escola**,
  nunca "procure um especialista" diretamente.

## Como estender

**Adicionar uma habilidade nova**: edite `src/data/pedagogical-rules.json`, adicione um objeto em
`experienceFields[i].skills` seguindo o schema de `Skill` (`src/domain/pedagogical.ts`) — `id`
único, `matchTexts` com o(s) texto(s) exato(s) do relatório escolar (normalizados: minúsculas, sem
acento), `familyGuidance` e pelo menos algumas `activityOptions`.

**Adicionar uma atividade a uma habilidade existente**: adicione um objeto em
`activityOptions` da `Skill` correspondente, com `id` único prefixado pelo `skill.id` (convenção:
`${skillId}-NN`).

**Vincular várias atividades à mesma habilidade**: é o padrão já usado — cada `Skill` tem um
array `activityOptions`; não há limite, `activitySelectionService` já varia entre elas.

**Alterar os pesos da recomendação**: editar as constantes numéricas em
`recommendationPriorityService.calculateSkillPriority` (todas comentadas inline) — os testes em
`recommendationPriorityService.test.ts` travam o comportamento relativo (ex.: R recorrente sempre
> reforço R→B), então uma mudança que quebre essa relação vai falhar no teste antes de virar bug.

**Cadastrar/editar pelo admin (painel de revisão)**: a arquitetura já suporta (repository com
contrato estável), mas a tela administrativa (seção 33 do briefing original) não foi construída
nesta entrega — só a leitura. Ela pode ser adicionada depois sem mudar `PedagogicalRepository`.

## Migração futura: JSON + IndexedDB → banco de dados real

Nenhum código de tela ou service muda. Os dois pontos de troca:

1. **Conteúdo pedagógico** (`pedagogical-rules.json`): criar `PedagogicalApiRepository`
   implementando a mesma interface `PedagogicalRepository` (`getExperienceFields`,
   `getSkillById`, `getActivitiesBySkillId`, `findSkillByNormalizedText`, etc.), buscando de uma
   API em vez do JSON local, e trocar a instanciação em `RepositoryProvider.tsx`
   (`pedagogical: new JsonPedagogicalRepository()` → `new PedagogicalApiRepository(client)`),
   mesmo padrão já usado para `organizations`/`schools`/`students` (ver `isSupabaseConfigured` no
   mesmo arquivo).
2. **Histórico e planos** (`ActivityHistory`, `RecommendationHistory`, `WeeklyPlan`,
   `FamilyPreferences`): hoje em tabelas Dexie (`Local*Repository`, mesmo padrão de toda a
   aplicação); no futuro, `Supabase*Repository` equivalentes, seguindo exatamente o padrão de
   `attendance`/`checkInOuts` já migrados.

Tabelas Postgres futuras sugeridas (nomes já usados nos comentários do domínio):
`experience_fields`, `skills`, `family_activities`, `activity_skill_relations` (se um dia uma
atividade puder servir a mais de uma habilidade), `assessments` (já existe), `activity_history`,
`recommendation_history`, `weekly_plans`, `weekly_plan_items`, `family_preferences` — todas com
`id` estável (`uuid`), nunca o texto como chave primária.
