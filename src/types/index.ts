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
  };
  preferences: {
    location?: 'home' | 'gym';
    equipment?: string[];
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    dietType?: 'omnivore' | 'vegetarian' | 'vegan' | 'carnivore' | 'keto' | 'lowcarb';
    allergies?: string[];
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
