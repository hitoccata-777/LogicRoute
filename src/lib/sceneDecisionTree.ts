export const SCENE_DECISION_TREE = `
## 场景识别决策树

根据 stimulus 的特征，选择合适的工具：

题目特征是什么？
│
├─ 有一条明确的论证链？
│  └─ 需要评价这条链的某方面？
│     └─ → 过河法 (river_crossing)
│        ├─ 有两条竞争的链？→ 双桥变体 (river_dual_bridge)
│        ├─ 中间结论有多种解释？→ 分岔变体 (river_fork)
│        └─ Gap位置不确定？→ 先画完整链条
│
├─ 需要匹配两个论证的结构？
│  └─ → 公式推导法 (formula)
│
├─ 需要定位某句话的角色？
│  └─ → 论证链条法 (argument_chain)
│        用 ①②③④ + 箭头标注
│
├─ 需要从前提推结论？
│  ├─ 概念之间有等价/蕴含关系？
│  │  └─ → 等量代换法 (substitution)
│  ├─ 涉及属性组合（存在某些...同时有...）？
│  │  └─ → 乐高积木法 (lego)
│  └─ 涉及集合关系（大多数/有些/所有）？
│     └─ → 韦恩图法 (venn)
│
├─ 有两个结构需要对比？
│  ├─ 两个看似矛盾的事实？
│  │  └─ → 平行桥法 (parallel_bridge) - 找公约数
│  ├─ 两组对比结果需要解释？
│  │  └─ → 平行桥法 (parallel_bridge) - 对比结构
│  └─ 两人观点需要找分歧？
│     └─ → 分歧定位法 (dispute_locate)
│
├─ 涉及具体和抽象的转换？
│  └─ → 抽象映射法 (abstract_mapping)
│
├─ 涉及数字、程度、范围比较？
│  └─ → 数字/图形可视化 (number_visual)
│
├─ 需要检验某解释是否成立？
│  └─ → 极端假设法 (extreme_test)
│
└─ 无法用上述工具？
   └─ → 高亮法 (highlight)
         扫描选项，用问题去匹配
`;

export const METHOD_DESCRIPTIONS: Record<string, string> = {
  'river_crossing': '过河法：X岸(前提) → 桥(推理) → Y岸(结论)，找Gap',
  'river_dual_bridge': '双桥变体：两条竞争的论证链，找哪条被攻击/支持',
  'river_fork': '分岔变体：中间结论有多种解释，找哪种被攻击',
  'highlight': '高亮法：无法穷举假设时，用问题扫描选项匹配',
  'lego': '乐高积木法：属性A + 属性B + 属性C 的组合推理',
  'substitution': '等量代换法：A=B, B=C → A=C',
  'venn': '韦恩图法：画圈表示集合关系（所有/有些/没有）',
  'formula': '公式推导法：抽象出结构 P→Q，匹配相同结构',
  'abstract_mapping': '抽象映射法：具体事例 ↔ 抽象原则',
  'parallel_bridge': '平行桥法：两个事实/结果并列，找共同解释',
  'dispute_locate': '分歧定位法：两人观点，找具体分歧点',
  'argument_chain': '论证链条法：①前提 → ②中间结论 → ③最终结论',
  'number_visual': '数字/图形可视化：用线段、图形直观展示数量关系',
  'extreme_test': '极端假设法：假设极端情况，检验解释是否成立',
};