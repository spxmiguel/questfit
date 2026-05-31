import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserMemory, ChatMessage, ProgressLog } from '../types';

const GEMINI_KEY_STORAGE = 'questfit_gemini_api_key';
const GROQ_KEY_STORAGE = 'questfit_groq_api_key';

export const getStoredGeminiKey = (): string => {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || import.meta.env.VITE_GEMINI_API_KEY || '';
};

export const setStoredGeminiKey = (key: string): void => {
  localStorage.setItem(GEMINI_KEY_STORAGE, key);
};

export const getStoredGroqKey = (): string => {
  return localStorage.getItem(GROQ_KEY_STORAGE) || import.meta.env.VITE_GROQ_API_KEY || '';
};

export const setStoredGroqKey = (key: string): void => {
  localStorage.setItem(GROQ_KEY_STORAGE, key);
};

// System Prompt for AI Coach
const getSystemPrompt = (memory: UserMemory, todayLog?: ProgressLog): string => {
  // ── Build personality/tone block ───────────────────────────────────────────
  const cp = memory.coachPersonality;
  const tone = cp?.userTone;
  const style = cp?.speakingStyle;
  const useEmojis = cp?.useEmojis !== false;

  const personalityBlock = `
═══════════════════════════════════════
ESTILO DE COMUNICAÇÃO — REGRA ABSOLUTA
═══════════════════════════════════════
${style
  ? `Padrão de fala DETECTADO do usuário: "${style}"
Você DEVE espelhar esse estilo exatamente. Se ele abrevia, você abrevia. Se escreve "vc", "q", "n", "tb", "kkkk" → você usa igual.`
  : 'Estilo ainda não detectado. Comece casual e adapte-se à medida que ele escreve.'}
Tom atual detectado: ${tone || 'a detectar'}
Emojis: ${useEmojis ? 'use moderadamente quando fizer sentido emocional' : 'evite — o usuário não usa'}

NUNCA pareça um robô corporativo. Você é um coach REAL que conhece o usuário de longa data.`;

  // ── Build wellbeing context block ─────────────────────────────────────────
  const wb = memory.wellbeing;
  const wellbeingBlock = wb ? `
═══════════════════════════════
ESTADO ATUAL DO ATLETA (HOJE)
═══════════════════════════════
Humor: ${wb.currentMood || '?'} | Energia: ${wb.energyLevel || '?'} | Motivação: ${wb.motivationLevel || '?'}
Reclamações recentes: ${wb.recentComplaints?.length ? wb.recentComplaints.join('; ') : 'nenhuma'}
Exercícios problemáticos: ${wb.exerciseComplaints?.length ? wb.exerciseComplaints.join('; ') : 'nenhum'}
Alimentos problemáticos: ${wb.foodComplaints?.length ? wb.foodComplaints.join('; ') : 'nenhum'}
→ ADAPTE sua resposta ao estado emocional e físico atual.` : '';

  const bodyBlock = memory.bodyNotes
    ? `\nNOTAS CORPORAIS PERMANENTES: ${memory.bodyNotes}` : '';

  return `Você é o QuestFit Coach — um personal trainer e nutricionista IA com PERSONALIDADE PRÓPRIA e MEMÓRIA PERMANENTE.
Você conhece o usuário melhor do que qualquer app fitness. Cada detalhe que ele menciona fica gravado para sempre.
${personalityBlock}
${wellbeingBlock}
${bodyBlock}

═══════════════════════════════════════
CÉREBRO DO COACH — COMO VOCÊ FUNCIONA
═══════════════════════════════════════
Você tem empatia real e reage ao estado emocional do usuário:

QUANDO O USUÁRIO RECLAMAR DE UM EXERCÍCIO:
→ Substitua imediatamente na resposta por alternativa equivalente
→ Registre em wellbeing.exerciseComplaints E preferences.dislikedExercises
→ Nunca mais sugira esse exercício

QUANDO RECLAMAR DE UMA COMIDA OU INGREDIENTE:
→ Remova de todas as sugestões futuras
→ Registre em wellbeing.foodComplaints E preferences.foodRestrictionsRaw
→ Adapte o cardápio na mesma resposta

QUANDO ESTIVER CANSADO / ESTRESSADO / DE MAL HUMOR:
→ Alivie o treino do dia (volume/intensidade menor)
→ Sugira descanso ativo se necessário
→ Seja mais empático, menos exigente
→ Registre mood e energyLevel no JSON

QUANDO ESTIVER MOTIVADO / ANIMADO:
→ Desafie mais, proponha metas extras
→ Sugira evoluções de carga/volume
→ Comemore junto

QUANDO MENCIONAR DOR FÍSICA:
→ Ajuste treino imediatamente
→ Registre em healthConstraints.injuries E bodyNotes
→ Recomende médico se grave (NUNCA diagnostique)

DETECÇÃO DE TOM DE VOZ:
→ Analise CADA mensagem: abreviações usadas, gírias, pontuação, emojis
→ Se detectar mudança de padrão, atualize coachPersonality no JSON

REGRAS PROFISSIONAIS:
1. Responda SEMPRE em pt-BR. Adapte o nível de formalidade ao tom do usuário.
2. Não faça questionários gigantes. Colete informações naturalmente na conversa.
3. Para cálculos de dieta: use BMR/TDEE com dados físicos se disponíveis.
4. Segurança: não diagnostique, não prescriba. Sintoma grave → recomende médico.
5. Quando o usuário relatar água/comida/passos: some ao que já registrou no log de hoje.

════════════════════════════
MEMÓRIA PERMANENTE DO USUÁRIO
════════════════════════════
${JSON.stringify(memory, null, 2)}

LOG DE HOJE:
${todayLog ? JSON.stringify(todayLog, null, 2) : 'Nenhum dado de hoje ainda.'}

═══════════════════════════════════════════
ATUALIZAÇÃO DE MEMÓRIA — EXECUTE SEMPRE QUE DETECTAR INFORMAÇÃO NOVA
═══════════════════════════════════════════
Ao detectar qualquer dado novo (humor, reclamação, lesão, alimento, equipamento, meta, tom de voz):

\`\`\`json
{
  "updateMemory": {
    "coachPersonality": {
      "userTone": "casual|formal|slangy",
      "speakingStyle": "descrição exata do jeito de falar detectado nesta mensagem",
      "useEmojis": true
    },
    "wellbeing": {
      "currentMood": "great|good|tired|stressed|bad",
      "energyLevel": "high|medium|low",
      "motivationLevel": "high|medium|low",
      "recentComplaints": ["lista com o que reclamou agora — ADICIONE ao existente"],
      "exerciseComplaints": ["NomeExercício - motivo da reclamação"],
      "foodComplaints": ["alimento/ingrediente - motivo"]
    },
    "bodyNotes": "notas livres sobre corpo, dores, sensações mencionadas",
    "healthConstraints": {
      "injuries": ["lista COMPLETA atualizada"],
      "limitations": "texto livre"
    },
    "preferences": {
      "dislikedExercises": ["lista COMPLETA atualizada"],
      "foodRestrictionsRaw": "texto corrido com TODAS as restrições e aversões acumuladas",
      "allergies": ["lista atualizada"],
      "equipment": ["lista COMPLETA de equipamentos"],
      "location": "home|gym",
      "dietType": "omnivore|vegetarian|vegan|carnivore|keto|lowcarb"
    },
    "goals": {
      "targetWeightKg": 70,
      "currentWeightKg": 80,
      "focusArea": "weightLoss|muscleGain|endurance|health"
    },
    "physicalProfile": {
      "weightKg": 80,
      "heightCm": 175,
      "age": 28,
      "gender": "male|female",
      "activityLevel": "sedentary|light|moderate|active|veryActive"
    }
  },
  "updateLog": {
    "waterIntakeMl": 1500,
    "caloriesConsumed": 1200,
    "proteinConsumedG": 85,
    "stepsCompleted": 6000,
    "workoutCompleted": true
  }
}
\`\`\`
IMPORTANTE: Inclua APENAS campos que MUDARAM. Não explique o JSON. Coloque no final da resposta.
TREINO: Se o usuário disser que fez/completou um treino hoje → inclua "workoutCompleted": true no updateLog.`;
};

// Handle memory and log updates from the raw text response
export const extractMemoryUpdate = (rawText: string): { 
  text: string; 
  memoryUpdate: Partial<UserMemory> | null;
  logUpdate: Partial<ProgressLog> | null;
} => {
  const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
  const match = rawText.match(jsonRegex);

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      const memoryUpdate = parsed.updateMemory as Partial<UserMemory> || null;
      const logUpdate = parsed.updateLog as Partial<ProgressLog> || null;
      
      // Strip the JSON block from the response
      const text = rawText.replace(jsonRegex, '').trim();
      return { text, memoryUpdate, logUpdate };
    } catch (e) {
      console.warn('Failed to parse memory/log JSON from AI:', e);
    }
  }

  return { text: rawText, memoryUpdate: null, logUpdate: null };
};

// Deterministic mock coach responses for demo when no API Key is provided
const getMockResponse = (
  userMessage: string, 
  memory: UserMemory,
  todayLog?: ProgressLog
): { text: string; memoryUpdate: Partial<UserMemory> | null; logUpdate: Partial<ProgressLog> | null } => {
  const msg = userMessage.toLowerCase();
  let text = '';
  let memoryUpdate: Partial<UserMemory> | null = null;
  let logUpdate: Partial<ProgressLog> | null = null;

  if (msg.includes('olá') || msg.includes('oi') || msg.includes('eae')) {
    text = `Saudações! Sou o QuestFit Coach, seu guia nessa jornada fitness. 🏋️‍♂️\n\nQual é o seu principal objetivo hoje? Focar em perder peso, ganhar músculos ou melhorar o fôlego? Diga-me e começaremos a moldar suas metas!`;
  } else if (msg.includes('perder peso') || msg.includes('emagrecer') || msg.includes('perder kg') || msg.includes('gordo')) {
    text = `Excelente meta! A jornada de perda de peso exige consistência, mas os resultados valem a pena. 🏃‍♂️💨\n\nPara ajustar sua planilha, você prefere treinar em casa (usando o peso do corpo) ou ir para uma academia?`;
    memoryUpdate = {
      goals: {
        focusArea: 'weightLoss',
        targetWeightKg: memory.goals?.targetWeightKg || 75
      }
    };
  } else if (msg.includes('casa') || msg.includes('em casa')) {
    text = `Treinar em casa é fantástico! Economiza tempo e dá muita flexibilidade. Seus treinos envolverão calistenia e exercícios usando o próprio peso corporal. 🏡\n\nVocê tem algum equipamento em casa (halteres, elásticos) ou vai treinar apenas com o peso do corpo? E me diga: sente alguma dor física ou tem limitações, como no joelho ou na lombar?`;
    memoryUpdate = {
      preferences: {
        location: 'home',
        equipment: memory.preferences?.equipment || ['bodyweight']
      }
    };
  } else if (msg.includes('academia') || msg.includes('gym')) {
    text = `Academia selecionada! Excelente para ganhos de força e hipertrofia. 🏋️‍♂️\n\nSeus treinos envolverão pesos livres e aparelhos. Quantos minutos você tem disponíveis por dia para treinar? E possui alguma restrição médica ou dor física?`;
    memoryUpdate = {
      preferences: {
        location: 'gym',
        equipment: memory.preferences?.equipment || ['barbell', 'dumbbells', 'machines']
      }
    };
  } else if (msg.includes('joelho') || msg.includes('dor no joelho') || msg.includes('patela')) {
    text = `Entendido, guerreiro. Dor no joelho registrada em sua ficha de personagem. 🛡️\n\nMinha programação automática vai evitar exercícios de alto impacto (saltos, agachamentos muito profundos sem apoio). Vamos focar em exercícios mais seguros de baixo impacto. Como está sua alimentação no momento? Segue alguma dieta específica (como vegetariano, vegano)?`;
    memoryUpdate = {
      healthConstraints: {
        injuries: ['kneePain']
      }
    };
  } else if (msg.includes('vegetariano') || msg.includes('vegano')) {
    text = `Dieta atualizada na ficha de nutrição! 🥗\n\nGerando sugestões de refeições focadas em fontes de proteínas vegetais limpas. Pronto para começar sua primeira quest de hidratação hoje? Beba água para ganhar +50 XP!`;
    memoryUpdate = {
      preferences: {
        dietType: msg.includes('vegano') ? 'vegan' : 'vegetarian'
      }
    };
  } else if (msg.includes('carne') || msg.includes('carnivoro') || msg.includes('carnívora')) {
    text = `Dieta carnívora registrada na sua ficha! 🥩\n\nFocando suas refeições em proteínas e gorduras de origem animal de qualidade. Pronto para começar sua primeira quest de hidratação hoje? Beba água para ganhar +50 XP!`;
    memoryUpdate = {
      preferences: {
        dietType: 'carnivore'
      }
    };
  } else if (msg.includes('keto') || msg.includes('cetogenica') || msg.includes('cetogênica') || msg.includes('low carb') || msg.includes('lowcarb')) {
    text = `Preferência de dieta Low Carb / Cetogênica registrada em sua ficha! 🥑\n\nFocando em gorduras boas, proteínas e vegetais de baixo amido. Pronto para começar sua primeira quest de hidratação hoje? Beba água para ganhar +50 XP!`;
    memoryUpdate = {
      preferences: {
        dietType: msg.includes('keto') || msg.includes('cetogenica') || msg.includes('cetogênica') ? 'keto' : 'lowcarb'
      }
    };
  } else if (msg.includes('tenho') || msg.includes('equipamento') || msg.includes('peso de') || msg.includes('handgrip') || msg.includes('esteira')) {
    // Parse equipment dynamically from mock
    const eqList = [...(memory.preferences?.equipment || [])];
    if (msg.includes('handgrip') && !eqList.includes('handgrip')) eqList.push('handgrip');
    if ((msg.includes('peso') || msg.includes('halter')) && !eqList.includes('dumbbells')) eqList.push('dumbbells');
    if (msg.includes('esteira') && !eqList.includes('esteira')) eqList.push('esteira');
    if (msg.includes('elástico') || msg.includes('banda') && !eqList.includes('resistance-bands')) eqList.push('resistance-bands');
    
    text = `Excelente! Atualizei sua lista de equipamentos de treino em casa na ficha. Equipamentos salvos: ${eqList.join(', ')}. Agora os treinos gerados levarão esses itens em conta! 🛠️`;
    memoryUpdate = {
      preferences: {
        ...memory.preferences,
        equipment: eqList
      }
    };
  } else if (msg.includes('comi') || msg.includes('bebi') || msg.includes('litro') || msg.includes('passos')) {
    let currentWater = todayLog?.waterIntakeMl || 0;
    let currentCalories = todayLog?.caloriesConsumed || 0;
    let currentProtein = todayLog?.proteinConsumedG || 0;
    let currentSteps = todayLog?.stepsCompleted || 0;

    if (msg.includes('água') || msg.includes('bebi') || msg.includes('litro')) {
      if (msg.includes('2 litros') || msg.includes('2l')) currentWater += 2000;
      else if (msg.includes('1 litro') || msg.includes('1l')) currentWater += 1000;
      else if (msg.includes('500ml')) currentWater += 500;
      else currentWater += 250;
    }
    if (msg.includes('comi') || msg.includes('caloria')) {
      currentCalories += 450;
      currentProtein += 25;
    }
    if (msg.includes('passo')) {
      currentSteps += 3000;
    }

    text = `Muito bem! Anotei seus dados do dia a dia no seu log diário de hoje. Consistência é a chave! 📊`;
    logUpdate = {
      waterIntakeMl: currentWater,
      caloriesConsumed: currentCalories,
      proteinConsumedG: currentProtein,
      stepsCompleted: currentSteps
    };
  } else {
    // General response
    text = `Gostei da resposta, guerreiro! Registrei isso em seu diário de bordo. 💪\n\nQue tal darmos uma olhada no seu Painel de Missões para ver as quests diárias e começar a acumular XP? Lembre-se: a consistência é o que nos faz subir de nível!`;
  }

  // Generate simulated update memory JSON to display in console logs
  const finalJsonObj: any = {};
  if (memoryUpdate) finalJsonObj.updateMemory = memoryUpdate;
  if (logUpdate) finalJsonObj.updateLog = logUpdate;

  if (Object.keys(finalJsonObj).length > 0) {
    const rawJson = `\n\n\`\`\`json\n${JSON.stringify(finalJsonObj, null, 2)}\n\`\`\``;
    return { text: text + rawJson, memoryUpdate, logUpdate };
  }

  return { text, memoryUpdate: null, logUpdate: null };
};

// Groq API client integration
const sendGroqChatMessage = async (
  message: string,
  history: ChatMessage[],
  memory: UserMemory,
  apiKey: string,
  todayLog?: ProgressLog
): Promise<{ text: string; memoryUpdate: Partial<UserMemory> | null; logUpdate: Partial<ProgressLog> | null }> => {
  const systemPrompt = getSystemPrompt(memory, todayLog);
  
  // Format history for Groq completions API
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    })),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro API Groq: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const aiText = data.choices[0].message.content || '';

    return extractMemoryUpdate(aiText);
  } catch (error: any) {
    console.error('Groq API call failed:', error);
    throw new Error(error.message || 'Falha de conexão com a API do Groq.');
  }
};

// Send message to Groq, Gemini or fall back to Mock
export const sendChatMessageToCoach = async (
  message: string,
  history: ChatMessage[],
  memory: UserMemory,
  todayLog?: ProgressLog
): Promise<{ text: string; memoryUpdate: Partial<UserMemory> | null; logUpdate: Partial<ProgressLog> | null }> => {
  const groqKey = getStoredGroqKey();
  const geminiKey = getStoredGeminiKey();

  // 1. If Groq Key is available, prioritize Groq
  if (groqKey) {
    return sendGroqChatMessage(message, history, memory, groqKey, todayLog);
  }

  // 2. If Gemini Key is available, fallback to Gemini
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: getSystemPrompt(memory, todayLog),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      });

      const contents = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const result = await model.generateContent({ contents });
      const aiText = result.response.text();

      return extractMemoryUpdate(aiText);
    } catch (error: any) {
      console.error('Gemini API call failed:', error);
      throw new Error(error.message || 'Falha na conexão com o servidor da Gemini. Verifique sua chave de API nas configurações.');
    }
  }

  // 3. Fallback to mock response
  const mock = getMockResponse(message, memory, todayLog);
  const extracted = extractMemoryUpdate(mock.text);
  return {
    text: extracted.text,
    memoryUpdate: extracted.memoryUpdate,
    logUpdate: extracted.logUpdate
  };
};

export interface MealAnalysisResult {
  mealName: string;
  items: string[];
  calories: number;
  protein: number;
}

export const analyzeMealPhoto = async (file: File): Promise<MealAnalysisResult> => {
  const geminiKey = getStoredGeminiKey();
  
  if (!geminiKey) {
    // Return simulated result based on file name or type
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay
    
    // Choose a random or pseudo-random response based on file name to make it feel alive!
    const name = file.name.toLowerCase();
    if (name.includes('frango') || name.includes('chicken') || name.includes('peito')) {
      return {
        mealName: "Prato de Frango Grelhado com Legumes",
        items: ["150g de Peito de Frango grelhado", "100g de Brócolis no vapor", "80g de Arroz Integral"],
        calories: 380,
        protein: 36
      };
    } else if (name.includes('ovo') || name.includes('egg') || name.includes('omelete')) {
      return {
        mealName: "Omelete Proteico com Queijo",
        items: ["3 Ovos caipiras inteiros", "30g de Queijo minas", "Tomate picado e orégano"],
        calories: 290,
        protein: 22
      };
    } else if (name.includes('carne') || name.includes('carne moida') || name.includes('steak')) {
      return {
        mealName: "Grelhado de Carne com Batata Doce",
        items: ["150g de Patinho moído", "120g de Batata doce assada", "Mix de folhas verdes"],
        calories: 450,
        protein: 32
      };
    } else if (name.includes('salada') || name.includes('salad')) {
      return {
        mealName: "Salada Completa de Atum",
        items: ["1 Lata de atum ao natural", "Folhas de alface e rúcula", "1/2 Pepino picado", "1 colher de azeite"],
        calories: 220,
        protein: 26
      };
    }
    
    // Default fallback mock
    return {
      mealName: "Refeição Completa Estimada",
      items: ["Porção mista de proteínas (carne/frango/peixe)", "Porção de carboidratos complexos", "Vegetais cozidos"],
      calories: 420,
      protein: 30
    };
  }

  // Create GoogleGenerativeAI client
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Convert File to Gemini part format
  const fileToPart = async (file: File): Promise<{ inlineData: { data: string, mimeType: string } }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const imagePart = await fileToPart(file);
  const prompt = `Analise esta foto de comida. Identifique os itens de alimentos presentes, estime o tamanho das porções e calcule o total aproximado de calorias (kcal) e proteínas (g) para a refeição inteira.
Responda APENAS com um objeto JSON válido, sem crases, markdown ou qualquer texto extra. O formato do JSON DEVE ser exatamente este:
{
  "mealName": "Nome da Refeição em português",
  "items": ["Item 1 estimado", "Item 2 estimado"],
  "calories": 450,
  "protein": 32
}`;

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();
    
    // Attempt parsing. Sometimes LLMs output markdown wraps like \`\`\`json { ... } \`\`\`
    const cleanJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return {
      mealName: parsed.mealName || "Prato Identificado",
      items: parsed.items || [],
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0
    };
  } catch (err: any) {
    console.error('Error analyzing image with Gemini:', err);
    throw new Error('Falha ao analisar imagem. Verifique se a sua chave API da Gemini nas Configurações é válida.');
  }
};

// ─── AI-generated Daily Meal Plan ────────────────────────────────────────────
// Generates 4 personalized meals based on the user's full profile.
// Result is cached per day+diet so it only calls the API once per day.

export interface AIMenuResult {
  meals: { name: string; desc: string }[];
  groceryList: string[];
}

export const generateDailyMealPlan = async (
  memory: UserMemory,
  uid: string,
  dateStr: string,
  calorieTarget: number,
  proteinTarget: number
): Promise<AIMenuResult | null> => {
  const diet = memory.preferences?.dietType || 'omnivore';
  const mealsCacheKey   = `questfit_ai_mealplan_${uid}_${diet}_${dateStr}`;
  const groceryCacheKey = `questfit_ai_grocery_${uid}_${diet}_${dateStr}`;

  // Return from cache if already generated today
  const cachedMeals   = localStorage.getItem(mealsCacheKey);
  const cachedGrocery = localStorage.getItem(groceryCacheKey);
  if (cachedMeals && cachedGrocery) {
    try {
      return { meals: JSON.parse(cachedMeals), groceryList: JSON.parse(cachedGrocery) };
    } catch {}
  }

  const geminiKey = getStoredGeminiKey();
  if (!geminiKey) return null;

  const restrictions = [
    memory.preferences?.foodRestrictionsRaw,
    memory.wellbeing?.foodComplaints?.join(', '),
    memory.preferences?.allergies?.join(', ')
  ].filter(Boolean).join('. ');

  const weightKg = memory.goals?.currentWeightKg
    || memory.physicalProfile?.weightKg
    || memory.goals?.targetWeightKg;

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Você é nutricionista esportivo especializado. Crie um plano alimentar personalizado para 1 dia.

PERFIL:
- Dieta: ${diet} | Objetivo: ${memory.goals?.focusArea || 'saúde'} | Intensidade: ${memory.goals?.intensity || 'moderate'}
- Meta: ${calorieTarget} kcal / ${proteinTarget}g proteína
- Peso: ${weightKg ? weightKg + ' kg' : 'não informado'}
${restrictions ? `- RESTRIÇÕES PERMANENTES (NUNCA use): ${restrictions}` : ''}

Gere 4 refeições + lista de compras COERENTE com essas refeições (não invente ingredientes que não estão nas refeições).
Responda SOMENTE com JSON válido, sem markdown:

{
  "meals": [
    {"name":"Café da Manhã","desc":"descrição com quantidades em 1-2 frases"},
    {"name":"Almoço","desc":"..."},
    {"name":"Lanche da Tarde","desc":"..."},
    {"name":"Jantar","desc":"..."}
  ],
  "groceryList": [
    "Item exato usado nas refeições acima, com quantidade semanal",
    "..."
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Try to extract JSON object (may have markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const meals: { name: string; desc: string }[] = parsed.meals || [];
      const groceryList: string[] = parsed.groceryList || [];

      if (meals.length >= 4) {
        localStorage.setItem(mealsCacheKey, JSON.stringify(meals));
        localStorage.setItem(groceryCacheKey, JSON.stringify(groceryList));
        return { meals, groceryList };
      }
    }
    return null;
  } catch (err) {
    console.error('AI meal plan generation failed:', err);
    return null;
  }
};

export const regenerateMealSuggestion = async (
  mealName: string,
  currentDesc: string,
  instruction: string,
  dietType: string,
  focus: string,
  restrictions?: string   // free-text food restrictions from user memory
): Promise<string> => {
  const geminiKey = getStoredGeminiKey();

  if (!geminiKey) {
    console.log('Gemini API Key missing. Returning simulated customized meal.');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`[Personalizado] Nova opção de ${mealName}: Uma alternativa adaptada para atender ao seu pedido de "${instruction}". Por exemplo: Frango grelhado temperado, salada de tomate com azeite e purê de abóbora cozida.`);
      }, 1000);
    });
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const restrictionsBlock = restrictions?.trim()
    ? `\nIMPORTANTE — Restrições alimentares permanentes do usuário (NUNCA inclua esses alimentos, mesmo que a instrução não mencione):\n"${restrictions.trim()}"\n`
    : '';

  const prompt = `Você é um nutricionista esportivo especializado.
O usuário está seguindo uma dieta de tipo: ${dietType} com o objetivo principal de: ${focus}.${restrictionsBlock}
Ele recebeu a seguinte sugestão de refeição para o "${mealName}":
"${currentDesc}"

No entanto, o usuário solicitou uma mudança com a seguinte instrução:
"${instruction}"

Crie uma nova sugestão de refeição saudável, nutritiva e adequada para o "${mealName}" que atenda a essa instrução e respeite todas as restrições alimentares acima.
Importante: Forneça como resposta APENAS a descrição curta da nova refeição em português (1 ou 2 frases curtas), no mesmo estilo da anterior. Não inclua introduções, explicações, aspas ou títulos.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini meal regeneration failed:', error);
    throw new Error('Falha ao gerar nova recomendação de refeição via IA.');
  }
};

export interface WorkoutAnalysisResult {
  workoutName: string;
  durationMin: number;
  caloriesBurned: number;
  feedback: string;
}

export const analyzeWorkoutPhoto = async (file: File): Promise<WorkoutAnalysisResult> => {
  const geminiKey = getStoredGeminiKey();
  
  if (!geminiKey) {
    // Return simulated result based on file name or type
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay
    
    return {
      workoutName: "Corrida na Esteira",
      durationMin: 40,
      caloriesBurned: 320,
      feedback: "Excelente treino aeróbico! Completar 40 minutos correndo ajuda muito no condicionamento físico geral. Ótimo trabalho!"
    };
  }

  // Create GoogleGenerativeAI client
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Convert File to Gemini part format
  const fileToPart = async (file: File): Promise<{ inlineData: { data: string, mimeType: string } }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const imagePart = await fileToPart(file);
  const prompt = `Analise esta foto de um resumo de atividade física (geralmente uma foto de Apple Watch, relógio esportivo Garmin ou painel de esteira).
Identifique o nome/tipo do treino, a duração total em minutos e o gasto calórico aproximado (kcal).
Além disso, faça uma avaliação curta (1 ou 2 frases) analisando se o treino foi bom e dando um feedback de incentivo.
Responda APENAS com um objeto JSON válido, sem crases, markdown ou qualquer texto extra. O formato do JSON DEVE ser exatamente este:
{
  "workoutName": "Tipo de Treino (ex: Caminhada, Corrida, Ciclismo, etc.)",
  "durationMin": 30,
  "caloriesBurned": 250,
  "feedback": "Seu feedback motivador em português aqui."
}`;

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();
    
    // Attempt parsing. Sometimes LLMs output markdown wraps like \`\`\`json { ... } \`\`\`
    const cleanJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return {
      workoutName: parsed.workoutName || "Treino Personalizado",
      durationMin: Number(parsed.durationMin) || 0,
      caloriesBurned: Number(parsed.caloriesBurned) || 0,
      feedback: parsed.feedback || "Excelente treino, continue com esse ritmo constante!"
    };
  } catch (err: any) {
    console.error('Error analyzing workout image with Gemini:', err);
    throw new Error('Falha ao analisar foto de treino. Verifique se a sua chave API da Gemini nas Configurações é válida.');
  }
};

// ─── Nutritionist AI ────────────────────────────────────────────────────────

export interface NutritionistResponse {
  text: string;
  mealPlan?: { name: string; desc: string }[];
  groceryList?: string[];
  memoryUpdate?: Partial<UserMemory>;
  logUpdate?: {
    caloriesConsumed?: number;
    proteinConsumedG?: number;
  };
}

const getNutritionistSystemPrompt = (memory: UserMemory): string => {
  const restrictions = [
    memory.preferences?.foodRestrictionsRaw,
    memory.wellbeing?.foodComplaints?.join(', ')
  ].filter(Boolean).join('. ');

  const diet = memory.preferences?.dietType || 'omnivore';
  const focus = memory.goals?.focusArea || 'health';
  const weightKg = memory.goals?.currentWeightKg || memory.physicalProfile?.weightKg;

  return `Você é uma Nutricionista IA especializada em alimentação personalizada.
Seu objetivo é construir um plano alimentar completo CONVERSANDO com o usuário — aprendendo o que ele gosta, o que odeia, seus horários e hábitos — e gerar um cardápio diário que ele vai seguir com prazer.

PERSONALIDADE:
- Empática, prática, sem julgamentos
- Não força o usuário a comer o que não gosta
- Sugere alternativas quando ele rejeita algo
- Estima calorias quando o usuário não sabe (ex: "comi um pão com manteiga" → ~200 kcal)
- Fala de forma natural, não de forma robótica ou muito técnica

PERFIL ATUAL DO USUÁRIO:
- Dieta: ${diet} | Objetivo: ${focus}
- Peso: ${weightKg ? weightKg + ' kg' : 'não informado'}
- Restrições alimentares conhecidas: ${restrictions || 'nenhuma registrada'}
- Preferências: ${JSON.stringify(memory.preferences || {})}
- Reclamações alimentares: ${memory.wellbeing?.foodComplaints?.join(', ') || 'nenhuma'}

FLUXO DE CONVERSA:
1. Pergunte o que o usuário gosta de comer (café, almoço, jantar)
2. Pergunte o que ele NÃO come de jeito nenhum
3. Pergunte sua rotina de horários
4. Com isso, gere um cardápio personalizado
5. Quando o usuário disser o que comeu hoje → registre no log com estimativa de calorias

REGISTRO DE REFEIÇÕES (PRIORITÁRIO):
Quando o usuário mencionar que comeu algo hoje:
- Estime as calorias e proteínas com base no que ele descreveu
- Seja realista: "comi arroz com feijão e frango" → ~550 kcal, ~35g proteína
- Informe ao usuário a estimativa de forma clara
- Inclua no JSON: updateLog.caloriesConsumed (TOTAL do dia atualizado) e proteinConsumedG

QUANDO TIVER INFORMAÇÕES SUFICIENTES PARA GERAR O CARDÁPIO:
Inclua ao final da resposta um bloco JSON:

\`\`\`json
{
  "mealPlan": [
    {"name": "Café da Manhã", "desc": "descrição detalhada em 1-2 frases com quantidades"},
    {"name": "Almoço", "desc": "..."},
    {"name": "Lanche da Tarde", "desc": "..."},
    {"name": "Jantar", "desc": "..."}
  ],
  "groceryList": [
    "Frango peito 1kg",
    "Arroz integral 500g",
    "Brócolis 400g"
  ],
  "updateLog": {
    "caloriesConsumed": 1850,
    "proteinConsumedG": 120
  },
  "updateMemory": {
    "preferences": {
      "foodRestrictionsRaw": "texto corrido com TUDO que o usuário não come",
      "allergies": ["lista de alérgenos"],
      "dietType": "omnivore|vegetarian|vegan|carnivore|keto|lowcarb"
    },
    "wellbeing": {
      "foodComplaints": ["alimento - motivo"]
    }
  }
}
\`\`\`

REGRAS:
- Inclua mealPlan + groceryList APENAS quando tiver informações suficientes
- groceryList deve ter os principais itens para 1 semana seguindo o cardápio
- Inclua updateLog SEMPRE que o usuário mencionar o que comeu
- Inclua updateMemory quando aprender novas preferências/restrições
- Não explique o JSON. Coloque ao final da resposta.`;
};

const extractNutritionistResponse = (rawText: string): NutritionistResponse => {
  const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
  const match = rawText.match(jsonRegex);
  const text = rawText.replace(jsonRegex, '').trim();

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        text,
        mealPlan: Array.isArray(parsed.mealPlan) && parsed.mealPlan.length >= 4
          ? parsed.mealPlan
          : undefined,
        groceryList: Array.isArray(parsed.groceryList) && parsed.groceryList.length > 0
          ? parsed.groceryList
          : undefined,
        memoryUpdate: parsed.updateMemory || undefined,
        logUpdate: parsed.updateLog || undefined
      };
    } catch (e) {
      console.warn('Failed to parse nutritionist JSON:', e);
    }
  }

  return { text };
};

export const sendNutritionistMessage = async (
  message: string,
  history: ChatMessage[],
  memory: UserMemory
): Promise<NutritionistResponse> => {
  const systemPrompt = getNutritionistSystemPrompt(memory);
  const groqKey = getStoredGroqKey();
  const geminiKey = getStoredGeminiKey();

  // Groq (faster, preferred)
  if (groqKey) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-20).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        { role: 'user', content: message }
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 1200
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const aiText = data.choices[0].message.content || '';
      return extractNutritionistResponse(aiText);
    } catch (err: any) {
      if (!geminiKey) throw err;
      // fallthrough to Gemini
    }
  }

  // Gemini fallback
  if (geminiKey) {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
    });

    const contents = history.slice(-20).map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const result = await model.generateContent({ contents });
    const aiText = result.response.text();
    return extractNutritionistResponse(aiText);
  }

  // No API key mock
  return {
    text: `Para usar a Nutricionista IA, configure sua chave da API Gemini ou Groq nas Configurações (aba Ajustes). Depois voltamos a conversar sobre seu cardápio! 🥗`
  };
};
