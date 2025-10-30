/**
 * Location Search Component for Quote Wizard
 * Simplified version that directly updates the hidden input field
 */

function quoteLocationSearch() {
  return {
    query: '',
    suggestions: [],
    showSuggestions: false,
    highlightedIndex: -1,
    isLoading: false,
    searchTimeout: null,

    async searchLocations() {
      if (this.query.length < 2) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }

      this.isLoading = true;

      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(this.query)}&limit=8`);
        const data = await response.json();

        this.suggestions = data;
        this.showSuggestions = true;
        this.highlightedIndex = -1;
      } catch (error) {
        console.error('Location search error:', error);
        this.suggestions = [];
      } finally {
        this.isLoading = false;
      }
    },

    handleInput() {
      // Update hidden input with current query
      this.updateHiddenInput(this.query);

      // Search for suggestions with debounce
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.searchLocations();
      }, 300);
    },

    updateHiddenInput(value) {
      const hiddenInput = document.getElementById('eventLocation');
      if (hiddenInput) {
        hiddenInput.value = value;
      }
    },

    selectLocation(location) {
      this.query = location.displayName;
      this.showSuggestions = false;
      this.updateHiddenInput(location.displayName);
    },

    selectHighlighted() {
      if (this.highlightedIndex >= 0 && this.suggestions[this.highlightedIndex]) {
        this.selectLocation(this.suggestions[this.highlightedIndex]);
      } else {
        // If no suggestion is highlighted, accept what the user typed
        this.showSuggestions = false;
        this.updateHiddenInput(this.query);
      }
    },

    highlightNext() {
      if (this.highlightedIndex < this.suggestions.length - 1) {
        this.highlightedIndex++;
      }
    },

    highlightPrevious() {
      if (this.highlightedIndex > 0) {
        this.highlightedIndex--;
      }
    },

    hideSuggestions() {
      setTimeout(() => {
        this.showSuggestions = false;
        this.highlightedIndex = -1;
      }, 200);
    }
  };
}
