/**
 * Time Picker Component for Quote Wizard
 * Simplified version with wheel interface that directly updates the hidden input field
 */

function quoteTimePicker() {
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
      // Check if there's a saved time value and restore it
      const hiddenInput = document.getElementById('eventTime');
      console.log('Time picker init - hidden input value:', hiddenInput ? hiddenInput.value : 'no input');
      if (hiddenInput && hiddenInput.value) {
        const timeParts = hiddenInput.value.split(':');
        console.log('Time parts:', timeParts);
        if (timeParts.length === 2) {
          const hour = timeParts[0];
          const minute = timeParts[1];

          // Find the indices
          this.selectedHourIndex = this.availableHours.indexOf(hour);
          this.selectedMinuteIndex = this.availableMinutes.indexOf(minute);

          console.log('Hour index:', this.selectedHourIndex, 'Minute index:', this.selectedMinuteIndex);
          if (this.selectedHourIndex !== -1 && this.selectedMinuteIndex !== -1) {
            this.selectedHour = hour;
            this.selectedMinute = minute;
            this.updateHourOffset();
            this.updateMinuteOffset();
            console.log('Time restored:', `${this.selectedHour}:${this.selectedMinute}`);
          }
        }
      }
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

    updateHiddenInput() {
      if (this.selectedHour && this.selectedMinute) {
        const timeValue = `${this.selectedHour}:${this.selectedMinute}`;
        const hiddenInput = document.getElementById('eventTime');
        if (hiddenInput) {
          hiddenInput.value = timeValue;
        }
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
        this.updateHiddenInput();
        this.showTimePicker = false;
      }
    },

    handleTimePickerClose() {
      // Auto-save time if both hour and minute are selected when closing
      if (this.selectedHour !== null && this.selectedMinute !== null) {
        this.updateHiddenInput();
      }
      this.showTimePicker = false;
    }
  };
}
