// Booking System Module
// Note: Form components (datePicker, timePicker, locationSearch) are now imported from form-components.js

function bookingSystem(initialData = {}) {
  return {
    booking: {
      year: null,
      month: null,
      day: null,
      hour: null,
      minute: null,
      location: '',
      eventType: '',
      performer: initialData.performer || '',
      performerId: initialData.performerId || null
    },
    suggestions: [],
    showSuggestions: false,
    isSubmitting: false,

    // Helper function to focus and highlight an element
    focusAndHighlight(selector) {
      const element = document.querySelector(selector);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('focus-ring-primary');
        setTimeout(() => { element.classList.remove('focus-ring-primary'); }, 3000);
      }
    },

    // Helper function for validation errors with auto-focus
    showValidationError(message, selector) {
      if (typeof window.Modal !== 'undefined' && window.Modal.alert) {
        window.Modal.alert({
          title: 'Figyelmeztetés',
          message,
          type: 'warning'
        });
      }

      setTimeout(() => {
        this.focusAndHighlight(selector);
      }, 100);
    },

    // Search performers
    async searchPerformers(query) {
      if (query.length < 2) {
        this.suggestions = [];
        return;
      }

      try {
        const response = await fetch(`/eloadok/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success) {
          this.suggestions = data.performers.slice(0, 5);
          this.showSuggestions = true;
        }
      } catch (error) {
        console.error('Search error:', error);
      }
    },

    selectPerformer(performer) {
      this.booking.performer = performer.name;
      this.booking.performerId = performer.id;
      this.suggestions = [];
      this.showSuggestions = false;
    },

    // Notification functions
    showNotification(message, type = 'error') {
      if (typeof window.Modal === 'undefined') {
        return;
      }

      if (type === 'error') {
        window.Modal.alert({
          title: 'Hiba',
          message,
          type: 'error'
        });
      } else if (type === 'success') {
        window.Modal.alert({
          title: 'Siker',
          message,
          type: 'success'
        });
      } else if (type === 'warning') {
        window.Modal.alert({
          title: 'Figyelmeztetés',
          message,
          type: 'warning'
        });
      } else {
        window.Modal.alert({
          title: 'Információ',
          message,
          type: 'info'
        });
      }
    },

    // Submit booking
    submitBooking() {
      this.isSubmitting = true;

      try {
        // Step-by-step validation with specific messages

        // 1. Check date first
        if (!this.booking.year || !this.booking.month || !this.booking.day) {
          this.showValidationError(
            'Kérjük, válassza ki a koncert dátumát!',
            '.selected-date-display'
          );
          return;
        }

        // 2. Check time second (separate step)
        if (!this.booking.hour) {
          this.showValidationError(
            'Kérjük, válassza ki a koncert kezdési időpontját!',
            '.selected-time-display'
          );
          return;
        }

        // 3. Check location
        if (!this.booking.location || this.booking.location.trim() === '') {
          this.showValidationError(
            'Kérjük, adja meg a rendezvény helyszínét!',
            '.location-search input[type="text"]'
          );
          return;
        }

        // 4. Check event type
        if (!this.booking.eventType || this.booking.eventType === '') {
          this.showValidationError(
            'Kérjük, válassza ki a műsor típusát!',
            'select[x-model="booking.eventType"]'
          );
          return;
        }

        // 5. Check performer (this is optional, but we guide them)
        if (!this.booking.performer || this.booking.performer.trim() === '') {
          this.showValidationError(
            'Kérjük, adja meg a keresett előadót vagy műfajt!',
            'input[x-model="booking.performer"]'
          );
          return;
        }

        // All validation passed, show success message
        this.showNotification('Minden adat megadva! Átirányítjuk az ajánlatkérő oldalra...', 'success');

        // Format booking data
        const bookingData = {
          eventDate: `${this.booking.year}-${String(this.booking.month).padStart(2, '0')}-${String(this.booking.day).padStart(2, '0')}`,
          eventTime: `${String(this.booking.hour).padStart(2, '0')}:${String(this.booking.minute || 0).padStart(2, '0')}`,
          location: this.booking.location,
          eventType: this.booking.eventType,
          performerName: this.booking.performer,
          performerId: this.booking.performerId,
          source: 'homepage_booking_form'
        };

        // Small delay to show success message, then redirect
        setTimeout(() => {
          const params = new URLSearchParams(bookingData);
          window.location.href = `/foglalas?${params.toString()}`;
        }, 1500);
      } catch (error) {
        console.error('Booking submission error:', error);
        this.showNotification('Hiba történt az ajánlatkérés során. Kérjük, próbálja újra!', 'error');
      } finally {
        this.isSubmitting = false;
      }
    },

    // Handle date confirmation from calendar
    handleDateConfirmed(event) {
      this.booking.year = event.detail.year;
      this.booking.month = event.detail.month;
      this.booking.day = event.detail.day;
    },

    // Handle time confirmation from time picker
    handleTimeConfirmed(event) {
      this.booking.hour = event.detail.hour;
      this.booking.minute = event.detail.minute;
    },

    handleLocationSelected(event) {
      this.booking.location = event.detail.location;
    }
  };
}

// Ensure bookingSystem is globally available for Alpine.js
window.bookingSystem = bookingSystem;
// Note: datePicker, timePicker, and locationSearch are exported from form-components.js

/* Removed duplicate component definitions - now using shared form-components.js
function datePicker() {
  return {
    showCalendar: false,
    currentDate: new Date(),
    selectedDate: null,

    init() {
      // Initialize date picker
    },

    get calendarDates() {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const today = new Date();

      // First day of month and how many days
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const _daysInMonth = lastDay.getDate();

      // Start from Monday (Hungarian calendar)
      const startDate = new Date(firstDay);
      const dayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday start
      startDate.setDate(firstDay.getDate() - dayOfWeek);

      const dates = [];
      const currentDate = new Date(startDate);

      // Generate 6 weeks (42 days)
      for (let i = 0; i < 42; i++) {
        const isCurrentMonth = currentDate.getMonth() === month;
        const isToday = currentDate.toDateString() === today.toDateString();
        const isPast = currentDate < today && !isToday;
        const isSelected = this.selectedDate
          && currentDate.toDateString() === this.selectedDate.toDateString();

        dates.push({
          key: `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`,
          day: currentDate.getDate(),
          date: new Date(currentDate),
          otherMonth: !isCurrentMonth,
          today: isToday,
          selected: isSelected,
          disabled: isPast
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return dates;
    },

    formatMonthYear() {
      const months = [
        'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
        'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
      ];
      return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    },

    formatSelectedDate() {
      if (!this.selectedDate) { return ''; }

      const months = [
        'január', 'február', 'március', 'április', 'május', 'június',
        'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
      ];

      return `${this.selectedDate.getFullYear()}. ${months[this.selectedDate.getMonth()]} ${this.selectedDate.getDate()}.`;
    },

    previousMonth() {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    },

    nextMonth() {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    },

    selectDate(dateObj) {
      if (dateObj.disabled) { return; }

      this.selectedDate = dateObj.date;

      // Automatically confirm the date and close calendar
      this.$dispatch('date-confirmed', {
        year: dateObj.date.getFullYear(),
        month: dateObj.date.getMonth() + 1,
        day: dateObj.date.getDate()
      });

      this.showCalendar = false;
    }
  };
}

function timePicker() {
  return {
    showTimePicker: false,
    selectedHour: null,
    selectedMinute: null,

    // Wheel picker states
    selectedHourIndex: null, // No default selection
    selectedMinuteIndex: null, // No default selection
    hourOffset: 0,
    minuteOffset: 0,
    itemHeight: 40,

    // Touch handling
    hourTouchStart: { y: 0, offset: 0 },
    minuteTouchStart: { y: 0, offset: 0 },

    init() {
      // Don't set default time - let user choose
    },

    get availableHours() {
      return Array.from({ length: 24 }, (_, i) =>
        i.toString().padStart(2, '0')
      );
    },

    get availableMinutes() {
      return ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
    },

    updateHourOffset() {
      if (this.selectedHourIndex === null) {
        this.hourOffset = 0;
      } else {
        this.hourOffset = -this.selectedHourIndex * this.itemHeight;
      }
    },

    updateMinuteOffset() {
      if (this.selectedMinuteIndex === null) {
        this.minuteOffset = 0;
      } else {
        this.minuteOffset = -this.selectedMinuteIndex * this.itemHeight;
      }
    },

    updateSelectedTime() {
      if (this.selectedHourIndex !== null) {
        this.selectedHour = this.availableHours[this.selectedHourIndex];
      }
      if (this.selectedMinuteIndex !== null) {
        this.selectedMinute = this.availableMinutes[this.selectedMinuteIndex];
      }
    },

    selectHour(index) {
      this.selectedHourIndex = index;
      if (this.selectedMinuteIndex === null) {
        this.selectedMinuteIndex = 0; // Default to :00 when hour is selected
      }
      this.updateHourOffset();
      this.updateMinuteOffset();
      this.updateSelectedTime();
    },

    selectMinute(index) {
      this.selectedMinuteIndex = index;
      if (this.selectedHourIndex === null) {
        this.selectedHourIndex = 9; // Default to 09: when minute is selected
      }
      this.updateHourOffset();
      this.updateMinuteOffset();
      this.updateSelectedTime();
    },

    handleHourWheel(event) {
      const delta = event.deltaY > 0 ? 1 : -1;
      const newIndex = this.selectedHourIndex === null ? 9 : this.selectedHourIndex + delta;
      if (newIndex >= 0 && newIndex < this.availableHours.length) {
        this.selectHour(newIndex);
      }
    },

    handleMinuteWheel(event) {
      const delta = event.deltaY > 0 ? 1 : -1;
      const newIndex = this.selectedMinuteIndex === null ? 0 : this.selectedMinuteIndex + delta;
      if (newIndex >= 0 && newIndex < this.availableMinutes.length) {
        this.selectMinute(newIndex);
      }
    },

    handleHourTouchStart(event) {
      this.hourTouchStart.y = event.touches[0].clientY;
      this.hourTouchStart.offset = this.hourOffset;
    },

    handleHourTouchMove(event) {
      const deltaY = event.touches[0].clientY - this.hourTouchStart.y;
      const newOffset = this.hourTouchStart.offset + deltaY;

      const maxOffset = 0;
      const minOffset = -(this.availableHours.length - 1) * this.itemHeight;
      this.hourOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));

      const newIndex = Math.round(-this.hourOffset / this.itemHeight);
      this.selectedHourIndex = Math.max(0, Math.min(this.availableHours.length - 1, newIndex));
    },

    handleHourTouchEnd(_event) {
      this.updateHourOffset();
      this.updateSelectedTime();
    },

    handleMinuteTouchStart(event) {
      this.minuteTouchStart.y = event.touches[0].clientY;
      this.minuteTouchStart.offset = this.minuteOffset;
    },

    handleMinuteTouchMove(event) {
      const deltaY = event.touches[0].clientY - this.minuteTouchStart.y;
      const newOffset = this.minuteTouchStart.offset + deltaY;

      const maxOffset = 0;
      const minOffset = -(this.availableMinutes.length - 1) * this.itemHeight;
      this.minuteOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));

      const newIndex = Math.round(-this.minuteOffset / this.itemHeight);
      this.selectedMinuteIndex = Math.max(0, Math.min(this.availableMinutes.length - 1, newIndex));
    },

    handleMinuteTouchEnd(_event) {
      this.updateMinuteOffset();
      this.updateSelectedTime();
    },

    confirmTime() {
      if (this.selectedHour && this.selectedMinute) {
        // Use event dispatch to communicate with parent
        this.$dispatch('time-confirmed', {
          hour: parseInt(this.selectedHour),
          minute: parseInt(this.selectedMinute)
        });

        this.showTimePicker = false;
      }
    },

    handleTimePickerClose() {
      // Auto-save time if both hour and minute are selected when closing
      if (this.selectedHour !== null && this.selectedMinute !== null) {
        // Use event dispatch to communicate with parent
        this.$dispatch('time-confirmed', {
          hour: parseInt(this.selectedHour),
          minute: parseInt(this.selectedMinute)
        });
      }
      this.showTimePicker = false;
    }
  };
}

function locationSearch() {
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
      // Update parent booking data immediately when user types
      this.updateBookingLocation(this.query);

      // Search for suggestions with debounce
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.searchLocations();
      }, 300);
    },

    updateBookingLocation(locationValue) {
      // Update parent booking data
      try {
        const bookingComponent = this.$el.closest('[x-data*="bookingSystem"]');
        const alpineData = bookingComponent && bookingComponent.__x && bookingComponent.__x.$data;
        if (alpineData) {
          alpineData.booking.location = locationValue;
        } else {
          // Fallback: dispatch custom event
          this.$dispatch('location-selected', { location: locationValue });
        }
      } catch (error) {
        console.error('Error updating booking location:', error);
        // Fallback: dispatch custom event
        this.$dispatch('location-selected', { location: locationValue });
      }
    },

    selectLocation(location) {
      this.query = location.displayName;
      this.showSuggestions = false;

      // Update parent booking data
      this.updateBookingLocation(location.displayName);
    },

    selectHighlighted() {
      if (this.highlightedIndex >= 0 && this.suggestions[this.highlightedIndex]) {
        this.selectLocation(this.suggestions[this.highlightedIndex]);
      } else {
        // If no suggestion is highlighted, accept what the user typed
        this.showSuggestions = false;
        this.updateBookingLocation(this.query);
      }
    },

    highlightNext() {
      if (this.highlightedIndex < this.suggestions.length - 1) {
        this.highlightedIndex += 1;
      }
    },

    highlightPrevious() {
      if (this.highlightedIndex > 0) {
        this.highlightedIndex -= 1;
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

End of removed duplicate component definitions */
