(function() {
  class ExpertMessage {
    constructor(response) {
      this.response = response || {};
    }

    buildBadge(text, type) {
      const span = document.createElement('span');
      span.className = 'risk-badge';
      if (type === 'risk') {
        // color by risk level
        if ((this.response.risk_level || '').toLowerCase() === 'high') {
          span.classList.add('bg-red-100', 'text-red-800');
        } else if ((this.response.risk_level || '').toLowerCase() === 'medium') {
          span.classList.add('bg-yellow-100', 'text-yellow-800');
        } else {
          span.classList.add('bg-green-100', 'text-green-800');
        }
      } else if (type === 'compliance') {
        if ((this.response.compliance || '').toLowerCase() === 'non-compliant') {
          span.classList.add('bg-red-100', 'text-red-800');
        } else {
          span.classList.add('bg-green-100', 'text-green-800');
        }
      }
      span.textContent = text;
      return span;
    }

    buildList(title, items) {
      const wrapper = document.createElement('div');
      if (!items || !items.length) return wrapper;
      const h4 = document.createElement('h4');
      h4.className = 'text-sm font-semibold mt-2 mb-1';
      h4.textContent = title;
      wrapper.appendChild(h4);
      const ul = document.createElement('ul');
      ul.className = 'list-disc list-inside text-sm text-gray-700';
      items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      wrapper.appendChild(ul);
      return wrapper;
    }

    render() {
      const container = document.createElement('div');
      container.className = 'expert-message-container';

      // Category border
      const category = (this.response.category || '').toLowerCase();
      if (category === 'legal') {
        container.classList.add('border-red-400');
      } else if (category === 'financial' || category === 'financials') {
        container.classList.add('border-green-400');
      } else {
        container.classList.add('border-gray-300');
      }

      const header = document.createElement('div');
      header.className = 'flex items-center gap-3 mb-2';

      if (this.response.risk_level) {
        header.appendChild(this.buildBadge(`Risk: ${this.response.risk_level}`, 'risk'));
      }
      if (this.response.compliance) {
        header.appendChild(this.buildBadge(this.response.compliance, 'compliance'));
      }

      container.appendChild(header);

      // Main textual reply, fallback to reply/message/content
      const body = document.createElement('div');
      body.className = 'text-sm text-gray-800';

      const text = this.response.reply || this.response.message || this.response.content || '';
      // Use marked if available to parse markdown
      if (typeof marked !== 'undefined') {
        body.innerHTML = marked.parse(text);
      } else {
        body.textContent = text;
      }
      container.appendChild(body);

      // Key lists
      const keyTerms = this.response.key_terms || this.response.keyTerms || [];
      const missing = this.response.missing_clauses || this.response.missingClauses || [];

      const k = this.buildList('Key Terms', keyTerms);
      if (k.children.length) container.appendChild(k);

      const m = this.buildList('Missing Clauses', missing);
      if (m.children.length) container.appendChild(m);

      return container;
    }
  }

  window.ExpertMessage = ExpertMessage;
})();