export const SCENE_DECISION_TREE = `
## Scene Recognition Decision Tree

Based on stimulus features, select the appropriate method:

What are the stimulus characteristics?
│
├─ Has a clear argument chain?
│  └─ Need to evaluate some aspect of this chain?
│     └─ → River Crossing (river_crossing)
│        ├─ Two competing chains? → Dual Bridge variant (river_dual_bridge)
│        ├─ Intermediate conclusion has multiple interpretations? → Fork variant (river_fork)
│        └─ Gap location uncertain? → Draw complete chain first
│
├─ Need to match structure of two arguments?
│  └─ → Formula Method (formula)
│
├─ Need to identify the role of a specific statement?
│  └─ → Argument Chain (argument_chain)
│        Use ①②③④ + arrows to label
│
├─ Need to derive conclusion from premises?
│  ├─ Concepts have equivalence/implication relationships?
│  │  └─ → Substitution Method (substitution)
│  ├─ Involves attribute combinations (some X that are also Y)?
│  │  └─ → Lego Method (lego)
│  └─ Involves set relationships (most/some/all)?
│     └─ → Venn Diagram (venn)
│
├─ Two structures need comparison?
│  ├─ Two seemingly contradictory facts?
│  │  └─ → Parallel Bridge (parallel_bridge) - find common denominator
│  ├─ Two contrasting results need explanation?
│  │  └─ → Parallel Bridge (parallel_bridge) - contrast structure
│  └─ Two speakers' views need disagreement identified?
│     └─ → Dispute Locate (dispute_locate)
│
├─ Involves concrete ↔ abstract conversion?
│  └─ → Abstract Mapping (abstract_mapping)
│
├─ Involves numbers, degrees, or range comparisons?
│  └─ → Number/Visual Method (number_visual)
│
├─ Need to test if an explanation holds?
│  └─ → Extreme Test (extreme_test)
│
└─ None of the above apply?
   └─ → Highlight Method (highlight)
         Scan options, match against the question
`;

export const METHOD_DESCRIPTIONS: Record<string, string> = {
  'river_crossing': 'River Crossing: X-bank (premise) → Bridge (reasoning) → Y-bank (conclusion), find the Gap',
  'river_dual_bridge': 'Dual Bridge: Two competing argument chains, find which one is attacked/supported',
  'river_fork': 'Fork Variant: Intermediate conclusion has multiple interpretations, find which is attacked',
  'highlight': 'Highlight: When assumptions cannot be exhaustively listed, scan options to match the question',
  'lego': 'Lego Method: Attribute A + Attribute B + Attribute C combination reasoning',
  'substitution': 'Substitution: A=B, B=C → A=C',
  'venn': 'Venn Diagram: Draw circles to show set relationships (all/some/none)',
  'formula': 'Formula Method: Abstract the structure to P→Q, match identical structures',
  'abstract_mapping': 'Abstract Mapping: Concrete example ↔ Abstract principle',
  'parallel_bridge': 'Parallel Bridge: Two facts/results side by side, find common explanation',
  'dispute_locate': 'Dispute Locate: Two speakers\' views, find specific point of disagreement',
  'argument_chain': 'Argument Chain: ①Premise → ②Intermediate conclusion → ③Final conclusion',
  'number_visual': 'Number/Visual: Use lines and shapes to visually display quantitative relationships',
  'extreme_test': 'Extreme Test: Assume extreme cases, test if explanation holds',
};