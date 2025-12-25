(function() {
  class ThinkingAccordion {
    constructor() {}

    static extractThinkingBlocks(text) {
      const blocks = [];
      const regex = /<(?:think|thinking)[^>]*>([\s\S]*?)<\/(?:think|thinking)>/gi;
      let match;
      while ((match = regex.exec(text)) !== null) {
        blocks.push(match[1].trim());
      }
      return blocks;
    }

    static renderFromText(text) {
      const blocks = ThinkingAccordion.extractThinkingBlocks(text);
      if (!blocks.length) return null;

      const wrapper = document.createElement('div');
      wrapper.className = 'thinking-accordion space-y-2';

      blocks.forEach((blk, idx) => {
        const details = document.createElement('details');
        details.className = 'bg-gray-50 p-2 rounded';

        const summary = document.createElement('summary');
        summary.className = 'cursor-pointer text-sm font-medium';
        summary.textContent = `Thinking ${idx + 1}`;
        details.appendChild(summary);

        const pre = document.createElement('pre');
        pre.className = 'font-mono text-xs whitespace-pre-wrap p-2 overflow-auto';
        pre.textContent = blk;
        details.appendChild(pre);

        wrapper.appendChild(details);
      });

      return wrapper;
    }
  }

  window.ThinkingAccordion = ThinkingAccordion;
})();