(function() {
  class OrchestratorStatus {
    constructor(containerSelector = '#chatTab') {
      this.container = document.querySelector(containerSelector) || document.body;
      this.banner = null;
    }

    show(message) {
      if (!this.banner) {
        this.banner = document.createElement('div');
        this.banner.className = 'orchestrator-status';
        this.banner.textContent = message || 'Consulting expert...';
        // insert at top of chatTab
        this.container.insertBefore(this.banner, this.container.firstChild);
      } else {
        this.banner.textContent = message || this.banner.textContent;
        this.banner.classList.remove('hidden');
      }
    }

    hide() {
      if (this.banner) {
        this.banner.classList.add('hidden');
      }
    }
  }

  window.OrchestratorStatus = OrchestratorStatus;
})();