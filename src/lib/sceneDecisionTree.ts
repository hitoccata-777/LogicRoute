// File: src/lib/sceneDecisionTree.ts
// Scene Recognition Decision Tree with Detailed Trigger Conditions

export const SCENE_DECISION_TREE = `
## Scene Recognition Decision Tree

Based on stimulus features, select the appropriate method:

### PRIMARY DECISION: What is the stimulus structure?

\`\`\`
STEP 1: Check for argument chain
─────────────────────────────────
Does the stimulus have:
  • A conclusion being argued for?
  • Evidence/premises supporting it?
  • A gap between evidence and conclusion?

YES → Go to STEP 2 (River Crossing family)
NO  → Go to STEP 3 (Other methods)


STEP 2: River Crossing Family
─────────────────────────────
├─ Single clear chain (premise → conclusion)?
│  └─ → river_crossing
│     Trigger: One argument line, one gap to find
│
├─ Two competing explanations for same observation?
│  └─ → river_dual_bridge
│     Trigger: "Some say X, others say Y" or
│              "Explanation A vs Explanation B"
│
├─ Multiple independent supports for conclusion?
│  └─ → river_multi_bridge
│     Trigger: "Evidence 1, and also Evidence 2, therefore..."
│
└─ Gap location unclear, need to map full chain first?
   └─ → river_crossing (but draw complete chain first)
   Trigger: Complex argument with multiple steps


STEP 3: Non-River Methods
─────────────────────────
├─ Two arguments need structural matching?
│  └─ → formula
│     Trigger: "parallel reasoning" or "similar pattern"
│
├─ Need to identify role of specific statement?
│  └─ → argument_chain
│     Trigger: "role of the highlighted statement" or
│              "method of reasoning"
│
├─ Derive conclusion from premises (MBT/MSS)?
│  ├─ Equivalence relationships (A=B, B=C)?
│  │  └─ → conditional_chain
│  │     Trigger: "If...then" chains, substitution possible
│  │
│  ├─ Set relationships (all/some/most/none)?
│  │  └─ → venn
│  │     Trigger: Quantifiers like "all X are Y", "some X are Y"
│  │
│  └─ Attribute combinations?
│     └─ → lego
│        Trigger: "X that are also Y and Z"
│
├─ Two contradictory facts need reconciliation?
│  └─ → parallel_bridge
│     Trigger: "explain/resolve/reconcile" + apparent contradiction
│
├─ Two speakers with opposing views?
│  └─ → dispute_locate
│     Trigger: Speaker A says X, Speaker B says Y
│
├─ Numbers, degrees, or ranges to compare?
│  └─ → number_visual
│     Trigger: Percentages, quantities, "more than", "at least"
│
└─ Cannot enumerate assumptions / none of above?
   └─ → highlight
      Trigger: Fallback when structure unclear
\`\`\`

### QUESTION TYPE → METHOD MAPPING (Default)

| Question Type | Primary Method | Fallback |
|---------------|----------------|----------|
| Weaken | river_crossing | highlight |
| Strengthen | river_crossing | highlight |
| Necessary Assumption | river_crossing | highlight |
| Sufficient Assumption | river_crossing | highlight |
| Flaw | river_crossing | highlight |
| Must Be True | conditional_chain / venn | highlight |
| Most Strongly Supported | conditional_chain / venn | highlight |
| Parallel Reasoning | formula | - |
| Parallel Flaw | formula | - |
| Resolve/Explain | parallel_bridge | - |
| Point at Issue | dispute_locate | - |
| Method of Reasoning | argument_chain | - |
| Role | argument_chain | - |
| Main Conclusion | argument_chain | - |

### OVERRIDE RULES

Even if question type suggests Method A, switch to Method B if:

1. **Stimulus has quantifiers (all/some/most/none)**
   → Consider venn even for Weaken/Strengthen

2. **Stimulus has conditional chains (if→then)**
   → Consider conditional_chain even for Weaken/Strengthen

3. **Cannot identify clear gap after 30 seconds**
   → Switch to highlight method

4. **Two explanations compete**
   → Use river_dual_bridge regardless of question type
`;

// ============================================
// METHOD SELECTION RULES
// ============================================
export interface MethodRule {
  method: string;
  triggers: string[];
  priority: number; // Higher = check first
}

export const METHOD_SELECTION_RULES: MethodRule[] = [
  {
    method: 'dispute_locate',
    triggers: [
      'two speakers with names',
      'A says... B says...',
      'point at issue',
      'disagree about'
    ],
    priority: 100
  },
  {
    method: 'formula',
    triggers: [
      'parallel reasoning',
      'parallel flaw',
      'similar pattern of reasoning',
      'most similar in its reasoning'
    ],
    priority: 95
  },
  {
    method: 'argument_chain',
    triggers: [
      'role of the statement',
      'method of reasoning',
      'argumentative strategy',
      'proceeds by',
      'main conclusion'
    ],
    priority: 90
  },
  {
    method: 'parallel_bridge',
    triggers: [
      'resolve',
      'reconcile',
      'explain the discrepancy',
      'apparent contradiction',
      'surprising finding'
    ],
    priority: 85
  },
  {
    method: 'venn',
    triggers: [
      'all X are Y',
      'some X are Y',
      'no X are Y',
      'most X are Y',
      'few X are Y'
    ],
    priority: 80
  },
  {
    method: 'conditional_chain',
    triggers: [
      'if...then',
      'only if',
      'unless',
      'whenever',
      'required for',
      'sufficient for'
    ],
    priority: 75
  },
  {
    method: 'river_dual_bridge',
    triggers: [
      'two explanations',
      'alternatively',
      'another possibility',
      'some argue... others argue'
    ],
    priority: 70
  },
  {
    method: 'river_crossing',
    triggers: [
      'weaken',
      'strengthen',
      'assumption required',
      'assumption sufficient',
      'flaw',
      'vulnerable'
    ],
    priority: 50
  },
  {
    method: 'highlight',
    triggers: [
      'default fallback'
    ],
    priority: 0
  }
];

// ============================================
// HELPER: Select method based on question stem and stimulus
// ============================================
export function selectMethod(questionStem: string, stimulus: string): string {
  const combinedText = (questionStem + ' ' + stimulus).toLowerCase();
  
  // Sort by priority (highest first)
  const sortedRules = [...METHOD_SELECTION_RULES].sort((a, b) => b.priority - a.priority);
  
  for (const rule of sortedRules) {
    for (const trigger of rule.triggers) {
      if (combinedText.includes(trigger.toLowerCase())) {
        return rule.method;
      }
    }
  }
  
  return 'highlight'; // Default fallback
}

export default SCENE_DECISION_TREE;