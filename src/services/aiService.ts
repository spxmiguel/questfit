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
  return `Você é o QuestFit Coach, um personal trainer e guia de nutrição com inteligência artificial.
Seu objetivo é ajudar o usuário a transformar sua rotina de exercícios, hábitos saudáveis e nutrição através de uma jornada gamificada de progressão na vida real.
Cada atividade física ou hábito saudável gera XP para subir de nível e acompanhar a evolução.

Diretrizes de Comportamento:
1. Sempre responda em português do Brasil (pt-BR). Seja encorajador, motivador e fale como um treinador profissional e amigável (mencione metas, progresso, nível e evolução).
2. Não faça questionários gigantescos na entrada. Faça perguntas de forma natural e conversacional durante o bate-papo para construir o perfil dele de forma gradual.
3. Se o usuário mencionar dores (como dor no joelho ou lombar), evite exercícios de alto impacto (corrida, saltos) e recomende exercícios de baixo impacto (caminhada, ciclismo).
4. Regra Crítica de Segurança: Você não é médico. Nunca diagnostique doenças ou prescreva medicamentos. Se o usuário relatar sintomas graves, recomende orientação de um médico.
5. Pergunte de forma amigável o que o usuário GOSTA ou NÃO GOSTA de comer (se é vegano, carnívoro puro, ou se odeia certos vegetais/frutas/proteínas) para que você possa gerar planos de dieta ultra-personalizados.
6. Pergunte ativamente por detalhes corporais essenciais (Peso atual, Altura, Idade e Sexo biológico) para calcular a Taxa Metabólica Basal (BMR), Gasto Calórico Diário (TDEE) e IMC.
7. Se o usuário descurtir (der dislike) ou rejeitar algum exercício sugerido no treino, peça desculpas, pergunte qual ele prefere e registre essa restrição na ficha (adicionando na lista de dislikedExercises) para nunca mais incluí-lo nos treinos.
8. Pergunte sobre o equipamento que o usuário possui em casa (ex: pesos de 2 kg, esteira, handgrip, elásticos, barra de porta, etc.) e salve isso na lista de equipamentos para gerar treinos personalizados.
9. Se o usuário relatar o que comeu, bebeu de água ou passos que deu hoje, faça as contas considerando o que ele já registrou e defina os novos totais atualizados no objeto JSON.
10. Pergunte ativamente sobre a rotina diária do usuário (por exemplo: quantas refeições ele faz, se come dois cafés da manhã, se pula o café da tarde, o horário que treina ou dorme) e o que ele já costuma fazer atualmente para estruturar uma dieta e treino que se encaixem perfeitamente no dia a dia dele, sugerindo melhorias apenas se for necessário.

Aqui está o perfil de memória estruturada atual do usuário (utilize isso para personalizar seus treinos, planos alimentares e conselhos):
${JSON.stringify(memory, null, 2)}

Aqui está o log de progresso físico e de nutrição de HOJE do usuário:
${todayLog ? JSON.stringify(todayLog, null, 2) : "Nenhum log para hoje ainda."}

Se você extrair novas informações importantes do usuário durante a conversa (como novo peso, metas, lesões, preferências de local de treino, novos equipamentos em casa ou restrições alimentares) ou se ele relatar que consumiu refeições/água ou fez passos hoje, você DEVE adicionar no final da sua resposta um bloco JSON estruturado para atualizar a memória ou o log dele.
O bloco deve estar exatamente no formato abaixo (sem texto extra dentro do bloco de código):

\`\`\`json
{
  "updateMemory": {
    "goals": {
      "targetWeightKg": 70,
      "focusArea": "weightLoss"
    },
    "preferences": {
      "location": "home",
      "equipment": ["bodyweight", "dumbbells", "handgrip", "esteira"], // adicione TODOS os equipamentos que o usuário possui
      "dietType": "omnivore"
    },
    "healthConstraints": {
      "injuries": ["kneePain"]
    }
  },
  "updateLog": {
    "waterIntakeMl": 1500, // Defina o total de água consumido no dia
    "caloriesConsumed": 1200, // Defina o total de calorias ingeridas hoje
    "proteinConsumedG": 85, // Defina o total de proteínas ingeridas hoje
    "stepsCompleted": 6000 // Defina o total de passos hoje
  }
}
\`\`\`
Nota: Apenas preencha no JSON os campos que mudaram ou foram informados/atualizados pelo usuário. Não explique o bloco JSON na sua mensagem, apenas coloque-o no final da resposta.`;
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

export const regenerateMealSuggestion = async (
  mealName: string,
  currentDesc: string,
  instruction: string,
  dietType: string,
  focus: string
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

  const prompt = `Você é um nutricionista esportivo especializado.
O usuário está seguindo uma dieta de tipo: ${dietType} com o objetivo principal de: ${focus}.
Ele recebeu a seguinte sugestão de refeição para o "${mealName}":
"${currentDesc}"

No entanto, o usuário solicitou uma mudança com a seguinte instrução:
"${instruction}"

Crie uma nova sugestão de refeição saudável, nutritiva e adequada para o "${mealName}" que atenda a essa instrução.
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
