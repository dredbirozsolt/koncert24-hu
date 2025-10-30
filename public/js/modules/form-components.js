// Common Form Components Module
// Shared date picker, time picker, and location search components

/**
 * Date Picker Component
 * Provides a calendar interface for date selection
 */
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
      for (let i = 0; i < 42; i += 1) {
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
      const formattedDate = `${dateObj.date.getFullYear()}-${String(dateObj.date.getMonth() + 1).padStart(2, '0')}-${String(dateObj.date.getDate()).padStart(2, '0')}`;

      this.$dispatch('date-confirmed', {
        date: formattedDate,
        year: dateObj.date.getFullYear(),
        month: dateObj.date.getMonth() + 1,
        day: dateObj.date.getDate()
      });

      this.showCalendar = false;
    }
  };
}

/**
 * Time Picker Component
 * Provides a wheel-based time selection interface
 */
function timePicker() {
  return {
    showPicker: false,
    showTimePicker: false, // Alias for compatibility
    selectedHour: null,
    selectedMinute: null,
    selectedHourIndex: null,
    selectedMinuteIndex: null,
    hourOffset: 0,
    minuteOffset: 0,
    itemHeight: 40,

    // Touch handling
    hourTouchStart: { y: 0, offset: 0 },
    minuteTouchStart: { y: 0, offset: 0 },

    init() {
      // Don't set default time - let user choose
    },

    get timeDisplayText() {
      if (this.selectedHour !== null && this.selectedMinute !== null) {
        return `${this.selectedHour}:${this.selectedMinute}`;
      }
      return '';
    },

    get availableHours() {
      return Array.from({ length: 24 }, (_, i) =>
        i.toString().padStart(2, '0')
      );
    },

    get availableMinutes() {
      return ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
    },

    selectHour(index) {
      this.selectedHourIndex = index;
      this.selectedHour = this.availableHours[index];
      this.updateHourOffset();

      if (this.selectedMinuteIndex === null) {
        this.selectedMinuteIndex = 0;
        this.selectedMinute = this.availableMinutes[0];
        this.updateMinuteOffset();
      }
      this.updateSelectedTime();
    },

    selectMinute(index) {
      this.selectedMinuteIndex = index;
      this.selectedMinute = this.availableMinutes[index];
      this.updateMinuteOffset();

      if (this.selectedHourIndex === null) {
        this.selectedHourIndex = 9; // Default to 09:00
        this.selectedHour = this.availableHours[9];
        this.updateHourOffset();
      }
      this.updateSelectedTime();
    },

    updateHourOffset() {
      if (this.selectedHourIndex !== null) {
        this.hourOffset = -this.selectedHourIndex * this.itemHeight;
      }
    },

    updateMinuteOffset() {
      if (this.selectedMinuteIndex !== null) {
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

    handleHourTouchEnd() {
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

    handleMinuteTouchEnd() {
      this.updateMinuteOffset();
      this.updateSelectedTime();
    },

    confirmTime() {
      if (this.selectedHour && this.selectedMinute) {
        this.showPicker = false;
        this.showTimePicker = false;

        // Update parent booking data
        this.$dispatch('time-confirmed', {
          time: `${this.selectedHour}:${this.selectedMinute}`,
          hour: parseInt(this.selectedHour, 10),
          minute: parseInt(this.selectedMinute, 10)
        });
      }
    },

    handleTimePickerClose() {
      // Auto-save time if both hour and minute are selected when closing
      if (this.selectedHour !== null && this.selectedMinute !== null) {
        this.$dispatch('time-confirmed', {
          hour: parseInt(this.selectedHour, 10),
          minute: parseInt(this.selectedMinute, 10)
        });
      }
      this.showPicker = false;
      this.showTimePicker = false;
    }
  };
}

/**
 * Location Search Component
 * Provides autocomplete functionality for location selection
 */
function locationSearch() {
  return {
    query: '',
    suggestions: [],
    showSuggestions: false,
    highlightedIndex: -1,
    isLoading: false,
    searchTimeout: null,

    handleInput() {
      // Update parent immediately
      this.$dispatch('location-changed', { location: this.query });
      this.updateBookingLocation(this.query);

      // Search suggestions with debounce
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.searchLocations();
      }, 300);
    },

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

    selectLocation(location) {
      const locationName = location.displayName || location.name;
      this.query = locationName;
      this.suggestions = [];
      this.showSuggestions = false;

      // Update parent and confirm selection
      this.$dispatch('location-selected', { location: locationName });
      this.updateBookingLocation(locationName);
    },

    updateBookingLocation(locationValue) {
      // Update parent booking data
      try {
        const bookingComponent = this.$el.closest('[x-data*="bookingSystem"]');
        const alpineData = bookingComponent && bookingComponent.__x && bookingComponent.__x.$data;
        if (alpineData && alpineData.booking) {
          alpineData.booking.location = locationValue;
        }
      } catch (error) {
        console.error('Error updating booking location:', error);
      }
    },

    hideSuggestions() {
      setTimeout(() => {
        this.showSuggestions = false;
      }, 200);
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

    selectHighlighted() {
      if (this.highlightedIndex >= 0 && this.suggestions[this.highlightedIndex]) {
        this.selectLocation(this.suggestions[this.highlightedIndex]);
      } else {
        // If no suggestion is highlighted, accept what the user typed
        this.showSuggestions = false;
        this.updateBookingLocation(this.query);
      }
    }
  };
}

// Export functions for global use
window.datePicker = datePicker;
window.timePicker = timePicker;
window.locationSearch = locationSearch;
