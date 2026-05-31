export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: string; // ISO String
  level: number;
  xp: number;
  xpNeededForNextLevel: number;
  title: string;
  streak: number;
  lastActive: string; // YYYY-MM-DD
}

export interface UserMemory {
  goals: {
    targetWeightKg?: number;
    currentWeightKg?: number;
    weeklyWeightLossTargetKg?: number;
    focusArea?: 'weightLoss' | 'muscleGain' | 'endurance' | 'health';
    /** How aggressive the approach should be — affects calorie deficit/surplus and workout volume */
    intensity?: 'light' | 'moderate' | 'aggressive';
  };
  preferences: {
    location?: 'home' | 'gym';
    equipment?: string[];
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    dietType?: 'omnivore' | 'vegetarian' | 'vegan' | 'carnivore' | 'keto' | 'lowcarb';
    allergies?: string[];
    /** Free-text food restrictions in natural language — interpreted by AI */
    foodRestrictionsRaw?: string;
    dislikedExercises?: string[];
  };
  healthConstraints: {
    injuries?: string[];
    limitations?: string;
  };
  schedule: {
    availableMinutesPerDay?: number;
    workoutDaysPerWeek?: number;
    restDays?: string[];
  };
  physicalProfile?: {
    age?: number;
    heightCm?: number;
    weightKg?: number;
    gender?: 'male' | 'female';
    activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
  };

  // ── Mini AI brain — personality & wellbeing tracking ──────────────────────
  /** How the coach should communicate — mirrors the user's detected speaking style */
  coachPersonality?: {
    userTone?: 'casual' | 'formal' | 'slangy';
    /** Observed patterns: "uses vc/q/n, informal, no punctuation, uses kkk" */
    speakingStyle?: string;
    useEmojis?: boolean;
  };
  /** Real-time wellbeing state — updated by the coach during conversations */
  wellbeing?: {
    currentMood?: 'great' | 'good' | 'tired' | 'stressed' | 'bad';
    energyLevel?: 'high' | 'medium' | 'low';
    motivationLevel?: 'high' | 'medium' | 'low';
    /** Last few things the user complained about in natural language */
    recentComplaints?: string[];
    /** Specific exercises the user complained about: ["Agachamento - dói joelho"] */
    exerciseComplaints?: string[];
    /** Foods/ingredients that caused issues: ["frango à noite - enjoa"] */
    foodComplaints?: string[];
  };
  /** Free-text body notes — pains, limitations, sensations detected during chat */
  bodyNotes?: string;

  lastUpdated: string; // ISO String
}

export interface Quest {
  id: string;
  title: string;
  category: 'daily' | 'weekly' | 'special';
  type: 'water' | 'workout' | 'nutrition' | 'steps' | 'custom';
  xpReward: number;
  completed: boolean;
  completedDate?: string; // ISO String
  progress: number;
  target: number;
  unit: string;
  /** ISO date (YYYY-MM-DD) of the Monday that started the week this quest belongs to.
   *  Set on weekly quests only. Used to detect week boundaries and reset stale weekly quests. */
  weekStart?: string;
}

export interface LoggedFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  timestamp: string;
}

export interface ProgressLog {
  id: string;
  date: string; // YYYY-MM-DD
  weight?: number;
  waterIntakeMl: number;
  caloriesConsumed?: number;
  proteinConsumedG?: number;
  workoutCompleted: boolean;
  stepsCompleted: number;
  xpEarned: number;
  loggedFoods?: LoggedFood[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string; // ISO String
  icon: string; // Icon name matching Lucide keys
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string; // ISO String
}
