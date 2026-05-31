# QuestFit — Notas de Código para Claude

## Visão Geral
App React + TypeScript (Vite) de fitness gamificado. Dados locais em localStorage + Firebase Firestore opcional. Sem Zustand — estado principal gerenciado em `App.tsx` como props drilling.

---

## Arquitetura de Estado

### Fonte da verdade: `App.tsx`
- `userProfile`, `quests`, `userMemory`, `achievements` ficam como state no App
- **NÃO há store global** — tudo é prop drilling para componentes filhos
- Callbacks: `handleQuestUpdate(quests, profile, achs)`, `handleMemoryUpdate`, `handleWeightLogged`

### Camada de persistência: `src/services/dbService.ts`
- localStorage é o cache primário (leitura instantânea)
- Firebase Firestore é secundário (sync async, `setDoc` fire-and-forget)
- Chaves localStorage: `questfit_profile_{uid}`, `questfit_quests_{uid}`, `questfit_memory_{uid}`, etc.

---

## Bugs Corrigidos (sessão 2026-05-31)

### BUG 1 — Quest de treino/nutrição não atualizava na UI (CRÍTICO)
**Arquivo:** `App.tsx` linhas 477-507  
**Causa:** `onWorkoutCompleted` e `onNutritionLogged` passavam `quests` stale do closure React para `handleQuestUpdate`. A quest de treino nunca aparecia como concluída na interface.  
**Fix:** Os lambdas agora leem o localStorage fresco (`localStorage.getItem('questfit_quests_...')`) + marcam a quest diária de treino como concluída otimisticamente.

### BUG 2 — Firebase sync sobrescrevia progresso do dia (CRÍTICO)
**Arquivo:** `src/services/dbService.ts` — função `getQuests` background refresh  
**Causa:** Background fetch do Firestore chamava `setLocal('questfit_quests_', quests)` sem checar se os dados eram do dia atual. Dados antigos do Firestore apagavam progresso local.  
**Fix:** Só aceita dados do Firebase se tiverem quests diárias com o ID do dia atual (`q.id.endsWith(todayStr)`).

### BUG 3 — QuestSystem revertia progresso ao desbloquear achievement (MAIOR)
**Arquivo:** `src/components/QuestSystem.tsx` — background saveQueue callback  
**Causa:** `onQuestUpdate(updatedQuests, ...)` no background usava `updatedQuests` do closure (snapshot antigo). Se usuário completou mais quests enquanto o save rodava, o progresso era revertido.  
**Fix:** Lê quests frescas do localStorage antes do callback: `JSON.parse(localStorage.getItem('questfit_quests_...'))`.

### BUG 4 — FitnessPlans: quest semanal nunca incrementava (MAIOR)
**Arquivo:** `src/components/FitnessPlans.tsx` — background IIFEs  
**Causa:** Check `!dailyWorkout.completed` sempre falhava — App.tsx já marcara a quest como done no localStorage antes do background rodar.  
**Fix:** Usa `wasAlreadyLogged = log.workoutCompleted` (lido do progress log ANTES de salvar) — independente do estado otimístico das quests.

### BUG 5 — Weekly quests NUNCA resetavam entre semanas (CRÍTICO)
**Arquivos:** `dateUtils.ts`, `types/index.ts`, `xpCalc.ts`, `dbService.ts`  
**Causa:** `weekly-workouts` e `weekly-adherence` tinham IDs fixos e nunca eram resetadas. `checkAndRefreshDailyQuests` só resetava quests `category === 'daily'`.  
**Fix:**  
- Adicionado `weekStart?: string` ao tipo `Quest`  
- `getDefaultQuests()` agora inclui `weekStart: getMondayISO()` nas quests semanais  
- `checkAndRefreshDailyQuests` agora também reseta weekly quests quando `weekStart !== getMondayISO()`  
- `getMondayISO()` adicionado a `dateUtils.ts`

### BUG 6 — Settings "Redefinir" só limpava localStorage, não Firebase (MÉDIO)
**Arquivo:** `src/components/Settings.tsx`, `src/services/dbService.ts`  
**Causa:** `handleResetData` só removia chaves do localStorage. Firebase permanecia intacto. No próximo login, todos os dados voltavam do Firestore.  
**Fix:** Adicionado `deleteAllUserData(uid)` ao dbService (deleta sub-collections Firebase + localStorage). Settings agora chama esta função.

---

## Padrões e Armadilhas

### Otimistic updates
Todos os componentes fazem atualização otimista (React state imediato) + save assíncrono em background. O padrão correto:
1. Atualiza React state + localStorage via callback do App
2. IIFE async salva no DB
3. Segunda chamada de callback (background) lê localStorage fresco, não usa closure

### Chave para evitar state stale
Sempre ler `localStorage.getItem('questfit_quests_{uid}')` direto no callback de App.tsx ao invés de usar `quests` do closure. O closure pode estar 1-2 renders atrás.

### Quest IDs com data
Daily quests têm IDs com data: `daily-water-2026-05-31`. Weekly quests têm `weekStart` field. `checkAndRefreshDailyQuests` detecta IDs antigos/week antigo e reseta automaticamente.

### Firebase é opcional
`isFirebaseEnabled` flag em `firebase.ts`. Quando false, tudo roda em localStorage (modo mock). Saves Firebase são fire-and-forget (`.catch(() => {})`) — nunca bloqueiam a UI.

### awardXp — sempre salva o perfil no DB
Chamar `awardXp(uid, profile, 0, 'quest')` com 0 XP ainda salva o perfil (usado para checar achievements). Não chamar sem necessidade.

### Streak
Só atualiza via `checkAndUpdateStreak()` — chamada no login e na troca de dia (`checkDateChange`). Não é incrementado por actions mid-session.

---

## Arquivos Críticos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `App.tsx` | Estado global, callbacks, day-change detection |
| `services/dbService.ts` | localStorage + Firestore CRUD, reset de quests por dia/semana |
| `services/rpgService.ts` | XP award, streak update, achievement unlock |
| `utils/xpCalc.ts` | Fórmulas de nível, títulos, `getDefaultQuests()` |
| `utils/dateUtils.ts` | `getLocalDateString()`, `getMondayISO()` |
| `components/QuestSystem.tsx` | UI + save de quests com optimistic update + saveQueue serializado |
| `components/FitnessPlans.tsx` | Conclusão de treino, usa `wasAlreadyLogged` do progress log |

---

## Weekly Quest Reset — como funciona
```
Toda chamada a getQuests() → checkAndRefreshDailyQuests() →
  se alguma weekly quest tem weekStart != getMondayISO():
    → reseta (progress=0, completed=false, weekStart=segunda atual)
    → preserva progresso se weekStart == segunda atual (proteção contra chamadas múltiplas)
```

---

## Pendências / TODOs conhecidos
- NutritionSystem importa `saveQuest`/`getQuests` mas nunca os usa — morto
- XP farming possível em NutritionSystem: sem limite de logs por dia
- RPGProgression: ícone `Scale` pode não renderizar se achievement usar esse icon key (verificar `renderIcon` switch)
- Chunk JS acima de 500KB — considerar code splitting por rota
