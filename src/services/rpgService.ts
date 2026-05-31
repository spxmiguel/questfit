import { UserProfile, Quest, Achievement, ProgressLog } from '../types';
import { checkLevelUp, getTitleForLevel, getXpNeededForLevel } from '../utils/xpCalc';
import { saveUserProfile, getAchievements, saveAllAchievements } from './dbService';

export interface RpgUpdateResult {
  profile: UserProfile;
  leveledUp: boolean;
  unlockedAchievements: Achievement[];
}

// Award XP to the user and handle level ups and achievements check
export const awardXp = async (
  uid: string,
  profile: UserProfile,
  xpAmount: number,
  actionType?: 'workout' | 'quest' | 'water' | 'streak' | 'weight'
): Promise<RpgUpdateResult> => {
  const updatedXp = profile.xp + xpAmount;
  const levelCheck = checkLevelUp(profile.level, updatedXp);
  
  const updatedProfile: UserProfile = {
    ...profile,
    level: levelCheck.newLevel,
    xp: levelCheck.remainingXp,
    xpNeededForNextLevel: levelCheck.xpNeeded,
    title: getTitleForLevel(levelCheck.newLevel)
  };

  // Load and check achievements
  const achievements = await getAchievements(uid);
  const newlyUnlocked: Achievement[] = [];
  
  const checkUnlock = (id: string) => {
    const ach = achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlockedAt = new Date().toISOString();
      newlyUnlocked.push(ach);
    }
  };

  // Rule 1: First Quest completion
  if (actionType === 'quest') {
    checkUnlock('ach-first-quest');
  }

  // Rule 2: First Workout
  if (actionType === 'workout') {
    checkUnlock('ach-first-workout');
  }

  // Rule 3: Level milestone (Level 10)
  if (levelCheck.newLevel >= 10) {
    checkUnlock('ach-level-10');
  }

  // Rule 4: Streak check
  if (profile.streak >= 7) {
    checkUnlock('ach-streak-7');
  }

  // Save changes if anything unlocked
  if (newlyUnlocked.length > 0) {
    await saveAllAchievements(uid, achievements);
  }

  // Save profile updates
  await saveUserProfile(uid, updatedProfile);

  return {
    profile: updatedProfile,
    leveledUp: levelCheck.leveledUp,
    unlockedAchievements: newlyUnlocked
  };
};

// Check and update daily activity streak
export const checkAndUpdateStreak = async (
  uid: string,
  profile: UserProfile
): Promise<UserProfile> => {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  let newStreak = profile.streak;
  
  if (profile.lastActive === todayStr) {
    // Already active today, streak is maintained
    return profile;
  } else if (profile.lastActive === yesterdayStr) {
    // Active yesterday, increment streak
    newStreak += 1;
  } else if (profile.lastActive === '') {
    // First time logging
    newStreak = 1;
  } else {
    // Streak broken (inactive for > 1 day)
    newStreak = 1;
  }

  const updatedProfile: UserProfile = {
    ...profile,
    streak: newStreak,
    lastActive: todayStr
  };

  await saveUserProfile(uid, updatedProfile);
  return updatedProfile;
};
