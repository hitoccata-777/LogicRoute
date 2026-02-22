// File: src/lib/diagramTemplates.ts
// ASCII Diagram Templates for LogiClue

export const DIAGRAM_TEMPLATES = {
  
    // ============================================
    // RIVER CROSSING METHOD (Single Bridge)
    // ============================================
    river_crossing: `
  ┌─────────────────┐                      ┌─────────────────┐
  │    X-BANK       │                      │    Y-BANK       │
  │   (Premise)     │                      │  (Conclusion)   │
  │                 │         GAP          │                 │
  │  {premise}      │ ═══════════════════> │  {conclusion}   │
  │                 │    ↑                 │                 │
  └─────────────────┘    │                 └─────────────────┘
                         │
                   {gap_description}
  `,
  
    // ============================================
    // RIVER CROSSING (Dual Bridge - Competing)
    // ============================================
    river_dual_bridge: `
                      ┌─── Bridge A: {explanation_1} ───┐
                      │                                  │
  {observation} ──────┤                                  ├────── {conclusion}
                      │                                  │
                      └─── Bridge B: {explanation_2} ───┘
                                ↑
                      Which bridge is {attacked_or_supported}?
  `,
  
    // ============================================
    // RIVER CROSSING (Multi-Bridge)
    // ============================================
    river_multi_bridge: `
                      ┌─── Support 1: {support_1} ───┐
                      │                               │
  {evidence} ─────────┼─── Support 2: {support_2} ───┼────── {conclusion}
                      │                               │
                      └─── Support 3: {support_3} ───┘
  `,
  
    // ============================================
    // VENN DIAGRAM (Set Relationships)
    // ============================================
    venn_all: `
  All {A} are {B}:
  ┌─────────────────┐
  │        B        │
  │    ┌───────┐    │
  │    │   A   │    │
  │    └───────┘    │
  └─────────────────┘
  `,
  
    venn_some: `
  Some {A} are {B}:
      ┌───────┐ ┌───────┐
      │   A   │ │   B   │
      │     ╲ │ │ ╱     │
      │      ╲│ │╱      │
      │       ╲│╱       │
      └───────┴─┴───────┘
           overlap
  `,
  
    venn_none: `
  No {A} are {B}:
  ┌───────┐     ┌───────┐
  │   A   │     │   B   │
  │       │     │       │
  └───────┘     └───────┘
     (no overlap)
  `,
  
    venn_most: `
  Most {A} are {B}:
  ┌─────────────────┐
  │        B        │
  │    ┌───────┐    │
  │    │  A    │←───│── most of A is inside B
  │    │   ····│    │   but some A outside
  └────│───────│────┘
       └───────┘
  `,
  
    // ============================================
    // CONDITIONAL CHAIN (Substitution)
    // ============================================
    conditional_chain: `
  Given Chain:
  {condition_1} → {condition_2} → {condition_3}
  
  Contrapositive:
  ¬{condition_3} → ¬{condition_2} → ¬{condition_1}
  
  Therefore:
  {condition_1} → {condition_3}  ✓
  `,
  
    // ============================================
    // PARALLEL BRIDGE (Reconcile/Paradox)
    // ============================================
    parallel_bridge: `
  Fact 1: {fact_1}          Fact 2: {fact_2}
          │                         │
          ↓                         ↓
          └────────────┬────────────┘
                       ↓
           ┌───────────────────────┐
           │  {reconciling_factor} │
           │  explains both facts  │
           └───────────────────────┘
  `,
  
    // ============================================
    // DISPUTE LOCATE (Point at Issue)
    // ============================================
    dispute_locate: `
  ┌─────────────────────────────────────────────┐
  │               POINT AT ISSUE                │
  ├─────────────────┬───────────────────────────┤
  │   Speaker A     │      Speaker B            │
  ├─────────────────┼───────────────────────────┤
  │ Believes: {a_view}  │ Believes: {b_view}    │
  ├─────────────────┼───────────────────────────┤
  │       ✓         │         ✗                 │
  │   (agrees)      │    (disagrees)            │
  └─────────────────┴───────────────────────────┘
          ↓
    The disagreement is about: {dispute_point}
  `,
  
    // ============================================
    // ARGUMENT CHAIN (Role/Method of Reasoning)
    // ============================================
    argument_chain: `
  ① {statement_1}  [role: {role_1}]
          ↓
  ② {statement_2}  [role: {role_2}]
          ↓
  ③ {statement_3}  [role: {role_3}]
          ↓
  ④ {statement_4}  [role: {role_4}]
  
  Legend:
  P = Premise
  IC = Intermediate Conclusion  
  MC = Main Conclusion
  E = Evidence
  `,
  
    // ============================================
    // FORMULA METHOD (Parallel Reasoning)
    // ============================================
    formula: `
  Original Argument Structure:
  {premise_type_1} + {premise_type_2} → {conclusion_type}
  
  Abstract Form:
  {abstract_formula}
  
  Match in Answer:
  Option {letter}: 
  {matched_premise_1} + {matched_premise_2} → {matched_conclusion}
  `,
  
    // ============================================
    // NUMBER LINE (Degree/Quantity)
    // ============================================
    number_visual: `
  {low_end} ←─────────────────────────────→ {high_end}
            │                             │
            │    ┌───{range}───┐          │
            │    │             │          │
            ▼    ▼             ▼          ▼
  ──────────┼────┼─────────────┼──────────┼──────────
            {point_1}          {point_2}
  `,
  
    // ============================================
    // EXTREME TEST
    // ============================================
    extreme_test: `
  Test: If we assume the EXTREME case...
  
  Assumption being tested: {assumption}
  
  Extreme scenario: {extreme_case}
  
  Result:
  ├─ Argument still works? → Assumption NOT necessary
  └─ Argument collapses?   → Assumption IS necessary ✓
  `,
  
    // ============================================
    // HIGHLIGHT METHOD (Fallback)
    // ============================================
    highlight: `
  Question asks: {question_type}
  
  Key elements to match:
  • {element_1}
  • {element_2}  
  • {element_3}
  
  Scan each option for these elements:
  A: {match_status_a}
  B: {match_status_b}
  C: {match_status_c}
  D: {match_status_d}
  E: {match_status_e}
  `,
  
  };
  
  // ============================================
  // HELPER: Get template by method name
  // ============================================
  export function getDiagramTemplate(method: string): string {
    return DIAGRAM_TEMPLATES[method as keyof typeof DIAGRAM_TEMPLATES] || DIAGRAM_TEMPLATES.highlight;
  }
  
  // ============================================
  // HELPER: Method descriptions for prompt
  // ============================================
  export const METHOD_DESCRIPTIONS: Record<string, string> = {
    'river_crossing': 'River Crossing: X-bank (premise) → Bridge (reasoning) → Y-bank (conclusion), find the Gap',
    'river_dual_bridge': 'Dual Bridge: Two competing explanations, find which one is attacked/supported',
    'river_multi_bridge': 'Multi-Bridge: Multiple supports for conclusion, find which is targeted',
    'venn': 'Venn Diagram: Draw circles to show set relationships (all/some/none/most)',
    'conditional_chain': 'Conditional Chain: A→B, B→C, therefore A→C (with contrapositive)',
    'parallel_bridge': 'Parallel Bridge: Two facts side by side, find common explanation',
    'dispute_locate': 'Dispute Locate: Two speakers, find specific point of disagreement',
    'argument_chain': 'Argument Chain: ①②③④ with roles (P/IC/MC/E)',
    'formula': 'Formula Method: Abstract structure, match identical pattern',
    'number_visual': 'Number/Visual: Lines and ranges for quantity comparisons',
    'extreme_test': 'Extreme Test: Assume extreme case, test if assumption necessary',
    'highlight': 'Highlight: Scan options against question requirements (fallback method)',
  };
  
  export default DIAGRAM_TEMPLATES;