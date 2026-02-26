// File: src/lib/errorTypes.ts
// LogiClue Error Classification: 7 Option Errors + 3 User Errors

// ============================================
// OPTION ERROR: What trick did the wrong option use?
// ============================================

export type OptionErrorL1 = 
  | 'extreme'      // 过强 — 程度/范围超出原文
  | 'too_narrow'   // 过窄 — 范围/条件比原文更限制
  | 'distortion'   // 扭曲 — 和原文像但含义不同
  | 'misplaced'    // 错位 — 原文有但不是题目要的角色
  | 'neighbor'     // 邻居 — 逻辑合理但不是本题的
  | 'off_target'   // 脱靶 — 和原文论证链没交集
  | 'opposite'     // 反向 — 效果方向相反
  | 'correct'      // 正确选项
  | 'not_target';  // EXCEPT题中逻辑正确但非目标

export interface OptionError {
  code: OptionErrorL1;
  name_zh: string;
  name_en: string;
  definition: string;
  anchor: string;  // 一句话判断锚点
}

export const OPTION_ERRORS: Record<string, OptionError> = {
  extreme: {
    code: 'extreme',
    name_zh: '过强',
    name_en: 'Extreme',
    definition: 'Degree or scope exceeds what the stimulus states',
    anchor: 'Stimulus says "may/could", option says "must/always"',
  },
  too_narrow: {
    code: 'too_narrow',
    name_zh: '过窄',
    name_en: 'Too Narrow',
    definition: 'Scope or conditions more restrictive than the stimulus',
    anchor: 'Stimulus says "animals", option says "mammals only"',
  },
  distortion: {
    code: 'distortion',
    name_zh: '扭曲',
    name_en: 'Distortion',
    definition: 'Looks similar to the stimulus but meaning differs',
    anchor: 'Familiar words, but the meaning has been swapped',
  },
  misplaced: {
    code: 'misplaced',
    name_zh: '错位',
    name_en: 'Misplaced',
    definition: 'Content exists in stimulus but not in the role the question asks about',
    anchor: 'Right content, wrong structural position',
  },
  neighbor: {
    code: 'neighbor',
    name_zh: '邻居',
    name_en: 'Neighbor',
    definition: 'Logically sound reasoning but not what this question is asking',
    anchor: 'Makes sense, but not the question being asked',
  },
  off_target: {
    code: 'off_target',
    name_zh: '脱靶',
    name_en: 'Off Target',
    definition: 'No intersection with the argument chain in the stimulus',
    anchor: 'Completely unrelated to the argument',
  },
  opposite: {
    code: 'opposite',
    name_zh: '反向',
    name_en: 'Opposite',
    definition: 'Effect direction is reversed from what the question requires',
    anchor: 'Question asks to strengthen, option weakens',
  },
};

// ============================================
// USER ERROR: What did the user's thinking do?
// ============================================

export type UserErrorL1 = 
  | 'missed'   // 少了 — key info ignored, not replaced
  | 'added'    // 多了 — new info introduced, not replacing existing
  | 'swapped'; // 替了 — existing info A replaced by similar B

export interface UserError {
  code: UserErrorL1;
  name_zh: string;
  name_en: string;
  definition: string;
}

export const USER_ERRORS: Record<string, UserError> = {
  missed: {
    code: 'missed',
    name_zh: '少了',
    name_en: 'Missed',
    definition: 'Key information was ignored, not replaced by anything else',
  },
  added: {
    code: 'added',
    name_zh: '多了',
    name_en: 'Added',
    definition: 'New information was introduced, not replacing existing info',
  },
  swapped: {
    code: 'swapped',
    name_zh: '替了',
    name_en: 'Swapped',
    definition: 'Existing info A was replaced by similar-looking B (similarity bridge between A and B)',
  },
};

// ============================================
// DEFAULT MAPPING: option_error.L1 → user_error.L1
// Used in Phase A when no user self-report available
// ============================================

export const DEFAULT_MAPPING: Record<string, UserErrorL1> = {
  extreme:    'swapped',    // User likely read weak word as strong
  too_narrow: 'missed',     // User likely missed broader scope
  distortion: 'swapped',   // User likely fooled by surface similarity
  misplaced:  'missed',     // User likely didn't notice structural role
  neighbor:   'added',      // User likely invented a connection
  off_target: 'added',      // User likely introduced external knowledge
  opposite:   'swapped',    // User likely reversed the direction
};

// ============================================
// L1 JUDGMENT FLOW (for prompt injection)
// ============================================

export const OPTION_ERROR_JUDGMENT_FLOW = `
1. Does the option intersect with the stimulus at all?
   → No → off_target
2. Is the option's direction consistent with what the question asks?
   → Opposite → opposite  
3. Does the option's content exist in the stimulus?
   → Exists but wrong structural role → misplaced
   → Exists but meaning has been swapped → distortion
   → Does not exist but logically reasonable → neighbor
4. Is the option's degree/scope consistent with the stimulus?
   → Stronger/broader than stimulus → extreme
   → Weaker/narrower than stimulus → too_narrow
`;

export const USER_ERROR_JUDGMENT_FLOW = `
1. Did the user ignore key information in the stimulus?
   → Yes, and nothing replaced it → missed
2. Did the user's judgment include information not in the stimulus?
   → Yes, and it's not replacing existing info → added
3. Did the user substitute info A with similar-looking info B?
   → Yes, A and B have surface similarity → swapped
`;

// ============================================
// HELPERS
// ============================================

export function getOptionError(code: string): OptionError | undefined {
  return OPTION_ERRORS[code];
}

export function getUserError(code: string): UserError | undefined {
  return USER_ERRORS[code];
}

export function getDefaultUserError(optionErrorL1: string): UserErrorL1 {
  return DEFAULT_MAPPING[optionErrorL1] || 'missed';
}

export function getOptionErrorCodes(): string[] {
  return Object.keys(OPTION_ERRORS);
}

export function getUserErrorCodes(): string[] {
  return Object.keys(USER_ERRORS);
}

export default OPTION_ERRORS;