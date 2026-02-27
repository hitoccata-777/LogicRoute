// File: src/types/analysis.ts
// Shared type definitions for LogiClue analysis results
// Used by BOTH route.ts (API output) and result page (frontend rendering)
// Change here → TypeScript catches mismatches on both sides

// ============================================
// Wrong Option Analysis (simplified single-level)
// ============================================
export interface WrongOptionAnalysis {
    label: string;             // A-E
    claims: string;            // What this option asserts (one sentence)
    why_wrong: string;         // 1-2 sentences: factual error referencing argument chain
    match_trigger: string;     // 2-5 word tag: what made it feel right (for clustering)
  }
  
  // ============================================
  // Correct Option
  // ============================================
  export interface CorrectOption {
    label: string;  // A-E
    reason: string;  // Echoes core_judgment
  }
  
  // ============================================
  // Narrative (3 lines for user-facing display)
  // ============================================
  export interface Narrative {
    trap: string;       // What the option did (pure objective)
    action: string;     // What the user's thinking did (pure subjective)
    next_time: string;  // One actionable sentence
  }
  
  // ============================================
  // Structure (River Crossing extraction)
  // ============================================
  export interface ArgumentStructure {
    x: string;               // X-Bank (premise/evidence)
    y: string;               // Y-Bank (conclusion)
    bridge: string;          // Bridge (argument connecting X to Y)
    gap: string | null;      // Gap (missing link, if any)
    // For debate-type stimuli, LLM may output additional keys:
    [key: string]: string | null | undefined;
  }
  
  // ============================================
  // Full Analysis Result (what the API returns)
  // ============================================
  export interface AnalysisResult {
    question_id: string;
    stimulus_type: 'argument' | 'debate' | 'premise_set' | 'paradox';
    question_family: string;
  
    structure: ArgumentStructure;
    faithfulness_check: string;  // "pass" or "fail + explanation"
    core_judgment: string;       // One sentence, ≤25 words
  
    method: string;
    diagram: string;             // ASCII diagram inside JSON
  
    correct_option: CorrectOption;
    isCorrect: boolean;
  
    wrong_options: WrongOptionAnalysis[];
  
    narrative: Narrative;
  
    // Preserved for backward compatibility / attempt saving
    userChoice?: string;
    questionId?: string;
  }