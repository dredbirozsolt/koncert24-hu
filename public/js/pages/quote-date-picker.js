/**
 * Date Picker Component for Quote Wizard
 * Simplified version that directly updates the hidden input field
 */

function quoteDatePicker() {
  return {
    showCalendar: false,
    currentDate: new Date(),
    selectedDate: null,

    init() {
      // Check if there's a saved date value and restore it
      const hiddenInput = document.getElementById('eventDate');
      console.log('Date picker init - hidden input value:', hiddenInput ? hiddenInput.value : 'no input');
      if (hiddenInput && hiddenInput.value) {
        const savedDate = new Date(hiddenInput.value);
        console.log('Parsed date:', savedDate, 'Valid:', !isNaN(savedDate.getTime()));
        if (!isNaN(savedDate.getTime())) {
          this.selectedDate = savedDate;
          this.currentDate = new Date(savedDate.getFullYear(), savedDate.getMonth(), 1);
          console.log('Date restored:', this.selectedDate);
        }
      }
    },

    get calendarDates() {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time for accurate comparison

      // First day of month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

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
        const dateWithoutTime = new Date(currentDate);
        dateWithoutTime.setHours(0, 0, 0, 0);
        const isPast = dateWithoutTime < today && !isToday;
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

      // Update hidden input with ISO date format (YYYY-MM-DD)
      const year = dateObj.date.getFullYear();
      const month = String(dateObj.date.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.date.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${day}`;

      const hiddenInput = document.getElementById('eventDate');
      if (hiddenInput) {
        hiddenInput.value = isoDate;
      }

      // Close calendar
      this.showCalendar = false;
    }
  };
}
