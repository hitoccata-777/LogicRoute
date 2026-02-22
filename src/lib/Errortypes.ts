// File: src/lib/errorTypes.ts
// 13 Error Types for LogiClue LSAT Analysis

export interface ErrorType {
    code: string;
    name: string;
    trigger: string;
    diagnosis_template: string;
    example: string;
  }
  
  export const ERROR_TYPES: Record<string, ErrorType> = {
    
    // ============================================
    // 1. DIRECTION REVERSED
    // ============================================
    direction_reversed: {
      code: 'direction_reversed',
      name: 'Direction Reversed',
      trigger: 'User treated A→B as if it means B→A',
      diagnosis_template: 'You flipped the arrow. "{from}" leads to "{to}", not the other way around.',
      example: '"All dogs are mammals" doesn\'t mean "All mammals are dogs"'
    },
  
    // ============================================
    // 2. WRONG TARGET
    // ============================================
    wrong_target: {
      code: 'wrong_target',
      name: 'Wrong Target',
      trigger: 'User attacked/supported a different part of the argument than what was asked',
      diagnosis_template: 'You\'re fixing the wrong bridge. The question targets {correct_target}, but you addressed {wrong_target}.',
      example: 'Question asks about the conclusion, but you attacked a premise'
    },
  
    // ============================================
    // 3. TOO STRONG
    // ============================================
    too_strong: {
      code: 'too_strong',
      name: 'Too Strong',
      trigger: 'User chose an answer that goes beyond what the argument needs',
      diagnosis_template: 'The argument doesn\'t need this much. It only requires "{needed}", not "{chosen}".',
      example: 'Argument needs "some X are Y" but you chose "all X are Y"'
    },
  
    // ============================================
    // 4. TOO WEAK
    // ============================================
    too_weak: {
      code: 'too_weak',
      name: 'Too Weak',
      trigger: 'User chose an answer that doesn\'t fully close the gap',
      diagnosis_template: 'This doesn\'t go far enough. The gap requires "{needed}", but this only provides "{chosen}".',
      example: 'Gap needs a direct connection, but answer only suggests possibility'
    },
  
    // ============================================
    // 5. OFF TOPIC
    // ============================================
    off_topic: {
      code: 'off_topic',
      name: 'Off Topic',
      trigger: 'User chose content that doesn\'t relate to the argument\'s core',
      diagnosis_template: 'This doesn\'t touch the argument\'s core issue. The argument is about {topic}, but this discusses {other_topic}.',
      example: 'Argument about cost, answer about quality'
    },
  
    // ============================================
    // 6. SCOPE SHIFT
    // ============================================
    scope_shift: {
      code: 'scope_shift',
      name: 'Scope Shift',
      trigger: 'User confused different scopes (time, place, group, etc.)',
      diagnosis_template: 'The conclusion talks about {scope_1}, but you\'re addressing {scope_2}.',
      example: 'Conclusion about "all employees", answer about "managers only"'
    },
  
    // ============================================
    // 7. NECESSARY VS SUFFICIENT
    // ============================================
    necessary_vs_sufficient: {
      code: 'necessary_vs_sufficient',
      name: 'Necessary vs Sufficient',
      trigger: 'User confused what\'s required vs what\'s enough',
      diagnosis_template: 'Required ≠ Enough. {explanation}',
      example: 'Driver\'s license is necessary to drive legally, but having one doesn\'t mean you\'re currently driving'
    },
  
    // ============================================
    // 8. PART VS WHOLE
    // ============================================
    part_vs_whole: {
      code: 'part_vs_whole',
      name: 'Part vs Whole',
      trigger: 'User assumed what\'s true for parts is true for whole (or vice versa)',
      diagnosis_template: 'True for some ≠ True for all. {part} having property X doesn\'t mean {whole} has property X.',
      example: 'Each brick is light → The wall is light (fallacy)'
    },
  
    // ============================================
    // 9. CORRELATION VS CAUSATION
    // ============================================
    correlation_causation: {
      code: 'correlation_causation',
      name: 'Correlation vs Causation',
      trigger: 'User confused happening together with causing',
      diagnosis_template: 'Happening together ≠ Causing. {A} and {B} correlate, but that doesn\'t mean {A} causes {B}.',
      example: 'Ice cream sales and drowning both increase in summer (both caused by heat)'
    },
  
    // ============================================
    // 10. MISSING LINK
    // ============================================
    missing_link: {
      code: 'missing_link',
      name: 'Missing Link',
      trigger: 'User didn\'t see a hidden assumption connecting premise to conclusion',
      diagnosis_template: 'There\'s a gap you didn\'t see. The argument assumes {hidden_assumption} to connect {premise} to {conclusion}.',
      example: 'Bob is a mechanic + car makes noise → I\'ll owe Bob money (assumes Bob charges for repairs)'
    },
  
    // ============================================
    // 11. KEYWORD MATCH
    // ============================================
    keyword_match: {
      code: 'keyword_match',
      name: 'Keyword Match',
      trigger: 'User matched surface words without checking logical connection',
      diagnosis_template: 'Same word ≠ Same logic. "{keyword}" appears in both, but they\'re discussing different things.',
      example: 'Stimulus mentions "growth", answer mentions "growth" but in different context'
    },
  
    // ============================================
    // 12. EXTREME LANGUAGE
    // ============================================
    extreme_language: {
      code: 'extreme_language',
      name: 'Extreme Language',
      trigger: 'User missed qualifiers like "only", "always", "never", "all"',
      diagnosis_template: 'Watch the extreme words. "{extreme_word}" makes this claim too absolute.',
      example: '"The only way to succeed" vs "One way to succeed"'
    },
  
    // ============================================
    // 13. TEMPORAL CONFUSION
    // ============================================
    temporal_confusion: {
      code: 'temporal_confusion',
      name: 'Temporal Confusion',
      trigger: 'User confused time sequence with causation',
      diagnosis_template: 'Before ≠ Because. {event_1} happened before {event_2}, but that doesn\'t mean it caused {event_2}.',
      example: 'Rooster crows before sunrise, but doesn\'t cause it'
    },
  
  };
  
  // ============================================
  // HELPER: Get error type by code
  // ============================================
  export function getErrorType(code: string): ErrorType | undefined {
    return ERROR_TYPES[code];
  }
  
  // ============================================
  // HELPER: Get all error codes as array
  // ============================================
  export function getErrorCodes(): string[] {
    return Object.keys(ERROR_TYPES);
  }
  
  // ============================================
  // HELPER: Format diagnosis with variables
  // ============================================
  export function formatDiagnosis(code: string, variables: Record<string, string>): string {
    const errorType = ERROR_TYPES[code];
    if (!errorType) return 'Unknown error type';
    
    let diagnosis = errorType.diagnosis_template;
    for (const [key, value] of Object.entries(variables)) {
      diagnosis = diagnosis.replace(`{${key}}`, value);
    }
    return diagnosis;
  }
  
  // ============================================
  // ERROR FAMILIES (for grouping in stats)
  // ============================================
  export const ERROR_FAMILIES = {
    logical_structure: ['direction_reversed', 'necessary_vs_sufficient', 'part_vs_whole'],
    scope_issues: ['scope_shift', 'off_topic', 'wrong_target'],
    strength_issues: ['too_strong', 'too_weak'],
    causal_issues: ['correlation_causation', 'temporal_confusion'],
    surface_matching: ['keyword_match', 'extreme_language'],
    comprehension: ['missing_link'],
  };
  
  export default ERROR_TYPES;