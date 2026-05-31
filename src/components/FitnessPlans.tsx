import React, { useState } from 'react';
import { UserProfile, UserMemory } from '../types';
import { Dumbbell, Calendar, Play, CheckCircle2, ChevronRight, AlertTriangle, ShieldCheck, Clock, Award, RotateCcw, ThumbsDown, ChevronDown, ChevronUp, Video, Plus, Trash2, Camera, Upload, Sparkles } from 'lucide-react';
import { awardXp } from '../services/rpgService';
import { saveProgressLog, getProgressLogForDate, saveQuest, getQuests, saveUserMemory } from '../services/dbService';
import { checkLevelUp, getTitleForLevel } from '../utils/xpCalc';
import { getLocalDateString } from '../utils/dateUtils';
import { analyzeWorkoutPhoto } from '../services/aiService';

interface FitnessPlansProps {
  userProfile: UserProfile;
  userMemory: UserMemory;
  onWorkoutCompleted: (updatedProfile: UserProfile, unlockedAchs: any[]) => void;
  onMemoryUpdate: (newMemory: UserMemory, updatedProfile?: UserProfile, newlyUnlockedAchs?: any[]) => void;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  description: string;
  instructions: string[];
  videoId: string;
}

interface WorkoutDay {
  dayName: string;
  focus: string;
  exercises: Exercise[];
}

// Global Exercise Pools with full written instructions and real YouTube video IDs
const EXERCISE_POOLS = {
  gym_upper: [
    { name: 'Supino Reto com Barra', sets: 4, reps: '8-10 reps', rest: '90s', description: 'Deitado no banco reto, empurre a barra controladamente.', instructions: ['Deite no banco reto mantendo os pés apoiados no chão.', 'Segure a barra com pegada pronada um pouco além dos ombros.', 'Desça a barra até próximo ao peito controladamente.', 'Empurre a barra para cima expirando o ar.'], videoId: 'h7myBTy4nss' },
    { name: 'Supino Inclinado com Halteres', sets: 4, reps: '10-12 reps', rest: '90s', description: 'No banco inclinado, empurre os halteres para o teto.', instructions: ['Ajuste o banco a 30-45 graus.', 'Segure os halteres na altura do peito.', 'Empurre os halteres para cima rotacionando levemente os punhos.', 'Retorne lentamente à posição inicial.'], videoId: '5CE11v1uUts' },
    { name: 'Crucifixo Máquina (Peck Deck)', sets: 3, reps: '12 reps', rest: '60s', description: 'Aproxime as mãos ao centro contraindo o peitoral.', instructions: ['Sente-se no aparelho e ajuste a altura dos braços.', 'Segure as manoplas com cotovelos levemente flexionados.', 'Aproxime as mãos até se tocarem no centro.', 'Retorne controladamente sentindo o peitoral alongar.'], videoId: 'eGjt4lk6gJw' },
    { name: 'Puxada Alta (Lat Pulldown)', sets: 4, reps: '10-12 reps', rest: '90s', description: 'Puxe a barra em direção ao peito inclinado levemente para trás.', instructions: ['Ajuste o suporte de coxa no pulley.', 'Segure a barra com pegada ampla.', 'Puxe a barra na direção do peito, jogando os cotovelos para baixo e para trás.', 'Retorne devagar estendendo totalmente os braços.'], videoId: 'CAwf7n6Luuc' },
    { name: 'Remada Curvada com Barra', sets: 4, reps: '8-10 reps', rest: '90s', description: 'Incline o tronco e puxe a barra na direção do abdômen.', instructions: ['Fique em pé com pés na largura dos ombros.', 'Incline o tronco à frente mantendo a coluna alinhada.', 'Puxe a barra na direção do umbigo contraindo as costas.', 'Retorne controladamente.'], videoId: 'I0CoN3LzP2U' },
    { name: 'Remada Baixa Sentado', sets: 3, reps: '12 reps', rest: '60s', description: 'Puxe o triângulo na direção do abdômen mantendo a coluna ereta.', instructions: ['Sente-se de frente para a polia com pés apoiados.', 'Puxe o pegador na direção da cintura mantendo os ombros para baixo.', 'Aproxime as escápulas no final do movimento.', 'Estenda os braços devagar.'], videoId: 'GZbfZ033f64' },
    { name: 'Desenvolvimento com Halteres', sets: 3, reps: '10 reps', rest: '60s', description: 'Sentado, empurre os halteres para cima.', instructions: ['Sente-se com as costas apoiadas e contraia o abdômen.', 'Eleve os halteres até a linha dos ombros.', 'Empurre-os verticalmente até estender quase tudo.', 'Desça controladamente até a linha do ouvido.'], videoId: 'HzIiNhHh8Ok' },
    { name: 'Elevação Lateral com Halteres', sets: 3, reps: '12-15 reps', rest: '60s', description: 'Eleve os braços lateralmente até a linha dos ombros.', instructions: ['Em pé, segure os halteres ao lado do corpo.', 'Suba os braços lateralmente com cotovelos semi-flexionados.', 'Suba até os braços ficarem paralelos ao chão.', 'Desça de forma controlada.'], videoId: '3VcKaXatwKg' },
    { name: 'Rosca Direta com Barra', sets: 3, reps: '10 reps', rest: '60s', description: 'Flexione os cotovelos trazendo a barra ao peito.', instructions: ['Em pé, segure a barra com pegada supinada.', 'Flexione os cotovelos trazendo a barra na direção do peito.', 'Mantenha os cotovelos estáticos ao lado do corpo.', 'Desça controladamente.'], videoId: 'LY1V6UbRHFM' },
    { name: 'Tríceps Pulley', sets: 3, reps: '12 reps', rest: '60s', description: 'Estenda os cotovelos empurrando a barra para baixo.', instructions: ['De frente para a polia alta, segure a barra.', 'Mantenha os cotovelos fixados na lateral do corpo.', 'Empurre a barra para baixo estendendo os braços.', 'Suba controladamente flexionando até 90 graus.'], videoId: '2-LAMclnKaY' }
  ],
  home_upper: [
    { name: 'Flexão de Braço (Push-ups)', sets: 3, reps: 'Max (ou joelhos)', rest: '60s', description: 'Mantenha o abdômen contraído e cotovelos a 45 graus.', instructions: ['Apoie as mãos no chão um pouco mais afastadas que a linha dos ombros.', 'Mantenha pernas e tronco alinhados na posição de prancha.', 'Desça o corpo até o peito quase tocar o chão.', 'Empurre de volta mantendo o core ativado.'], videoId: 'IODxDxX7oi4' },
    { name: 'Flexão Diamante (Tríceps)', sets: 3, reps: '8-12 reps', rest: '60s', description: 'Flexão com mãos próximas formando um losango.', instructions: ['Apoie as mãos unidas abaixo do peito formando um triângulo com dedos indicadores e polegares.', 'Desça o peito até tocar as mãos.', 'Mantenha os cotovelos fechados próximos ao corpo.', 'Empurre para cima.'], videoId: 'J0DnG1_S314' },
    { name: 'Barra Fixa / Remada na Mesa', sets: 3, reps: '8-10 reps', rest: '60s', description: 'Puxe o peito na direção da mesa ou barra portátil.', instructions: ['Deite debaixo de uma mesa resistente ou use uma barra fixa.', 'Segure a borda da mesa com as mãos.', 'Puxe o tronco para cima contraindo as escápulas.', 'Retorne lentamente à posição inicial.'], videoId: 'r4MzxtB1FTo' },
    { name: 'Flexão de Braço Inclinada', sets: 3, reps: '10-12 reps', rest: '60s', description: 'Mãos apoiadas em um sofá ou cadeira estável.', instructions: ['Apoie as mãos em um sofá, banco ou cadeira.', 'Mantenha o corpo reto e desça o peito na direção do móvel.', 'Empurre retornando à posição inicial.', 'Ótimo para focar no peitoral inferior.'], videoId: 'Z0bRiVhnO84' },
    { name: 'Tríceps no Banco (Dips)', sets: 3, reps: '12 reps', rest: '60s', description: 'Apoie as mãos em uma cadeira e flexione os cotovelos.', instructions: ['Apoie as mãos na borda de uma cadeira firme com dedos apontados para frente.', 'Estenda as pernas à frente e tire o quadril da cadeira.', 'Desça flexionando os cotovelos até 90 graus.', 'Suba fazendo força no tríceps.'], videoId: '0326dy_-CzM' },
    { name: 'Pike Push-ups (Ombros)', sets: 3, reps: '8-10 reps', rest: '60s', description: 'Flexão com quadril elevado focando nos ombros.', instructions: ['Entre na posição de flexão e caminhe com os pés para frente levantando o quadril.', 'Seu corpo deve formar um V invertido.', 'Desça o topo da cabeça na direção do chão entre as mãos.', 'Empurre o chão de volta estendendo os braços.'], videoId: 'spOsU7fO6y4' }
  ],
  home_upper_weights: [
    { name: 'Desenvolvimento Halteres (Pesos)', sets: 3, reps: '10 reps', rest: '60s', description: 'Empurre os pesos acima da cabeça mantendo a coluna ereta.', instructions: ['Sente-se em uma cadeira com coluna reta.', 'Segure os pesos na linha dos ombros.', 'Empurre-os para cima até estender os braços.', 'Desça controladamente.'], videoId: 'HzIiNhHh8Ok' },
    { name: 'Elevação Lateral com Pesos', sets: 3, reps: '12 reps', rest: '65s', description: 'Afaste os braços lateralmente trabalhando o deltoide lateral.', instructions: ['Fique em pé com joelhos semi-flexionados.', 'Eleve os braços lateralmente com os halteres/garrafas.', 'Mantenha uma ligeira flexão no cotovelo.', 'Retorne devagar.'], videoId: '3VcKaXatwKg' },
    { name: 'Rosca Concentrada com Peso', sets: 3, reps: '12 reps', rest: '60s', description: 'Rosca de bíceps isolando a musculatura apoiado na coxa.', instructions: ['Sente-se e afaste as pernas.', 'Apoie o cotovelo na parte interna da coxa.', 'Flexione o cotovelo trazendo o peso na direção do peito.', 'Estenda lentamente.'], videoId: 'LY1V6UbRHFM' }, // Fallback
    { name: 'Remada Curvada com Halteres', sets: 3, reps: '10 reps', rest: '60s', description: 'Incline o tronco e puxe os halteres contra as costelas.', instructions: ['Incline o tronco à frente a 45 graus.', 'Segure os pesos com os braços pendidos.', 'Puxe os pesos contraindo as costas e aproximando as escápulas.', 'Estenda devagar.'], videoId: 'Oq5Psq1o004' }
  ],
  gym_lower: [
    { name: 'Agachamento com Barra (Back Squat)', sets: 4, reps: '8-10 reps', rest: '90s', description: 'Agache controladamente mantendo a postura firme.', instructions: ['Apoie a barra sobre a musculatura do trapézio.', 'Afaste os pés na largura dos ombros.', 'Agache empurrando o quadril para trás e dobrando os joelhos.', 'Desça até as coxas ficarem paralelas ao chão.', 'Suba fazendo força nos calcanhares.'], videoId: 'ultWZbUMSG8' },
    { name: 'Leg Press 45', sets: 4, reps: '12 reps', rest: '60s', description: 'Posicione os pés na largura dos ombros na plataforma.', instructions: ['Sente-se no aparelho e apoie as costas no encosto.', 'Coloque os pés na plataforma.', 'Destrave o peso e desça os joelhos até 90 graus.', 'Empurre a plataforma sem estender totalmente os joelhos.'], videoId: 'yM3gXG-FpxE' },
    { name: 'Cadeira Extensora', sets: 3, reps: '12 reps', rest: '60s', description: 'Segure firme nas laterais e estenda as pernas.', instructions: ['Ajuste o banco e apoie os pés sob o rolo.', 'Segure firme nas alças laterais.', 'Estenda as pernas totalmente contraindo o quadríceps.', 'Retorne devagar segurando o peso.'], videoId: 't2z4W25i1P0' },
    { name: 'Mesa Flexora (Leg Curl)', sets: 4, reps: '12 reps', rest: '60s', description: 'Fortalecimento posterior da coxa de forma isolada.', instructions: ['Deite de bruços no aparelho alinhando os joelhos com o eixo.', 'Posicione o rolo acima do calcanhar.', 'Flexione os joelhos trazendo o rolo até encostar nos glúteos.', 'Retorne lentamente à posição inicial.'], videoId: '7K03l8Ciiu0' },
    { name: 'Stiff com Halteres', sets: 3, reps: '10-12 reps', rest: '65s', description: 'Flexione o quadril mantendo a coluna neutra e pernas quase retas.', instructions: ['Em pé, segure os halteres na frente das coxas.', 'Incline o tronco empurrando o quadril para trás.', 'Desça os halteres rente às pernas sentindo alongar o posterior de coxa.', 'Suba contraindo glúteos e costas.'], videoId: 'zD7E-LqV9K0' }
  ],
  home_lower: [
    { name: 'Agachamento Livre (Air Squats)', sets: 4, reps: '15-20 reps', rest: '60s', description: 'Agache empurrando o quadril para trás como se fosse sentar.', instructions: ['Fique em pé com pés na largura dos ombros.', 'Estenda os braços à frente para equilíbrio.', 'Agache projetando o quadril para trás.', 'Mantenha o peito aberto e coluna alinhada.', 'Suba empurrando pelo calcanhar.'], videoId: 'aP9B3v8rCgE' },
    { name: 'Passada / Avanço Recuado', sets: 3, reps: '12 reps por perna', rest: '60s', description: 'Dê um passo para trás flexionando os joelhos em 90 graus.', instructions: ['Em pé com mãos na cintura.', 'Dê um passo longo para trás.', 'Desça o joelho de trás em direção ao chão até formar 90 graus em ambas pernas.', 'Empurre o chão com a perna da frente para voltar.'], videoId: 'qQJlh1Fp7oQ' },
    { name: 'Agachamento Sumô', sets: 3, reps: '15-20 reps', rest: '60s', description: 'Afaste mais os pés e aponte as pontas para fora.', instructions: ['Abra bem as pernas, apontando os pés para fora (45 graus).', 'Agache mantendo a coluna ereta e joelhos alinhados com os pés.', 'Desça o máximo possível e contraia os glúteos para subir.'], videoId: 'c2zM7t8FfPA' },
    { name: 'Elevação Pélvica (Ponte de Glúteos)', sets: 3, reps: '15-20 reps', rest: '60s', description: 'Pressione os calcanhares no chão para subir o quadril.', instructions: ['Deitado de costas com joelhos dobrados e pés apoiados.', 'Eleve o quadril em direção ao teto contraindo glúteos e abdômen.', 'Mantenha a posição por 1 segundo no topo.', 'Desça sem tocar totalmente no chão.'], videoId: 'F5WqWqXvTCE' }
  ],
  home_lower_weights: [
    { name: 'Agachamento Goblet com Peso', sets: 4, reps: '12 reps', rest: '60s', description: 'Agachamento profundo segurando o peso próximo ao peito.', instructions: ['Fique em pé segurando um peso verticalmente junto ao peito.', 'Agache empurrando os joelhos para os lados.', 'Desça o máximo que conseguir sem curvar as costas.', 'Suba empurrando pelos calcanhares.'], videoId: 'ultWZbUMSG8' }, // Fallback
    { name: 'Afundo com Halteres', sets: 3, reps: '10 reps por perna', rest: '60s', description: 'Avanço unilateral segurando halteres/pesos ao lado do corpo.', instructions: ['Fique em pé segurando os pesos nas mãos com braços esticados.', 'Dê um passo à frente flexionando ambas as pernas até 90 graus.', 'Retorne empurrando o calcanhar da frente.', 'Repita na outra perna.'], videoId: 'qQJlh1Fp7oQ' }, // Fallback
    { name: 'Stiff com Pesos em Casa', sets: 3, reps: '12 reps', rest: '60s', description: 'Stiff para posterior usando halteres ou carga pesada em casa.', instructions: ['Em pé, segure os pesos na frente das coxas.', 'Dobre levemente os joelhos e empurre o quadril para trás.', 'Desça os pesos em linha reta sentindo o posterior da coxa.', 'Suba contraindo os glúteos.'], videoId: 'zD7E-LqV9K0' } // Fallback
  ],
  lower_injury: [
    { name: 'Elevação de Quadril (Glute Bridge)', sets: 4, reps: '15-20 reps', rest: '60s', description: 'Deitado de costas, empurre o quadril para o alto contraindo os glúteos.', instructions: ['Deite de costas e flexione os joelhos mantendo pés inteiros no chão.', 'Eleve a pelve estendendo o quadril totalmente.', 'Foque no trabalho do glúteo, mantendo os joelhos estáveis.', 'Desça devagar.'], videoId: 'F5WqWqXvTCE' },
    { name: 'Extensão de Quadril em Pé', sets: 3, reps: '15 reps por lado', rest: '45s', description: 'Foco nos glúteos e posterior sem forçar a articulação do joelho.', instructions: ['Em pé, apoie as mãos na parede ou cadeira.', 'Chute a perna para trás mantendo-a estendida.', 'Contraia o glúteo no topo do movimento.', 'Evite arquear a lombar.'], videoId: '1eO73D4L7U8' },
    { name: 'Abdução de Quadril Deitado (Clamshell)', sets: 3, reps: '20 reps por lado', rest: '45s', description: 'Deitado de lado, afaste os joelhos mantendo os pés juntos.', instructions: ['Deite de lado com quadril e joelhos flexionados a 90 graus.', 'Mantenha os pés unidos o tempo todo.', 'Abrir o joelho de cima o máximo possível sem mover o quadril.', 'Feche lentamente.'], videoId: 'xP28b6dI4K8' },
    { name: 'Elevação de Panturrilha em Pé', sets: 4, reps: '20 reps', rest: '45s', description: 'Suba na ponta dos pés de forma lenta e controlada.', instructions: ['Fique em pé próximo a uma parede para equilíbrio.', 'Suba na ponta dos pés o máximo possível.', 'Mantenha 1 segundo no topo.', 'Desça os calcanhares até o solo controladamente.'], videoId: 'P_K24P5y1xM' }
  ],
  core_cardio_normal: [
    { name: 'Prancha Abdominal (Plank)', sets: 3, reps: '30 a 45s', rest: '60s', description: 'Mantenha o corpo alinhado e o abdômen totalmente contraído.', instructions: ['Apoie os antebraços e as pontas dos pés no chão.', 'Mantenha o quadril alinhado com a linha dos ombros.', 'Contraia glúteos e abdômen intensamente.', 'Respire ritmadamente.'], videoId: 'pvIjsG5yYgs' },
    { name: 'Super-Homem (Bird-Dog)', sets: 3, reps: '12 reps alternadas', rest: '45s', description: 'Excelente para estabilizar a coluna e fortalecer a lombar.', instructions: ['Posicione-se em 4 apoios (mãos e joelhos).', 'Estenda o braço direito à frente e a perna esquerda atrás ao mesmo tempo.', 'Mantenha a coluna reta e pescoço alinhado.', 'Retorne e alterne os lados.'], videoId: 'g7z-NskmH8o' },
    { name: 'Polichinelos (Jumping Jacks)', sets: 4, reps: '45 seg ativos', rest: '45s', description: 'Abra e feche braços e pernas de forma coordenada.', instructions: ['Comece em pé com braços colados na lateral.', 'Salte abrindo as pernas e batendo as mãos acima da cabeça.', 'Salte novamente retornando à posição inicial.', 'Mantenha um ritmo constante.'], videoId: 'U4s4mEq5yqM' },
    { name: 'Escalador (Mountain Climbers)', sets: 3, reps: '30 seg ativos', rest: '45s', description: 'Em posição de flexão, traga os joelhos em direção ao peito.', instructions: ['Comece na posição clássica de flexão.', 'Traga o joelho direito em direção ao peito sem subir o quadril.', 'Troque rapidamente de perna de forma alternada.', 'Mantenha o core contraído.'], videoId: 'cnyTQDSE884' },
    { name: 'Abdominal Infra', sets: 3, reps: '15 reps', rest: '60s', description: 'Eleve as pernas flexionadas focando na parte inferior do abdômen.', instructions: ['Deite de costas e coloque as mãos sob o quadril.', 'Eleve as pernas dobradas ou estendidas até 90 graus.', 'Desça controladamente sem tocar os calcanhares no chão.', 'Mantenha a lombar colada no solo.'], videoId: 'Rvc8Jt1S1pE' }
  ],
  core_cardio_injury: [
    { name: 'Prancha Abdominal (Plank)', sets: 3, reps: '30 a 45s', rest: '60s', description: 'Mantenha o corpo alinhado e o abdômen totalmente contraído.', instructions: ['Apoie os antebraços e as pontas dos pés no chão.', 'Mantenha o quadril alinhado com a linha dos ombros.', 'Contraia glúteos e abdômen intensamente.', 'Respire ritmadamente.'], videoId: 'pvIjsG5yYgs' },
    { name: 'Super-Homem (Bird-Dog)', sets: 3, reps: '12 reps alternadas', rest: '45s', description: 'Excelente para estabilizar a coluna e fortalecer a lombar.', instructions: ['Posicione-se em 4 apoios (mãos e joelhos).', 'Estenda o braço direito à frente e a perna esquerda atrás ao mesmo tempo.', 'Mantenha a coluna reta e pescoço alinhado.', 'Retorne e alterne os lados.'], videoId: 'g7z-NskmH8o' },
    { name: 'Boxe Sombra (Shadow Boxing)', sets: 4, reps: '2 min ativo', rest: '60s', description: 'Dê socos no ar mantendo movimentação ágil e sem impacto nos joelhos.', instructions: ['Fique em posição de guarda com pernas semi-flexionadas.', 'Dê socos (jabs, diretos e cruzados) alternados no ar.', 'Foque na velocidade e contração do core.', 'Evite saltos para não estressar os joelhos.'], videoId: 'r4MzxtB1FTo' },
    { name: 'Pedalada Deitada (Bicycle Crunch)', sets: 3, reps: '20 reps', rest: '45s', description: 'Abdominal trazendo cotovelo oposto ao joelho alternadamente.', instructions: ['Deite de costas com mãos atrás da cabeça e joelhos a 90 graus.', 'Traga o cotovelo direito em direção ao joelho esquerdo estendendo a perna direita.', 'Alterne os lados imitando o pedalar de uma bicicleta.', 'Não force o pescoço.'], videoId: 'IwyvoX6V2zA' }
  ],
  cardio_treadmill: [
    { name: 'Caminhada Rápida na Esteira', sets: 1, reps: '15 min', rest: '--', description: 'Caminhada rápida em esteira com inclinação para queimar calorias sem impacto.', instructions: ['Ligue a esteira na velocidade de 5 a 6 km/h.', 'Ajuste a inclinação para 2% a 4% se possível.', 'Mantenha a passada firme por 15 minutos.', 'Mantenha a postura ereta e core ativado.'], videoId: 'CAwf7n6Luuc' }, // Fallback
    { name: 'Trote na Esteira', sets: 1, reps: '15 min', rest: '--', description: 'Trote leve alternado para aumentar o fôlego na esteira.', instructions: ['Aqueça caminhando por 3 minutos.', 'Suba a velocidade para 7 a 9 km/h para trotar.', 'Mantenha os ombros relaxados e respire ritmadamente.', 'Caminhe no final para esfriar.'], videoId: 'CAwf7n6Luuc' } // Fallback
  ],
  home_bands: [
    { name: 'Remada com Elástico (Bands)', sets: 3, reps: '12-15 reps', rest: '60s', description: 'Trabalho de costas prendendo o elástico nos pés ou maçaneta.', instructions: ['Pise no elástico ou prenda-o firme à altura do umbigo.', 'Segure as pontas com os braços esticados.', 'Puxe os cotovelos para trás apertando as escápulas.', 'Estenda os braços controladamente.'], videoId: 'Oq5Psq1o004' },
    { name: 'Rosca de Bíceps com Elástico', sets: 3, reps: '12 reps', rest: '60s', description: 'Trabalho de bíceps com tensão contínua usando elásticos.', instructions: ['Pise no elástico com pés paralelos.', 'Segure as pontas com as palmas voltadas para cima.', 'Flexione os cotovelos trazendo as mãos ao peito.', 'Retorne sentindo a resistência.'], videoId: 'LY1V6UbRHFM' }
  ],
  home_handgrip: [
    { name: 'Aperto de Handgrip', sets: 3, reps: '15-20 reps', rest: '45s', description: 'Fortalecimento de antebraço e pegada usando o handgrip.', instructions: ['Segure o handgrip firmemente com uma das mãos.', 'Aperte até as duas extremidades se tocarem.', 'Solte de forma controlada.', 'Faça todas as repetições e depois troque de mão.'], videoId: '0-q9y59a72w' }
  ]
};

export default function FitnessPlans({ userProfile, userMemory, onWorkoutCompleted, onMemoryUpdate }: FitnessPlansProps) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [completedExercises, setCompletedExercises] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  // Custom states for customization features
  const [dayVariants, setDayVariants] = useState<number[]>([0, 0, 0]);
  const [expandedExerciseIndex, setExpandedExerciseIndex] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Manual Workout States
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualWorkoutName, setManualWorkoutName] = useState('');
  const [manualWorkoutDuration, setManualWorkoutDuration] = useState('');
  const [manualWorkoutCalories, setManualWorkoutCalories] = useState('');
  
  // Watch photo analyzer states
  const [manualPhotoFile, setManualPhotoFile] = useState<File | null>(null);
  const [manualPhotoPreview, setManualPhotoPreview] = useState<string | null>(null);
  const [manualScanLoading, setManualScanLoading] = useState(false);
  const [manualScanResult, setManualScanResult] = useState<any | null>(null);
  const [manualScanError, setManualScanError] = useState<string | null>(null);

  const todayStr = getLocalDateString();
  const focus = userMemory.goals.focusArea || 'health';
  const location = userMemory.preferences.location || 'home';
  const injuries = userMemory.healthConstraints.injuries || [];
  const equipment = userMemory.preferences.equipment || [];
  const dislikedList = userMemory.preferences.dislikedExercises || [];

  // Helper to select exercises from a pool, filtering disliked and applying seed/variant offset
  const selectExercises = (pool: Exercise[], count: number, variant: number): Exercise[] => {
    // Filter out disliked exercises
    const filtered = pool.filter(ex => 
      !dislikedList.some(dis => dis.toLowerCase() === ex.name.toLowerCase())
    );

    if (filtered.length === 0) {
      // Fallback if user disliked everything, return original pool sliced
      return pool.slice(0, count);
    }

    const selected: Exercise[] = [];
    // Rotate offset based on variant index
    const offset = (variant * 2) % filtered.length;

    for (let i = 0; i < Math.min(count, filtered.length); i++) {
      const idx = (i + offset) % filtered.length;
      if (!selected.some(s => s.name === filtered[idx].name)) {
        selected.push(filtered[idx]);
      }
    }

    // Fill up if duplicate checks sliced too short
    let fillCounter = 0;
    while (selected.length < count && selected.length < filtered.length && fillCounter < 20) {
      const nextIdx = (selected.length + offset + fillCounter) % filtered.length;
      const candidate = filtered[nextIdx];
      if (!selected.some(s => s.name === candidate.name)) {
        selected.push(candidate);
      }
      fillCounter++;
    }

    return selected;
  };

  // Dynamic Routine split generator using pools + physical preferences
  const generateWorkoutSplit = (): WorkoutDay[] => {
    const routine: WorkoutDay[] = [];
    const isGym = location === 'gym';
    const hasKneePain = injuries.includes('kneePain');
    const hasBackPain = injuries.includes('backPain');
    
    // Equipments check for Home (robust & case-insensitive matching)
    const hasDumbbells = equipment.some(e => {
      const s = typeof e === 'string' ? e.toLowerCase() : '';
      return s.includes('dumbbell') || s.includes('peso') || s.includes('halter') || s.includes('halteres');
    });
    const hasTreadmill = equipment.some(e => {
      const s = typeof e === 'string' ? e.toLowerCase() : '';
      return s.includes('treadmill') || s.includes('esteira');
    });
    const hasHandgrip = equipment.some(e => {
      const s = typeof e === 'string' ? e.toLowerCase() : '';
      return s.includes('handgrip') || s.includes('alicate') || s.includes('grip');
    });
    const hasBands = equipment.some(e => {
      const s = typeof e === 'string' ? e.toLowerCase() : '';
      return s.includes('band') || s.includes('elastico') || s.includes('elástico') || s.includes('faixa');
    });

    // 1. Day A (Upper Body)
    let dayAPool = isGym ? EXERCISE_POOLS.gym_upper : EXERCISE_POOLS.home_upper;
    if (!isGym) {
      const homeUpperPool = [...EXERCISE_POOLS.home_upper];
      if (hasDumbbells) {
        homeUpperPool.unshift(...EXERCISE_POOLS.home_upper_weights);
      }
      if (hasBands) {
        homeUpperPool.push(...EXERCISE_POOLS.home_bands);
      }
      if (hasHandgrip) {
        homeUpperPool.push(...EXERCISE_POOLS.home_handgrip);
      }
      dayAPool = homeUpperPool;
    }
    const dayAExercises = selectExercises(dayAPool, 4, dayVariants[0] || 0);
    routine.push({
      dayName: 'Treino A',
      focus: 'Membros Superiores & Força',
      exercises: dayAExercises
    });

    // 2. Day B (Lower Body)
    let dayBPool = isGym ? EXERCISE_POOLS.gym_lower : EXERCISE_POOLS.home_lower;
    if (hasKneePain) {
      dayBPool = EXERCISE_POOLS.lower_injury;
    } else if (!isGym && hasDumbbells) {
      dayBPool = [...EXERCISE_POOLS.home_lower_weights, ...EXERCISE_POOLS.home_lower];
    }
    const dayBExercises = selectExercises(dayBPool, 4, dayVariants[1] || 0);
    routine.push({
      dayName: 'Treino B',
      focus: 'Membros Inferiores & Core',
      exercises: dayBExercises
    });

    // 3. Day C (Core & Cardio)
    let dayCPool = hasKneePain ? EXERCISE_POOLS.core_cardio_injury : EXERCISE_POOLS.core_cardio_normal;
    if (hasTreadmill) {
      dayCPool = [...EXERCISE_POOLS.cardio_treadmill, ...dayCPool];
    }
    const dayCExercises = selectExercises(dayCPool, 3, dayVariants[2] || 0);
    routine.push({
      dayName: 'Treino C',
      focus: 'Core & Condicionamento Metabólico',
      exercises: dayCExercises
    });

    return routine;
  };

  const split = generateWorkoutSplit();
  const currentDay = split[activeDayIndex] || split[0];

  const handleStartWorkout = () => {
    setIsPlaying(true);
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setCompletedExercises([]);
    setShowSummary(false);
  };

  const handleNextSet = () => {
    const exercise = currentDay.exercises[currentExerciseIndex];
    if (currentSet < exercise.sets) {
      setCurrentSet(prev => prev + 1);
    } else {
      setCompletedExercises(prev => [...prev, currentExerciseIndex]);
      if (currentExerciseIndex < currentDay.exercises.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
      } else {
        handleFinishWorkout();
      }
    }
  };

  const handleFinishWorkout = () => {
    try {
      // Calculate local profile updates immediately
      const updatedXp = userProfile.xp + 100;
      const levelCheck = checkLevelUp(userProfile.level, updatedXp);
      const localUpdatedProfile: UserProfile = {
        ...userProfile,
        level: levelCheck.newLevel,
        xp: levelCheck.remainingXp,
        xpNeededForNextLevel: levelCheck.xpNeeded,
        title: getTitleForLevel(levelCheck.newLevel)
      };

      setIsPlaying(false);
      setShowSummary(true);
      
      // Update UI state immediately
      onWorkoutCompleted(localUpdatedProfile, []);

      // Background async update
      (async () => {
        try {
          const res = await awardXp(userProfile.uid, userProfile, 100, 'workout');

          // Read log BEFORE saving to know if workout was already counted today
          // (e.g. user may have logged it in QuestSystem earlier, or App.tsx set the quest optimistically)
          const log = await getProgressLogForDate(userProfile.uid, todayStr);
          const wasAlreadyLogged = log.workoutCompleted;
          await saveProgressLog(userProfile.uid, {
            ...log,
            workoutCompleted: true,
            xpEarned: log.xpEarned + 100
          });

          const activeQuests = await getQuests(userProfile.uid);
          const dailyWorkout = activeQuests.find(q => q.type === 'workout' && q.category === 'daily');

          // Use wasAlreadyLogged instead of dailyWorkout.completed — the quest may already appear
          // completed in localStorage because App.tsx optimistically marked it, but the weekly
          // counter should only increment once per actual new workout.
          if (dailyWorkout && !wasAlreadyLogged) {
            await saveQuest(userProfile.uid, {
              ...dailyWorkout,
              progress: 1,
              completed: true,
              completedDate: new Date().toISOString()
            });

            const weeklyWorkouts = activeQuests.find(q => q.id === 'weekly-workouts');
            if (weeklyWorkouts && !weeklyWorkouts.completed) {
              const newWeeklyProgress = weeklyWorkouts.progress + 1;
              const weeklyCompleted = newWeeklyProgress >= weeklyWorkouts.target;

              await saveQuest(userProfile.uid, {
                ...weeklyWorkouts,
                progress: newWeeklyProgress,
                completed: weeklyCompleted,
                completedDate: weeklyCompleted ? new Date().toISOString() : undefined
              });
            }
          }

          // Trigger state update with the final profile from server (which includes achievements check)
          onWorkoutCompleted(res.profile, res.unlockedAchievements);
        } catch (dbErr) {
          console.error('Background workout sync failed:', dbErr);
        }
      })();
    } catch (err) {
      console.error('Failed to finish workout (optimistic):', err);
    }
  };

  // REGENERATE Workout splits variations (only the active day!)
  const handleRegenerateWorkout = () => {
    setDayVariants(prev => {
      const copy = [...prev];
      copy[activeDayIndex] = (copy[activeDayIndex] || 0) + 1;
      return copy;
    });
    showBannerNotification(`Gerando variação de treino alternativa para o ${currentDay.dayName}...`);
  };

  // Log manual workout (run/treadmill/etc.)
  const handleLogManualWorkout = async (name: string, duration: number, calories: number) => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      // Award XP locally (+100 XP)
      const updatedXp = userProfile.xp + 100;
      const levelCheck = checkLevelUp(userProfile.level, updatedXp);
      const localUpdatedProfile: UserProfile = {
        ...userProfile,
        level: levelCheck.newLevel,
        xp: levelCheck.remainingXp,
        xpNeededForNextLevel: levelCheck.xpNeeded,
        title: getTitleForLevel(levelCheck.newLevel)
      };

      // Reset form states
      setManualWorkoutName('');
      setManualWorkoutDuration('');
      setManualWorkoutCalories('');
      setManualPhotoFile(null);
      setManualPhotoPreview(null);
      setManualScanResult(null);
      setManualScanError(null);
      setShowManualForm(false);
      
      showBannerNotification(`Atividade de "${name}" registrada com sucesso! +100 XP coletados.`);
      
      // Update UI state immediately
      onWorkoutCompleted(localUpdatedProfile, []);

      // Background save (Firestore & XP on DB)
      (async () => {
        try {
          const res = await awardXp(userProfile.uid, userProfile, 100, 'workout');

          const log = await getProgressLogForDate(userProfile.uid, todayStr);
          const wasAlreadyLogged = log.workoutCompleted;
          await saveProgressLog(userProfile.uid, {
            ...log,
            workoutCompleted: true,
            xpEarned: log.xpEarned + 100
          });

          const activeQuests = await getQuests(userProfile.uid);
          const dailyWorkout = activeQuests.find(q => q.type === 'workout' && q.category === 'daily');

          if (dailyWorkout && !wasAlreadyLogged) {
            await saveQuest(userProfile.uid, {
              ...dailyWorkout,
              progress: 1,
              completed: true,
              completedDate: new Date().toISOString()
            });

            const weeklyWorkouts = activeQuests.find(q => q.id === 'weekly-workouts');
            if (weeklyWorkouts && !weeklyWorkouts.completed) {
              const newWeeklyProgress = weeklyWorkouts.progress + 1;
              const weeklyCompleted = newWeeklyProgress >= weeklyWorkouts.target;

              await saveQuest(userProfile.uid, {
                ...weeklyWorkouts,
                progress: newWeeklyProgress,
                completed: weeklyCompleted,
                completedDate: weeklyCompleted ? new Date().toISOString() : undefined
              });
            }
          }

          onWorkoutCompleted(res.profile, res.unlockedAchievements);
        } catch (dbErr) {
          console.error('Background manual workout save failed:', dbErr);
        }
      })();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setManualPhotoFile(file);
      setManualPhotoPreview(URL.createObjectURL(file));
      setManualScanResult(null);
      setManualScanError(null);
    }
  };

  const handleAnalyzeManualPhoto = async () => {
    if (!manualPhotoFile) return;
    setManualScanLoading(true);
    setManualScanError(null);
    setManualScanResult(null);

    try {
      const result = await analyzeWorkoutPhoto(manualPhotoFile);
      setManualScanResult(result);
      
      // Auto-populate fields from scan results
      setManualWorkoutName(result.workoutName);
      setManualWorkoutDuration(result.durationMin.toString());
      setManualWorkoutCalories(result.caloriesBurned.toString());
    } catch (err: any) {
      console.error(err);
      setManualScanError(err.message || 'Erro ao processar imagem do treino.');
    } finally {
      setManualScanLoading(false);
    }
  };

  // DISLIKE Exercise action
  const handleDislikeExercise = async (exerciseName: string) => {
    try {
      // Avoid duplicates
      const updatedDisliked = [...dislikedList];
      if (!updatedDisliked.some(item => item.toLowerCase() === exerciseName.toLowerCase())) {
        updatedDisliked.push(exerciseName);
      }

      const updatedMemory: UserMemory = {
        ...userMemory,
        preferences: {
          ...userMemory.preferences,
          dislikedExercises: updatedDisliked
        },
        lastUpdated: new Date().toISOString()
      };

      saveUserMemory(userProfile.uid, updatedMemory);
      onMemoryUpdate(updatedMemory);
      // Bump the day variant so the workout immediately regenerates with the
      // disliked exercise filtered out — user sees a fresh set right away
      handleRegenerateWorkout();
      showBannerNotification(`"${exerciseName}" removido! Treino atualizado automaticamente.`);
    } catch (e) {
      console.error(e);
    }
  };

  const showBannerNotification = (text: string) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Ficha de Treino</h1>
        <p className="text-zinc-400">Gerenciador de exercícios inteligentes baseados em suas metas, equipamentos e restrições físicas.</p>
      </div>

      {/* Banner notification */}
      {notification && (
        <div className="p-3 bg-violet-600 text-white text-xs font-bold rounded-2xl shadow-xl flex items-center gap-2 animate-slide-down">
          <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{notification}</span>
        </div>
      )}

      {/* Active injuries banner */}
      {injuries.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-400 text-xs items-center">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider block">Ficha com Restrições Médicas Ativas</span>
            Exercícios de alto impacto para {injuries.map(i => i === 'kneePain' ? 'joelho' : 'lombar').join(', ')} foram filtrados e adaptados para baixo impacto.
          </div>
        </div>
      )}

      {!isPlaying && !showSummary && (
        <div className="space-y-6">
          
          {/* Day selection splits + Regenerate button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 flex-grow">
              {split.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveDayIndex(idx);
                    setExpandedExerciseIndex(null);
                  }}
                  className={`flex-grow py-3 text-xs font-bold rounded-xl transition cursor-pointer text-center ${
                    activeDayIndex === idx
                      ? 'bg-violet-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {day.dayName}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRegenerateWorkout}
              className="py-3 px-5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-350 hover:text-white font-bold rounded-2xl transition duration-150 cursor-pointer text-xs flex items-center justify-center gap-2"
              title="Gerar variação de exercícios alternativa"
            >
              <RotateCcw className="w-4 h-4 text-violet-400" />
              Regenerar Treino
            </button>
          </div>

          {/* Active Workout Card details */}
          <div className="glass-panel p-6 rounded-[32px] border border-zinc-850 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">{currentDay.focus}</span>
                <h2 className="text-2xl font-black text-white mt-0.5">{currentDay.dayName}</h2>
              </div>
              <button
                type="button"
                onClick={handleStartWorkout}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-[1.02] active:scale-98 text-white font-bold rounded-2xl transition duration-150 cursor-pointer shadow-lg shadow-violet-600/20 text-xs flex items-center justify-center gap-1.5 self-start sm:self-center"
              >
                <Play className="w-4 h-4" /> Iniciar Treino (+100 XP)
              </button>
            </div>

            {/* Exercises List with Tutorials & Dislike buttons */}
            <div className="space-y-4 pt-2">
              {currentDay.exercises.map((ex, idx) => {
                const isExpanded = expandedExerciseIndex === idx;
                return (
                  <div key={idx} className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col gap-4">
                    
                    {/* Top Row: Info and parameters */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div 
                        className="space-y-1 cursor-pointer flex-grow"
                        onClick={() => setExpandedExerciseIndex(isExpanded ? null : idx)}
                      >
                        <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2 hover:text-violet-400 transition">
                          <span className="w-5 h-5 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-extrabold">{idx + 1}</span>
                          {ex.name}
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                        </h4>
                        <p className="text-xs text-zinc-400 leading-normal pl-7">{ex.description}</p>
                      </div>

                      <div className="flex items-center gap-4 pl-7 sm:pl-0 justify-between sm:justify-start">
                        {/* Parameters */}
                        <div className="flex gap-4">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Séries</span>
                            <span className="text-xs font-bold text-zinc-200">{ex.sets}x</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Reps</span>
                            <span className="text-xs font-bold text-violet-400">{ex.reps}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Descanso</span>
                            <span className="text-xs font-bold text-zinc-400">{ex.rest}</span>
                          </div>
                        </div>

                        {/* ThumbsDown Dislike action button */}
                        <button
                          type="button"
                          onClick={() => handleDislikeExercise(ex.name)}
                          className="p-2 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-550/20 text-zinc-500 hover:text-rose-400 rounded-xl transition duration-150 cursor-pointer"
                          title="Não quero este exercício na minha ficha de treino"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible written instructions and YouTube Video Player embed */}
                    {isExpanded && (
                      <div className="border-t border-zinc-850 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-scale-up">
                        
                        {/* Written instructions */}
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Instruções Escritas
                          </h5>
                          <ol className="space-y-2 text-xs text-zinc-400 pl-4 list-decimal leading-relaxed">
                            {ex.instructions.map((step, sIdx) => (
                              <li key={sIdx}>{step}</li>
                            ))}
                          </ol>
                        </div>

                        {/* Video tutorial embed iframe */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Video className="w-4 h-4 text-violet-400" />
                            Demonstração em Vídeo
                          </h5>
                          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video w-full shadow-lg">
                            <iframe 
                              src={`https://www.youtube.com/embed/${ex.videoId}`} 
                              title="Tutorial de Exercício"
                              className="absolute inset-0 w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            ></iframe>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Manual Workout Section */}
          <div className="glass-panel p-6 rounded-[32px] border border-zinc-850 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-violet-400" />
                  Atividade Extra / Treino Manual
                </h3>
                <p className="text-xs text-zinc-450 mt-1">
                  Fez outro treino hoje (como esteira, corrida na rua, natação)? Registre aqui.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualForm(prev => !prev)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-350 hover:text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-center"
              >
                {showManualForm ? 'Ocultar Formulário' : 'Registrar Manualmente'}
              </button>
            </div>

            {showManualForm && (
              <div className="border-t border-zinc-850 pt-6 space-y-6 animate-scale-up">
                {/* Photo Upload for Watch / Treadmill screenshot */}
                <div className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-2xl space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-pink-400" />
                      Análise Inteligente por Foto (Apple Watch / Garmin / Esteira)
                    </h4>
                    <p className="text-[11px] text-zinc-550 leading-relaxed">
                      Envie uma foto ou print do seu relógio ou painel da esteira mostrando as calorias e tempo. Nossa IA preencherá e analisará o treino automaticamente!
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Input file area */}
                    <div className="relative border-2 border-dashed border-zinc-800 hover:border-violet-500/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition bg-zinc-950/40">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleManualPhotoChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="w-6 h-6 text-zinc-550" />
                      <span className="text-xs text-zinc-400 font-bold text-center">
                        {manualPhotoFile ? manualPhotoFile.name : 'Selecionar Imagem'}
                      </span>
                      <span className="text-[10px] text-zinc-550 text-center">
                        PNG, JPG ou JPEG
                      </span>
                    </div>

                    {/* Preview & Scan Button */}
                    {manualPhotoPreview && (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-950/50 p-3 rounded-xl border border-zinc-850">
                        <img 
                          src={manualPhotoPreview} 
                          alt="Prévia do treino" 
                          className="w-20 h-20 object-cover rounded-lg border border-zinc-800"
                        />
                        <div className="flex flex-col gap-2 w-full">
                          <button
                            type="button"
                            onClick={handleAnalyzeManualPhoto}
                            disabled={manualScanLoading}
                            className="px-4 py-2 bg-pink-650 hover:bg-pink-600 active:scale-98 text-white text-xs font-bold rounded-xl transition duration-150 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 w-full"
                          >
                            {manualScanLoading ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                                Analisando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                Analisar com Gemini IA
                              </>
                            )}
                          </button>
                          {manualScanError && (
                            <p className="text-[10px] text-rose-400 font-medium">{manualScanError}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feedback output from AI scanner */}
                  {manualScanResult && (
                    <div className="p-4 bg-violet-650/10 border border-violet-500/20 rounded-xl space-y-1.5 animate-scale-up">
                      <span className="text-[10px] font-extrabold text-violet-400 uppercase tracking-wider block">Avaliação do Treinador IA:</span>
                      <p className="text-xs text-zinc-350 italic leading-relaxed">
                        "{manualScanResult.feedback}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-sans">Atividade / Exercício</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Corrida, Esteira, Natação..." 
                      value={manualWorkoutName}
                      onChange={(e) => setManualWorkoutName(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-violet-500 text-xs font-bold text-zinc-200 placeholder-zinc-600 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-sans">Duração (Minutos)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 40" 
                      value={manualWorkoutDuration}
                      onChange={(e) => setManualWorkoutDuration(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-violet-500 text-xs font-bold text-zinc-200 placeholder-zinc-600 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block font-sans">Calorias Queimadas (kcal)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 350" 
                      value={manualWorkoutCalories}
                      onChange={(e) => setManualWorkoutCalories(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-violet-500 text-xs font-bold text-zinc-200 placeholder-zinc-600 outline-none"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  onClick={() => handleLogManualWorkout(manualWorkoutName, Number(manualWorkoutDuration), Number(manualWorkoutCalories))}
                  disabled={loading || !manualWorkoutName.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-[1.01] active:scale-98 text-white font-black rounded-2xl transition duration-150 cursor-pointer disabled:opacity-50 text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  Salvar Treino Personalizado (+100 XP)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workout Player */}
      {isPlaying && (
        <div className="glass-panel p-8 rounded-[36px] border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-violet-950/10 space-y-8 animate-scale-up relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/5 rounded-full filter blur-[50px] pointer-events-none"></div>

          {/* Player Header */}
          <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
            <div>
              <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">{currentDay.dayName} · Sessão Ativa</span>
              <h2 className="text-xl font-bold text-white mt-0.5">Executando Treinamento</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition text-xs font-bold cursor-pointer"
            >
              Cancelar Treino
            </button>
          </div>

          {/* Current Exercise Detail */}
          {currentDay.exercises[currentExerciseIndex] && (
            <div className="space-y-8 max-w-4xl mx-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Left block (Player Detail & set selection) */}
                <div className="md:col-span-7 space-y-6 text-center md:text-left">
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase px-3 py-1 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-full">
                      Exercício {currentExerciseIndex + 1} de {currentDay.exercises.length}
                    </span>
                    <h3 className="text-2xl font-black text-white pt-2">{currentDay.exercises[currentExerciseIndex].name}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{currentDay.exercises[currentExerciseIndex].description}</p>
                  </div>

                  {/* Set indicator circles */}
                  <div className="flex justify-center md:justify-start gap-2 pt-2">
                    {Array.from({ length: currentDay.exercises[currentExerciseIndex].sets }).map((_, sIdx) => {
                      const setNum = sIdx + 1;
                      const isDone = setNum < currentSet;
                      const isActive = setNum === currentSet;
                      return (
                        <div
                          key={sIdx}
                          className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center transition border ${
                            isDone
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                              : isActive
                              ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20 glow-active-purple'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                          }`}
                        >
                          {setNum}
                        </div>
                      );
                    })}
                  </div>

                  {/* Target parameters */}
                  <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto md:mx-0 pt-4">
                    <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Meta da Série</span>
                      <span className="text-base font-extrabold text-violet-400 mt-0.5">{currentDay.exercises[currentExerciseIndex].reps}</span>
                    </div>
                    <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl text-center">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tempo de Descanso</span>
                      <span className="text-base font-extrabold text-zinc-200 mt-0.5">{currentDay.exercises[currentExerciseIndex].rest}</span>
                    </div>
                  </div>

                  {/* Active controls button */}
                  <button
                    type="button"
                    onClick={handleNextSet}
                    disabled={loading}
                    className="w-full max-w-sm py-4 bg-gradient-to-r from-violet-600 to-pink-600 hover:scale-[1.02] active:scale-98 text-white font-bold rounded-2xl transition duration-150 cursor-pointer shadow-lg shadow-violet-600/20 text-sm mt-4"
                  >
                    {currentSet < currentDay.exercises[currentExerciseIndex].sets
                      ? `Completar Série ${currentSet} (+ Descanso)`
                      : currentExerciseIndex < currentDay.exercises.length - 1
                      ? 'Próximo Exercício'
                      : 'Finalizar Treino & Coletar Recompensas'}
                  </button>
                </div>

                {/* Right block (Active video tutorial inside player!) */}
                <div className="md:col-span-5 space-y-4">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Guia de Vídeo de Execução</span>
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video w-full shadow-lg">
                    <iframe 
                      src={`https://www.youtube.com/embed/${currentDay.exercises[currentExerciseIndex].videoId}`} 
                      title="Tutorial Ativo"
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>
                  
                  {/* Quick written tip */}
                  <div className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-2xl">
                    <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider block mb-1">Dica Rápida</span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {currentDay.exercises[currentExerciseIndex].instructions[0]}
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* Global Progress Bar */}
          <div className="space-y-1.5 pt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-zinc-500">Progresso Geral do Treino</span>
              <span className="font-bold text-violet-400">
                {Math.round((completedExercises.length / currentDay.exercises.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-zinc-900 border border-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all duration-300"
                style={{ width: `${(completedExercises.length / currentDay.exercises.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Workout Success Summary Splash Screen */}
      {showSummary && (
        <div className="glass-panel p-8 rounded-[36px] border border-amber-500/20 bg-gradient-to-br from-zinc-900 to-amber-950/10 text-center space-y-6 animate-scale-up flex flex-col items-center">
          <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Award className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Desafio Concluído!</span>
            <h2 className="text-3xl font-black text-white">Treino Registrado com Sucesso</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-normal">
              Você conquistou os calabouços físicos hoje e ganhou recompensas lendárias!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-xs p-4 bg-zinc-900/60 border border-zinc-800 rounded-3xl">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">XP Adquirido</span>
              <span className="text-lg font-bold text-violet-400">+100 XP</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Status da Quest</span>
              <span className="text-lg font-bold text-emerald-400">Concluido</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSummary(false)}
            className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-2xl transition duration-150 cursor-pointer text-xs"
          >
            Fechar Relatório
          </button>
        </div>
      )}
    </div>
  );
}
