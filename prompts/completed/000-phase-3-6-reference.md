<!-- Reference-only document -->
<phase-prompt priority="high" type="multi-phase-automation">
  <note>This file is reference-only. The executable inputs for /run-prompt-with-domain-subagent are the four Markdown prompt files in ./prompts/ (102–105).</note>
  <files>
    <file path="./prompts/102-phase-3-visual-query-generation.md" />
    <file path="./prompts/103-phase-4-visual-query-execution.md" />
    <file path="./prompts/104-phase-5-metrics-monitoring.md" />
    <file path="./prompts/105-phase-6-testing-validation.md" />
  </files>
  <execution command="/run-prompt-with-domain-subagent 102 103 104 105 --sequential" />
</phase-prompt>
