## ✅ Triage summary (short)
- Found 28 issues (7 errors, 21 warnings) across several files.  
- Highest priority: **ARIA accessibility errors** in HistoryTabsIsland.tsx and a missing import (`ms`) in VisualOverlaysIsland.tsx.  
- Suggested orchestrator: **optimize-expert** to coordinate; first subagent: **frontend-design-auditor** (accessibility + island rules).

---

## 📄 Machine-readable report (XML)
<?xml version="1.0" encoding="utf-8"?>
<triageReport generatedAt="2026-01-31T00:00:00Z" repository="paperless-ai">
  <summary>
    <totalIssues>28</totalIssues>
    <errors>7</errors>
    <warnings>21</warnings>
  </summary>

  <!-- File: HistoryTabsIsland.tsx -->
  <file path="src/islands/HistoryTabsIsland.tsx" urgency="high">
    <issue id="ht-aria-1">
      <severity>error</severity>
      <code>axe/aria</code>
      <line>243</line>
      <message>ARIA attributes must conform to valid values: Invalid ARIA attribute value: aria-selected="{expression}"</message>
      <urgency>critical</urgency>
      <recommendedSkill>frontend-design-auditor</recommendedSkill>
      <fixSummary>Replace string-wrapped ARIA expressions (aria-selected="{expr}") with proper JSX expressions (aria-selected={expr? 'true':'false'} or boolean). Add unit/accessibility tests.</fixSummary>
      <tests>Unit: tsx assertions; Accessibility: axe/Playwright check for correct aria attributes</tests>
      <docsRef>docs/FRONTEND_ARCHITECTURE.md, docs/FRONTEND_SELF_GUIDING_UX.md</docsRef>
    </issue>
    <issue id="ht-aria-2">
      <severity>error</severity>
      <code>axe/aria</code>
      <line>263</line>
      <message>ARIA attributes must conform to valid values: Invalid ARIA attribute value: aria-selected="{expression}"</message>
      <urgency>critical</urgency>
      <recommendedSkill>frontend-design-auditor</recommendedSkill>
      <fixSummary>Same as ht-aria-1.</fixSummary>
    </issue>
    <issue id="ht-aria-3">
      <severity>error</severity>
      <code>axe/aria</code>
      <line>283</line>
      <message>ARIA attributes must conform to valid values: Invalid ARIA attribute value: aria-selected="{expression}"</message>
      <urgency>critical</urgency>
      <recommendedSkill>frontend-design-auditor</recommendedSkill>
      <fixSummary>Same as ht-aria-1.</fixSummary>
    </issue>
    <issue id="ht-aria-hidden-1">
      <severity>error</severity>
      <code>axe/aria</code>
      <line>338</line>
      <message>ARIA attributes must conform to valid values: Invalid ARIA attribute value: aria-hidden="{expression}"</message>
      <urgency>critical</urgency>
      <recommendedSkill>frontend-design-auditor</recommendedSkill>
      <fixSummary>Use proper boolean expression (aria-hidden={condition}) and ensure value is "true" or "false".</fixSummary>
    </issue>
    <issue id="ht-unused-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-explicit-any</code>
      <line>45</line>
      <message>Unexpected any. Specify a different type.</message>
      <urgency>medium</urgency>
      <recommendedSkill>frontend-design-implementer</recommendedSkill>
      <fixSummary>Replace `any` with concrete interface/type or a narrower generic; add tests to cover shape.</fixSummary>
    </issue>
    <issue id="ht-unused-2">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>194</line>
      <message>'correspondentId' is assigned a value but never used.</message>
      <urgency>low</urgency>
      <recommendedSkill>frontend-design-implementer</recommendedSkill>
      <fixSummary>Remove variable or prefix with underscore to acknowledge intentionally unused (_correspondentId) and update types if necessary.</fixSummary>
    </issue>
  </file>

  <!-- File: VisualOverlaysIsland.tsx -->
  <file path="src/islands/VisualOverlaysIsland.tsx" urgency="high">
    <issue id="vo-ms-1">
      <severity>error</severity>
      <code>TS2304 / no-undef</code>
      <line>43</line>
      <message>Cannot find name 'ms' / 'ms' is not defined.</message>
      <urgency>high</urgency>
      <recommendedSkill>frontend-design-implementer</recommendedSkill>
      <fixSummary>Import `ms` (e.g., import ms from 'ms') or replace with explicit numeric durations. Ensure dependency (package 'ms') is in package.json or use built-in utilities.</fixSummary>
      <tests>Type-check (tsc) and runtime smoke test for overlay durations</tests>
      <docsRef>package.json, docs/FRONTEND_ARCHITECTURE.md</docsRef>
    </issue>
  </file>

  <!-- File: runtime.browser.tsx -->
  <file path="src/islands/runtime.browser.tsx" urgency="medium">
    <issue id="rt-unused-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>2</line>
      <message>'ComponentType' is defined but never used.</message>
      <urgency>low</urgency>
      <recommendedSkill>frontend-design-implementer</recommendedSkill>
      <fixSummary>Remove unused import or use typed ComponentType in signature.</fixSummary>
    </issue>
    <issue id="rt-any-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-explicit-any</code>
      <line>33</line>
      <message>Unexpected any. Specify a different type.</message>
      <urgency>medium</urgency>
      <recommendedSkill>frontend-design-implementer</recommendedSkill>
      <fixSummary>Replace `any` with proper types or generics; add tests for island registration behavior.</fixSummary>
    </issue>
    <issue id="rt-any-2">
      <severity>warning</severity>
      <code>@typescript-eslint/no-explicit-any</code>
      <lines>68,113,114,121</lines>
      <message>Multiple uses of `any` detected.</message>
      <urgency>medium</urgency>
      <recommendedSkill>frontend-design-implementer</recommendedSkill>
      <fixSummary>Introduce typed interfaces and remove `any` usages.</fixSummary>
    </issue>
  </file>

  <!-- Misc islands: unused/any -->
  <file path="src/islands/AIProviderIsland.tsx" urgency="medium">
    <issue id="ai-unused-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <lines>38-54,133</lines>
      <message>Multiple 'set*' hooks and param 'e' are declared but never used.</message>
      <urgency>medium</urgency>
      <recommendedSkill>frontend-design-implementer</recommendedSkill>
      <fixSummary>Remove or use state setters; prefix unused args with underscore. Add unit tests around provider behavior.</fixSummary>
    </issue>
  </file>

  <file path="src/islands/ExpertModelsIsland.tsx" urgency="low">
    <issue id="em-useRef-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>2</line>
      <message>'useRef' is defined but never used.</message>
      <urgency>low</urgency>
    </issue>
    <issue id="em-any-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-explicit-any</code>
      <line>74</line>
      <message>Unexpected any. Specify a different type.</message>
      <urgency>medium</urgency>
    </issue>
  </file>

  <file path="src/islands/ManualEditorIsland.tsx" urgency="low">
    <issue id="me-validated-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>24</line>
      <message>'validated' is assigned a value but never used.</message>
      <urgency>low</urgency>
    </issue>
  </file>

  <file path="src/islands/ManualWorkspaceIsland.tsx" urgency="low">
    <issue id="mw-originalUrl-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>37</line>
      <message>'originalUrl' is assigned a value but never used.</message>
      <urgency>low</urgency>
    </issue>
  </file>

  <file path="src/islands/PlaygroundIsland.tsx" urgency="low">
    <issue id="pg-unused-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <lines>47-51</lines>
      <message>'mode', 'documentId', 'initialFilters' assigned but never used.</message>
      <urgency>low</urgency>
    </issue>
  </file>

  <file path="src/islands/SmartMetadataIsland.tsx" urgency="low">
    <issue id="sm-validation-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>45</line>
      <message>'validationError' is assigned a value but never used.</message>
    </issue>
  </file>

  <file path="src/islands/TagsManagerIsland.tsx" urgency="low">
    <issue id="tags-validated-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>14</line>
      <message>'validated' is assigned a value but never used.</message>
    </issue>
  </file>

  <file path="src/islands/ViewModeToggleIsland.tsx" urgency="low">
    <issue id="vmt-validated-1">
      <severity>warning</severity>
      <code>@typescript-eslint/no-unused-vars</code>
      <line>14</line>
      <message>'validated' is assigned a value but never used.</message>
    </issue>
  </file>

  <!-- CI / Workflow -->
  <file path=".github/workflows/python-coverage.yml" urgency="medium">
    <issue id="ci-secrets-1">
      <severity>error</severity>
      <code>yaml/semantic</code>
      <line>38</line>
      <message>Unrecognized named-value: 'secrets' and unexpected symbol '${{'.</message>
      <urgency>high</urgency>
      <recommendedSkill>pipeline-orchestration</recommendedSkill>
      <fixSummary>Wrap GitHub Actions expressions in quotes at keys that the YAML linter sees as plain mapping values (e.g., if: \"${{ secrets.SERENA_E2E == 'true' }}\") or update workflow schema/linter config. Validate with `act` or GitHub Actions linter.</fixSummary>
      <tests>Run `yaml-lint` and `act` / dry-run, then open PR to test workflows in CI.</tests>
      <docsRef>docs/DEPLOYMENT_CHECKLIST.md, .github/workflows/README (if present)</docsRef>
    </issue>
  </file>

  <file path=".github/workflows/alpha9-fast-audit.yml" urgency="low">
    <issue id="ci-env-1">
      <severity>warning</severity>
      <message>Context access might be invalid: POSTGRES_* env vars.</message>
      <urgency>low</urgency>
      <recommendedSkill>pipeline-orchestration</recommendedSkill>
      <fixSummary>Validate environment usage and secrets scoping in workflow templates.</fixSummary>
    </issue>
  </file>

  <file path=".github/workflows/verification-fast.yml" urgency="low">
    <issue id="ci-env-2">
      <severity>warning</severity>
      <message>Context access might be invalid: POSTGRES_* env vars.</message>
      <urgency>low</urgency>
      <recommendedSkill>pipeline-orchestration</recommendedSkill>
    </issue>
  </file>

  <!-- Global remediation guidance -->
  <remediation>
    <priorityOrder>
      <step>Fix ARIA attribute syntax and add AXE accessibility tests (frontend-design-auditor → frontend-design-implementer → test-agent)</step>
      <step>Fix missing `ms` import / runtime error and add type tests (frontend-design-implementer)</step>
      <step>Resolve GH Actions YAML expression errors (pipeline-orchestration)</step>
      <step>Eliminate `any` usages and unused variables, replace with types or underscore prefixes (frontend-design-implementer)</step>
      <step>Add unit and Playwright accessibility tests; ensure CI runs them (test-agent)</step>
      <step>If failures persist, run deep investigation (debug-like-expert)</step>
    </priorityOrder>
    <commands>
      <command>npm run lint</command>
      <command>npm run build || npm run typecheck</command>
      <command>npm test</command>
      <command>npx axe-playwright (or Playwright + axe integration)</command>
      <command>act -j <workflow> (local GH Actions emulation)</command>
    </commands>
    <acceptanceCriteria>
      <criterion>0 ESLint errors and 0 warnings in workspace</criterion>
      <criterion>0 TypeScript errors (tsc passes)</criterion>
      <criterion>0 axe/aria accessibility violations in tested pages</criterion>
      <criterion>CI workflows parse without YAML errors</criterion>
      <criterion>All tests (unit & e2e) pass</criterion>
    </acceptanceCriteria>
  </remediation>

  <iterationPlan orchestratorSkill="optimize-expert">
    <iteration number="1">
      <lead>frontend-design-auditor</lead>
      <tasks>
        <task>Audit HistoryTabsIsland.tsx ARIA usage and produce a small checklist & PR description for fixes.</task>
        <task>Run axe accessibility checks and capture failing nodes.</task>
      </tasks>
      <expectedOutcome>List of precise code edits and tests to fix ARIA violations.</expectedOutcome>
      <criteria>AXE shows 0 ARIA violations for the modified pages.</criteria>
    </iteration>

    <iteration number="2">
      <lead>frontend-design-implementer</lead>
      <tasks>
        <task>Implement ARIA fixes (use JSX booleans, correct values), import `ms` or replace use, fix unused vars and `any` types.</task>
        <task>Add unit tests and Playwright tests verifying tab selection and hidden panels.</task>
      </tasks>
      <expectedOutcome>TS build passes; lint reduces errors; new tests added.</expectedOutcome>
      <criteria>tsc & eslint pass; new tests added & green locally.</criteria>
    </iteration>

    <iteration number="3">
      <lead>pipeline-orchestration</lead>
      <tasks>
        <task>Fix YAML expression quoting where lint flagged '${{ ... }}' or adjust linter config; run `act` to validate workflows.</task>
        <task>Update docs if workflows or env scoping changes are required (docs-agent).</task>
      </tasks>
      <expectedOutcome>CI workflows parse and run; no YAML semantic errors.</expectedOutcome>
      <criteria>CI linter step passes; local act run shows expected job flows.</criteria>
    </iteration>

    <iteration number="4">
      <lead>test-agent</lead>
      <tasks>
        <task>Add Playwright accessibility assertions and unit tests for island runtime behavior.</task>
        <task>Ensure test coverage thresholds are met and add smoke tests for overlay duration behavior.</task>
      </tasks>
      <expectedOutcome>All tests green in CI; accessibility checks included in pipeline.</expectedOutcome>
      <criteria>npm test & Playwright e2e pass in CI and locally.</criteria>
    </iteration>

    <iteration number="5">
      <lead>debug-like-expert</lead>
      <tasks>
        <task>If any residual issues remain, perform deep debug, gather logs, propose minimal safe patch and risk assessment.</task>
      </tasks>
      <expectedOutcome>Zero errors/warnings, PRs ready to merge.</expectedOutcome>
      <criteria>All acceptance criteria from remediation met.</criteria>
    </iteration>
  </iterationPlan>

  <nextAgent recommended="frontend-design-auditor">
    <reason>ARIA issues are blocking accessibility and should be triaged and fixed first.</reason>
  </nextAgent>

  <notes>
    <note>Follow Serena memory discipline when making changes: update `run-active` and `handoff-next` (see modeInstructions).</note>
    <note>Reference authoritative docs before changes: docs/FRONTEND_ARCHITECTURE.md, docs/AGENT_READ_POLICY.md, docs/EXPERT_PIPELINE_DECISION_TABLE.md</note>
  </notes>
</triageReport>

---

## 🔧 Next steps (concise)
1. Assign **frontend-design-auditor** to fix ARIA attribute expressions and run accessibility scans. ✅  
2. After their audit, assign **frontend-design-implementer** to apply changes, import/fix `ms`, remove/rename unused vars, and replace `any` types. ✅  
3. Run: `npm run lint`, `npm run typecheck` (or `npm run build`), `npm test`, and Playwright+axe checks. ✅  
4. If CI/workflow YAML errors remain, assign **pipeline-orchestration**; if tests fail mysteriously, assign **debug-like-expert**. ✅

---

If you want, I can:
- produce an actionable PR checklist for the auditor, or
- start implementing the first safe changes (only after you confirm).

Would you like me to generate the auditor checklist now or directly open tasks for the implementer?