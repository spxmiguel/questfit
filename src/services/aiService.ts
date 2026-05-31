import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserMemory, ChatMessage } from '../types';

const GEMINI_KEY_STORAGE = 'questfit_gemini_api_key';

export const getStoredGeminiKey = (): string => {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
};

export const setStoredGeminiKey = (key: string): void => {
  localStorage.setItem(GEMINI_KEY_STORAGE, key);
};

// System Prompt for AI Coach
const getSystemPrompt = (memory: UserMemory): string => {
  return `Você é o QuestFit Coach, um personal trainer, guia de nutrição e mestre de RPG fitness com inteligência artificial.
Seu objetivo é transformar a rotina de exercícios, hábitos saudáveis e nutrição do usuário em um RPG de progressão na vida real.
O usuário é o personagem principal, e cada atividade física ou hábito saudável gera XP para subir de nível.

Diretrizes de Comportamento:
1. Sempre responda em português do Brasil (pt-BR). Seja encorajador, motivador e fale como um treinador profissional, mas com tom de mestre de RPG (mencione quests, XP, leveis e chefões/metas).
2. Não faça questionários gigantescos na entrada. Faça perguntas de forma natural e conversacional durante o bate-papo para construir o perfil dele de forma gradual.
3. Se o usuário mencionar dores (como dor no joelho ou lombar), evite exercícios de alto impacto (corrida, saltos) e recomende exercícios de baixo impacto (caminhada, ciclismo).
4. Regra Crítica de Segurança: Você não é médico. Nunca diagnostique doenças ou prescreva medicamentos. Se o usuário relatar sintomas graves, recomende orientação de um médico.

Aqui está o perfil de memória estruturada atual do usuário (utilize isso para personalizar seus treinos, planos alimentares e conselhos):
${JSON.stringify(memory, null, 2)}

Se você extrair novas informações importantes do usuário durante a conversa (como novo peso, metas, lesões, preferências de local de treino ou restrições alimentares), você DEVE adicionar no final da sua resposta um bloco JSON estruturado para atualizar a memória dele. 
O bloco deve estar exatamente no formato abaixo (sem texto extra dentro do bloco de código):

\`\`\`json
{
  "updateMemory": {
    "goals": {
      "targetWeightKg": 70, // exemplo
      "focusArea": "weightLoss" // focusArea pode ser: "weightLoss" | "muscleGain" | "endurance" | "health"
    },
    "preferences": {
      "location": "home", // "home" ou "gym"
      "equipment": ["bodyweight", "dumbbells"],
      "dietType": "omnivore"
    },
    "healthConstraints": {
      "injuries": ["kneePain"] // lista de lesões/dores
    },
    "schedule": {
      "availableMinutesPerDay": 30
    }
  }
}
\`\`\`
Nota: Apenas preencha no JSON os campos que mudaram ou foram adicionados. Não explique o bloco JSON na sua mensagem, apenas coloque-o no final.`;
};

// Handle memory updates from the raw text response
export const extractMemoryUpdate = (rawText: string): { text: string; memoryUpdate: Partial<UserMemory> | null } => {
  const jsonRegex = /```json\s*(\{[\s\S]*?"updateMemory"[\s\S]*?\})\s*```/;
  const match = rawText.match(jsonRegex);

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      const memoryUpdate = parsed.updateMemory as Partial<UserMemory>;
      
      // Strip the JSON block from the response
      const text = rawText.replace(jsonRegex, '').trim();
      return { text, memoryUpdate };
    } catch (e) {
      console.warn('Failed to parse memory JSON from AI:', e);
    }
  }

  return { text: rawText, memoryUpdate: null };
};

// Deterministic mock coach responses for demo when no API Key is provided
const getMockResponse = (userMessage: string, memory: UserMemory): { text: string; memoryUpdate: Partial<UserMemory> | null } => {
  const msg = userMessage.toLowerCase();
  let text = '';
  let memoryUpdate: Partial<UserMemory> | null = null;

  if (msg.includes('olá') || msg.includes('oi') || msg.includes('eae')) {
    text = `Saudações, herói! Sou o QuestFit Coach, seu guia nessa jornada fitness RPG. ⚔️\n\nQual é o seu principal objetivo hoje? Queremos focar em perder peso, ganhar músculos ou melhorar o fôlego? Diga-me e começaremos a moldar suas missões!`;
  } else if (msg.includes('perder peso') || msg.includes('emagrecer') || msg.includes('perder kg') || msg.includes('gordo')) {
    text = `Excelente meta! A jornada de perda de peso é cheia de batalhas de consistência, mas com recompensas lendárias. 🏃‍♂️💨\n\nPara ajustar sua planilha, você prefere treinar em casa (usando o peso do corpo) ou ir para uma academia?`;
    memoryUpdate = {
      goals: {
        focusArea: 'weightLoss',
        targetWeightKg: memory.goals?.targetWeightKg || 75
      }
    };
  } else if (msg.includes('casa') || msg.includes('em casa')) {
    text = `Treinar em casa é fantástico! Economiza tempo e dá muita flexibilidade. Suas missões diárias envolverão calistenia e exercícios usando o próprio peso corporal. 🏡\n\nVocê tem algum equipamento em casa (halteres, elásticos) ou vai treinar apenas com o peso do corpo? E me diga: sente alguma dor física ou tem limitações, como no joelho ou na lombar?`;
    memoryUpdate = {
      preferences: {
        location: 'home',
        equipment: memory.preferences?.equipment || ['bodyweight']
      }
    };
  } else if (msg.includes('academia') || msg.includes('gym')) {
    text = `Academia selecionada! O calabouço de ferro reserva grandes ganhos de força. 🏋️‍♂️\n\nSuas missões envolverão pesos livres e aparelhos. Quantos minutos você tem disponíveis por dia para treinar? E possui alguma restrição médica ou dor física?`;
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
    text = `Dieta atualizada na ficha de nutrição! 🥗\n\nGerando sugestões de refeições focadas em fontes de proteínas vegetais limpas (tapioca com tofu, grão-de-bico, ovos e shakes proteicos se for vegetariano). Pronto para começar sua primeira quest de hidratação hoje? Beba 2L de água para ganhar +50 XP!`;
    memoryUpdate = {
      preferences: {
        dietType: msg.includes('vegano') ? 'vegan' : 'vegetarian'
      }
    };
  } else {
    // General response
    text = `Gostei da resposta, guerreiro! Registrei isso em seu diário de bordo. 💪\n\nQue tal darmos uma olhada no seu Painel de Missões para ver as quests diárias e começar a acumular XP? Lembre-se: a consistência é o que nos faz subir de nível!`;
  }

  // Generate simulated update memory JSON to display in console logs
  if (memoryUpdate) {
    const rawJson = `\n\n\`\`\`json\n{\n  "updateMemory": ${JSON.stringify(memoryUpdate, null, 2).replace(/\n/g, '\n  ')}\n}\n\`\`\``;
    return { text: text + rawJson, memoryUpdate };
  }

  return { text, memoryUpdate: null };
};

// Send message to Gemini or fall back to Mock
export const sendChatMessageToCoach = async (
  message: string,
  history: ChatMessage[],
  memory: UserMemory
): Promise<{ text: string; memoryUpdate: Partial<UserMemory> | null }> => {
  const apiKey = getStoredGeminiKey();

  if (!apiKey) {
    // Return mock response immediately
    const mock = getMockResponse(message, memory);
    const extracted = extractMemoryUpdate(mock.text);
    return {
      text: extracted.text,
      memoryUpdate: extracted.memoryUpdate
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.5-flash as the current fast standard
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: getSystemPrompt(memory),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    });

    // Format chat history for Gemini API API
    const contents = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Append new message
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
};
