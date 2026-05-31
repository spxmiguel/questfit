export interface PhysicalProfile {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  gender?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
}

export const calculateBMR = (profile: PhysicalProfile): number => {
  const weight = profile.weightKg || 70;
  const height = profile.heightCm || 170;
  const age = profile.age || 25;
  const gender = profile.gender || 'male';

  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
};

export const getActivityFactor = (level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'): number => {
  switch (level) {
    case 'sedentary': return 1.2;
    case 'light': return 1.375;
    case 'moderate': return 1.55;
    case 'active': return 1.725;
    case 'veryActive': return 1.9;
    default: return 1.375;
  }
};

export const calculateTDEE = (profile: PhysicalProfile): number => {
  const bmr = calculateBMR(profile);
  const factor = getActivityFactor(profile.activityLevel);
  return Math.round(bmr * factor);
};

export const calculateBMI = (weightKg?: number, heightCm?: number): { value: number; category: string; color: string } => {
  if (!weightKg || !heightCm) return { value: 0, category: 'Não definido', color: 'text-zinc-500' };
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const roundedBmi = Math.round(bmi * 10) / 10;

  if (bmi < 18.5) {
    return { value: roundedBmi, category: 'Abaixo do peso', color: 'text-sky-400' };
  } else if (bmi < 25) {
    return { value: roundedBmi, category: 'Peso normal', color: 'text-emerald-400' };
  } else if (bmi < 30) {
    return { value: roundedBmi, category: 'Sobrepeso', color: 'text-amber-400' };
  } else {
    return { value: roundedBmi, category: 'Obesidade', color: 'text-rose-400' };
  }
};
