export type QuestionType = 
  | 'weaken'
  | 'strengthen'
  | 'assumption_necessary'
  | 'assumption_sufficient'
  | 'flaw'
  | 'principle_apply'
  | 'principle_justify'
  | 'evaluate'
  | 'must_be_true'
  | 'most_supported'
  | 'parallel'
  | 'parallel_flaw'
  | 'point_at_issue'
  | 'resolve'
  | 'main_conclusion'
  | 'role'
  | 'method_of_reasoning'
  | 'except'
  | 'unknown';

export type QuestionFamily = 
  | 'river_crossing'      // 过河法家族
  | 'inference'           // 推理法家族
  | 'structure_matching'  // 结构匹配家族
  | 'dual_structure'      // 双结构家族
  | 'argument_structure'; // 论证结构家族

export type Method = 
  | 'river_crossing'      // 过河法
  | 'river_dual_bridge'   // 双桥变体
  | 'river_fork'          // 分岔变体
  | 'highlight'           // 高亮法
  | 'lego'                // 乐高积木法
  | 'substitution'        // 等量代换法
  | 'venn'                // 韦恩图法
  | 'formula'             // 公式推导法
  | 'abstract_mapping'    // 抽象映射法
  | 'parallel_bridge'     // 平行桥法
  | 'dispute_locate'      // 分歧定位法
  | 'argument_chain'      // 论证链条法
  | 'number_visual'       // 数字/图形可视化（原数字线法）
  | 'extreme_test';       // 极端假设法

// 题型识别规则（按优先级排序）
const CLASSIFICATION_RULES: Array<{ type: QuestionType; pattern: RegExp }> = [
  // Parallel Flaw（必须在 parallel 和 flaw 之前）
  { 
    type: 'parallel_flaw', 
    pattern: /(flaw|flawed).*(similar|resembles|parallel|like|analogy)|(similar|resembles|parallel|like|analogy).*(flaw|flawed)|has a flawed pattern/i 
  },
  
  // Weaken
  { 
    type: 'weaken', 
    pattern: /weaken|undermine|call[s]? into question|cast[s]? (doubt|most doubt)|evidence against|damage|argues against|vulnerable to.*(criticism|objection|grounds)|criticism of|strongest (criticism|challenge|objection)|challenge to|counter|invalidate|cancel out|casts the most doubt|at odds with|refut|seriously (calls|limit)|argues.* against|misleading/i 
  },
  
  // Strengthen
  { 
    type: 'strengthen', 
    pattern: /strengthen|(?<!strongly )support[s]? (the|for|the claim)|additional support|helps? (to )?(justify|account)|justification for|provides?.*(support|evidence|basis)|best (evidence|reason)|defense of|most support|(?<!\w)supports the|account for/i 
  },
  
  // Necessary Assumption
  { 
    type: 'assumption_necessary', 
    pattern: /assumption.*(depends|requires|relies|required|that would permit|made|on which|of the argument)|depends on.*(assuming|assumption)|assumes|relies on|requires.*(assumption|assuming)|argument (depends|makes.*assumption|rely)|is assumed|presupposes|must.*assume|based on.*(assumption|which one)|permit the conclusion|logically committed|committed to|assumption necessary|assumption that the argument/i 
  },
  
  // Sufficient Assumption
  { 
    type: 'assumption_sufficient', 
    pattern: /if (assumed|true).*(enables|allows|properly drawn)|follows logically if.*(assumed|completes)|enables.*conclusion|logically completes|completes the (argument|passage)|added to the premises|allow.*conclusion.*properly|would do most to justify|logical completion|argument to be logically correct|properly drawn.*assumed|would have to be (true|made)|must.*assumed/i 
  },
  
  // Flaw
  { 
    type: 'flaw', 
    pattern: /\bflaw\b|error in.*(reasoning|argument)|questionable|describes an error|error of reasoning|commits.*(error|fallacy)|fails to (recognize|address)|problem with|errors in reasoning|reasoning error|weakness|mistakes? in|reasoning flaws?/i 
  },
  
  // Must Be True（包含 must be false）
  { 
    type: 'must_be_true', 
    pattern: /must (be true|be false|also be true|on the basis)|properly (inferred|concluded)|logically (follows|inferred|concluded)|can be (properly )?(inferred|concluded|drawn)|follows logically|CANNOT be true|cannot be true|can be expected|LEAST compatible|conflicts with|would have to be true|have to be true|validly drawn/i 
  },
  
  // Most Supported / Inference
  { 
    type: 'most_supported', 
    pattern: /most strongly supported|strongly supported|most supported|support.*(inference|which one)|best (illustrated|supported)|most justifiably|used as part of an argument|reasonably (supported|concluded|inferred)|proper inference|best supported|most reasonably be concluded|grounds for accepting/i 
  },
  
  // Parallel（不含flaw）
  { 
    type: 'parallel', 
    pattern: /most similar|similar.*(reasoning|pattern|argument)|resembles|parallel|LEAST similar|logical structure.*(like|most like)|has a logical structure|most nearly similar/i 
  },
  
  // Main Conclusion
  { 
    type: 'main_conclusion', 
    pattern: /main (conclusion|point)|overall conclusion|conclusion (drawn|of the argument|is best expressed)|expresses the conclusion|lead to.*(conclusion|conclusions)|best expresses the point|most accurately expresses.*conclusion/i 
  },
  
  // Role
  { 
    type: 'role', 
    pattern: /\brole\b|\bfunction\b|plays which one|serves (to|which)|figures in.*(which|how)|related to.*argument|used in.*(which|how)|uses which|characterizes.*response|misinterpreting|misinterpret/i 
  },
  
  // Method of Reasoning
  { 
    type: 'method_of_reasoning', 
    pattern: /method|technique|strategy|responds? to|proceeds by|does which one.*(dealing|in)|strategies of argumentation|describes.*argument|decision process|employs which|argumentative strateg/i 
  },
  
  // Resolve / Explain
  { 
    type: 'resolve', 
    pattern: /resolve|reconcile|paradox|discrepancy|apparent conflict|explanation|desired effect|incomplete|difference in/i 
  },
  
  // Point at Issue
  { 
    type: 'point_at_issue', 
    pattern: /disagree|dispute|point at issue|committed to (disagreeing|agreeing)|what is at issue/i 
  },
  
  // Principle Apply（包含 example/illustration）
  { 
    type: 'principle_apply', 
    pattern: /conform[s]? (to|most closely)|illustrate[s]?|exhibit[s]?|consistent with.*(principle|proposition)|application of|principle underlying|principles forms|most usefully invoked|principles underlies|judgments? conforms?|most closely (to|conforms)|most closely accords|violates|best illustration|example of.*described|exemplified/i 
  },
  
  // Principle Justify
  { 
    type: 'principle_justify', 
    pattern: /principle.*(justify|support|help|valid|established|accepted|provide)|justify.*(reasoning|argument)|strongest justification|logical basis|general principle|could underlie/i 
  },
  
  // Evaluate
  { 
    type: 'evaluate', 
    pattern: /evaluate|useful to know|would be most helpful|most strongly indicates|contribute.*evaluation|reconsider|most (help|important|relevant).*(evaluat|know)|clarification.*most important/i 
  },
  
  // EXCEPT
  { 
    type: 'except', 
    pattern: /\bEXCEPT\b/i 
  },
];

// 题型 → 家族映射
const TYPE_TO_FAMILY: Record<QuestionType, QuestionFamily> = {
  'weaken': 'river_crossing',
  'strengthen': 'river_crossing',
  'assumption_necessary': 'river_crossing',
  'assumption_sufficient': 'river_crossing',
  'flaw': 'river_crossing',
  'principle_apply': 'river_crossing',
  'principle_justify': 'river_crossing',
  'evaluate': 'river_crossing',
  
  'must_be_true': 'inference',
  'most_supported': 'inference',
  
  'parallel': 'structure_matching',
  'parallel_flaw': 'structure_matching',
  
  'point_at_issue': 'dual_structure',
  'resolve': 'dual_structure',
  
  'main_conclusion': 'argument_structure',
  'role': 'argument_structure',
  'method_of_reasoning': 'argument_structure',
  
  'except': 'river_crossing', // EXCEPT题根据具体内容判断
  'unknown': 'river_crossing', // 默认
};

// 家族 → 主要工具映射（场景识别会进一步细化）
const FAMILY_TO_PRIMARY_METHODS: Record<QuestionFamily, Method[]> = {
  'river_crossing': ['river_crossing', 'river_dual_bridge', 'river_fork'],
  'inference': ['highlight', 'lego', 'venn', 'substitution'],
  'structure_matching': ['formula', 'abstract_mapping', 'venn'],
  'dual_structure': ['parallel_bridge', 'dispute_locate'],
  'argument_structure': ['argument_chain'],
};

/**
 * 识别题型
 */
export function classifyQuestionType(questionStem: string): QuestionType {
  const stem = questionStem.trim();
  
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(stem)) {
      return rule.type;
    }
  }
  
  return 'unknown';
}

/**
 * 获取题型家族
 */
export function getQuestionFamily(type: QuestionType): QuestionFamily {
  return TYPE_TO_FAMILY[type] || 'river_crossing';
}

/**
 * 获取主要工具列表
 */
export function getPrimaryMethods(family: QuestionFamily): Method[] {
  return FAMILY_TO_PRIMARY_METHODS[family] || ['river_crossing'];
}

/**
 * 一站式分类
 */
export function classifyQuestion(questionStem: string): {
  type: QuestionType;
  family: QuestionFamily;
  primaryMethods: Method[];
} {
  const type = classifyQuestionType(questionStem);
  const family = getQuestionFamily(type);
  const primaryMethods = getPrimaryMethods(family);
  
  return { type, family, primaryMethods };
}   