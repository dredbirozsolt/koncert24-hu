/**
 * Cron Pattern Matcher & Next Run Calculator
 * Helper functions for calculating next cron job execution time
 *
 * @module utils/cronPatternMatcher
 */

const logger = require('../config/logger');

// ============================================
// PATTERN MATCHER FUNCTIONS
// ============================================

function matchMinuteLevel(parts, now) {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  const allWildcards = hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*';
  if (!allWildcards) { return null; }

  if (minute.startsWith('*/')) {
    return getNextEveryXMinutes(now, parseInt(minute.substring(2), 10));
  }
  if (/^\d+$/.test(minute)) {
    return getNextHourlyAtMinute(now, parseInt(minute, 10));
  }
  const minuteRangeMatch = minute.match(/^(\d+)-(\d+)$/);
  if (minuteRangeMatch) {
    return getNextMinuteRangeInHour(now, parseInt(minuteRangeMatch[1], 10), parseInt(minuteRangeMatch[2], 10));
  }
  if (minute.includes(',')) {
    return getNextAtMinutes(now, minute.split(',').map((m) => parseInt(m.trim(), 10)));
  }
  return null;
}

function matchHourLevel(parts, now) {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  const dailyWildcards = dayOfMonth === '*' && month === '*' && dayOfWeek === '*';
  if (!dailyWildcards) { return null; }

  if (hour.startsWith('*/')) {
    const targetMinute = minute === '*' ? 0 : parseInt(minute, 10);
    return getNextEveryXHours(now, parseInt(hour.substring(2), 10), targetMinute);
  }
  const hourRangeMatch = hour.match(/^(\d+)-(\d+)$/);
  if (hourRangeMatch && /^\d+$/.test(minute)) {
    return getNextHourRangeAtMinute(
      now, parseInt(hourRangeMatch[1], 10), parseInt(hourRangeMatch[2], 10), parseInt(minute, 10)
    );
  }
  if (hour.includes(',') && /^\d+$/.test(minute)) {
    return getNextAtHours(
      now, hour.split(',').map((h) => parseInt(h.trim(), 10)), parseInt(minute, 10)
    );
  }
  return null;
}

function matchDailyLevel(parts, now) {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return getNextDailyAtTime(now, parseInt(hour, 10), parseInt(minute, 10));
  }
  return null;
}

function matchWeeklyLevel(parts, now) {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  const monthlyWildcards = dayOfMonth === '*' && month === '*';
  if (!monthlyWildcards || !(/^\d+$/.test(minute) && /^\d+$/.test(hour))) { return null; }

  if (/^\d+$/.test(dayOfWeek)) {
    return getNextWeeklyAtDayAndTime(now, parseInt(dayOfWeek, 10), parseInt(hour, 10), parseInt(minute, 10));
  }
  if (dayOfWeek.includes(',')) {
    return getNextOnWeekdays(
      now, dayOfWeek.split(',').map((d) => parseInt(d.trim(), 10)),
      parseInt(hour, 10), parseInt(minute, 10)
    );
  }
  const dowRangeMatch = dayOfWeek.match(/^(\d+)-(\d+)$/);
  if (dowRangeMatch) {
    return getNextWeekdayRange(
      now, parseInt(dowRangeMatch[1], 10), parseInt(dowRangeMatch[2], 10),
      parseInt(hour, 10), parseInt(minute, 10)
    );
  }
  return null;
}

function matchMonthlyLevel(parts, now) {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  const yearlyWildcards = month === '*' && dayOfWeek === '*';
  if (!yearlyWildcards || !(/^\d+$/.test(minute) && /^\d+$/.test(hour))) { return null; }

  if (/^\d+$/.test(dayOfMonth)) {
    return getNextMonthlyAtDayAndTime(now, parseInt(dayOfMonth, 10), parseInt(hour, 10), parseInt(minute, 10));
  }
  const dayRangeMatch = dayOfMonth.match(/^(\d+)-(\d+)$/);
  if (dayRangeMatch) {
    const rangeStart = parseInt(dayRangeMatch[1], 10);
    const rangeEnd = parseInt(dayRangeMatch[2], 10);
    if (rangeStart === 1 && rangeEnd === 7 && /^\d+$/.test(dayOfWeek)) {
      return getNextFirstWeekdayOfMonth(now, parseInt(dayOfWeek, 10), parseInt(hour, 10), parseInt(minute, 10));
    }
    return getNextDayRangeAtTime(now, rangeStart, rangeEnd, parseInt(hour, 10), parseInt(minute, 10));
  }
  if (dayOfMonth.includes(',')) {
    return getNextOnMonthDays(
      now, dayOfMonth.split(',').map((d) => parseInt(d.trim(), 10)),
      parseInt(hour, 10), parseInt(minute, 10)
    );
  }
  if (month.startsWith('*/') && /^\d+$/.test(dayOfMonth)) {
    return getNextEveryXMonths(
      now, parseInt(month.substring(2), 10), parseInt(dayOfMonth, 10),
      parseInt(hour, 10), parseInt(minute, 10)
    );
  }
  return null;
}

function matchYearlyLevel(parts, now) {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  if (dayOfWeek !== '*' || !(/^\d+$/.test(minute) && /^\d+$/.test(hour) && /^\d+$/.test(dayOfMonth))) { return null; }

  if (/^\d+$/.test(month)) {
    return getNextYearlyAtDate(
      now, parseInt(month, 10), parseInt(dayOfMonth, 10),
      parseInt(hour, 10), parseInt(minute, 10)
    );
  }
  if (month.includes(',')) {
    return getNextOnMonths(
      now, month.split(',').map((m) => parseInt(m.trim(), 10)),
      parseInt(dayOfMonth, 10), parseInt(hour, 10), parseInt(minute, 10)
    );
  }
  const monthRangeMatch = month.match(/^(\d+)-(\d+)$/);
  if (monthRangeMatch) {
    return getNextMonthRange({
      now,
      monthStart: parseInt(monthRangeMatch[1], 10),
      monthEnd: parseInt(monthRangeMatch[2], 10),
      day: parseInt(dayOfMonth, 10),
      hour: parseInt(hour, 10),
      minute: parseInt(minute, 10)
    });
  }
  return null;
}

function matchSpecialLevel(schedule, now) {
  if (schedule === '0 3 * * 0#1' || /^\d+ \d+ \* \* \d+#1$/.test(schedule)) {
    const parts = schedule.match(/^(\d+) (\d+) \* \* (\d+)#1$/);
    if (parts) {
      return getNextFirstWeekdayOfMonth(now, parseInt(parts[3], 10), parseInt(parts[2], 10), parseInt(parts[1], 10));
    }
  }
  return null;
}

/**
 * Main function to calculate next cron execution time
 * @param {string} schedule - Cron schedule pattern
 * @returns {string|null} ISO timestamp of next execution or null
 */
function getNextCronTime(schedule) {
  try {
    const now = new Date();
    const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.split(' ');
    const parts = { minute, hour, dayOfMonth, month, dayOfWeek };
    return matchMinuteLevel(parts, now)
      || matchHourLevel(parts, now)
      || matchDailyLevel(parts, now)
      || matchWeeklyLevel(parts, now)
      || matchMonthlyLevel(parts, now)
      || matchYearlyLevel(parts, now)
      || matchSpecialLevel(schedule, now)
      || getNextDay(now);
  } catch (error) {
    logger.error({ err: error, schedule }, 'Cron parse error');
    return null;
  }
}

// ============================================
// TIME CALCULATION FUNCTIONS
// ============================================

// Perces intervallumok: */X * * * *
function getNextEveryXMinutes(now, interval) {
  const next = new Date(now);
  const currentMinute = next.getMinutes();
  const currentSecond = next.getSeconds();
  const nextMinute = Math.ceil((currentMinute + (currentSecond > 0 ? 1 : 0)) / interval) * interval;

  next.setMinutes(nextMinute, 0, 0);
  if (next <= now) {
    next.setMinutes(next.getMinutes() + interval);
  }
  return next.toISOString();
}

// Konkrét perc minden órában: X * * * *
function getNextHourlyAtMinute(now, minute) {
  const next = new Date(now);
  next.setMinutes(minute, 0, 0);
  if (next <= now) {
    next.setHours(next.getHours() + 1);
  }
  return next.toISOString();
}

// Óránkénti intervallumok: X */Y * * *
function getNextEveryXHours(now, interval, minute = 0) {
  const next = new Date(now);
  const currentHour = next.getHours();
  const currentMinute = next.getMinutes();

  // Dinamikus intervallum slotok generálása
  const slots = [];
  for (let h = 0; h < 24; h += interval) {
    slots.push(h);
  }

  // Keressük a következő slotot
  let nextSlot = slots.find((slot) => {
    if (slot > currentHour) {return true;}
    return slot === currentHour && currentMinute < minute;
  });

  // Ha nincs több slot ma, akkor holnap az első slot
  if (!nextSlot && nextSlot !== 0) {
    next.setDate(next.getDate() + 1);
    nextSlot = slots[0];
  }

  next.setHours(nextSlot, minute, 0, 0);
  return next.toISOString();
}

// Napi időpont: X Y * * *
function getNextDailyAtTime(now, hour, minute = 0) {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

// Havi konkrét nap: X Y Z * *
function getNextMonthlyAtDayAndTime(now, day, hour, minute) {
  const next = new Date(now);
  next.setDate(day);
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(day);
  }

  return next.toISOString();
}

// Nap-tartomány: X Y A-B * *
function getNextDayRangeAtTime(now, rangeStart, rangeEnd, hour, minute) {
  const next = new Date(now);
  const currentDay = next.getDate();

  for (let day = currentDay; day <= rangeEnd; day++) {
    next.setDate(day);
    next.setHours(hour, minute, 0, 0);

    if (next > now && day >= rangeStart && day <= rangeEnd) {
      return next.toISOString();
    }
  }

  next.setMonth(next.getMonth() + 1);
  next.setDate(rangeStart);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

// Heti konkrét nap: X Y * * Z
function getNextWeeklyAtDayAndTime(now, dayOfWeek, hour, minute) {
  const next = new Date(now);
  const currentDay = next.getDay();

  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil < 0) {
    daysUntil += 7;
  } else if (daysUntil === 0) {
    next.setHours(hour, minute, 0, 0);
    if (next <= now) {
      daysUntil = 7;
    }
  }

  next.setDate(next.getDate() + daysUntil);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

// Éves konkrét dátum: X Y Z W *
function getNextYearlyAtDate(now, month, day, hour, minute) {
  const next = new Date(now);
  next.setMonth(month - 1);
  next.setDate(day);
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setFullYear(next.getFullYear() + 1);
  }

  return next.toISOString();
}

function getNextDay(now) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString();
}

// Perc-tartomány: X-Y * * * *
function getNextMinuteRangeInHour(now, rangeStart, rangeEnd) {
  const next = new Date(now);
  const currentMinute = next.getMinutes();

  for (let min = currentMinute + 1; min <= rangeEnd; min++) {
    if (min >= rangeStart) {
      next.setMinutes(min, 0, 0);
      return next.toISOString();
    }
  }

  next.setHours(next.getHours() + 1);
  next.setMinutes(rangeStart, 0, 0);
  return next.toISOString();
}

// Több konkrét perc: X,Y,Z * * * *
function getNextAtMinutes(now, minutes) {
  const next = new Date(now);
  const currentMinute = next.getMinutes();

  const sortedMinutes = minutes.sort((a, b) => a - b);
  const nextMinute = sortedMinutes.find((m) => m > currentMinute);

  if (nextMinute === undefined) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(sortedMinutes[0], 0, 0);
  } else {
    next.setMinutes(nextMinute, 0, 0);
  }

  return next.toISOString();
}

// Óra-tartomány: X Y-Z * * *
function getNextHourRangeAtMinute(now, rangeStart, rangeEnd, minute) {
  const next = new Date(now);
  const currentHour = next.getHours();

  for (let hour = currentHour; hour <= rangeEnd; hour++) {
    if (hour >= rangeStart) {
      next.setHours(hour, minute, 0, 0);
      if (next > now) {
        return next.toISOString();
      }
    }
  }

  next.setDate(next.getDate() + 1);
  next.setHours(rangeStart, minute, 0, 0);
  return next.toISOString();
}

// Több konkrét óra: X Y,Z * * *
function getNextAtHours(now, hours, minute) {
  const next = new Date(now);
  const currentHour = next.getHours();
  const currentMinute = next.getMinutes();

  const sortedHours = hours.sort((a, b) => a - b);
  const nextHour = sortedHours.find((h) => h > currentHour || (h === currentHour && minute > currentMinute));

  if (nextHour === undefined) {
    next.setDate(next.getDate() + 1);
    next.setHours(sortedHours[0], minute, 0, 0);
  } else {
    next.setHours(nextHour, minute, 0, 0);
  }

  return next.toISOString();
}

// Több hétköznap: X Y * * A,B,C
function getNextOnWeekdays(now, daysOfWeek, hour, minute) {
  const next = new Date(now);
  const currentDay = next.getDay();

  const sortedDays = daysOfWeek.sort((a, b) => a - b);

  next.setHours(hour, minute, 0, 0);
  if (next > now && sortedDays.includes(currentDay)) {
    return next.toISOString();
  }

  for (let i = 1; i <= 7; i++) {
    const testDay = (currentDay + i) % 7;
    if (sortedDays.includes(testDay)) {
      next.setDate(next.getDate() + i);
      next.setHours(hour, minute, 0, 0);
      return next.toISOString();
    }
  }

  return next.toISOString();
}

// Hétköznap-tartomány: X Y * * A-B
function getNextWeekdayRange(now, dowStart, dowEnd, hour, minute) {
  const next = new Date(now);
  const currentDay = next.getDay();

  next.setHours(hour, minute, 0, 0);
  if (next > now && currentDay >= dowStart && currentDay <= dowEnd) {
    return next.toISOString();
  }

  for (let i = 1; i <= 7; i++) {
    const testDay = (currentDay + i) % 7;
    if (testDay >= dowStart && testDay <= dowEnd) {
      next.setDate(next.getDate() + i);
      next.setHours(hour, minute, 0, 0);
      return next.toISOString();
    }
  }

  return next.toISOString();
}

// Több konkrét nap havonta: X Y A,B,C * *
function getNextOnMonthDays(now, days, hour, minute) {
  const next = new Date(now);
  const currentDay = next.getDate();

  const sortedDays = days.sort((a, b) => a - b);

  for (const day of sortedDays) {
    if (day > currentDay || (day === currentDay && next.getHours() < hour)
        || (day === currentDay && next.getHours() === hour && next.getMinutes() < minute)) {
      next.setDate(day);
      next.setHours(hour, minute, 0, 0);
      if (next > now) {
        return next.toISOString();
      }
    }
  }

  next.setMonth(next.getMonth() + 1);
  next.setDate(sortedDays[0]);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

// Első adott hétköznap a hónapban: X Y 1-7 * Z vagy X Y * * Z#1
function getNextFirstWeekdayOfMonth(now, dayOfWeek, hour, minute) {
  const currentMonthFirst = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstTarget = new Date(currentMonthFirst);

  while (firstTarget.getDay() !== dayOfWeek) {
    firstTarget.setDate(firstTarget.getDate() + 1);
  }
  firstTarget.setHours(hour, minute, 0, 0);

  if (now < firstTarget) {
    return firstTarget.toISOString();
  }

  const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextFirstTarget = new Date(nextMonthFirst);

  while (nextFirstTarget.getDay() !== dayOfWeek) {
    nextFirstTarget.setDate(nextFirstTarget.getDate() + 1);
  }
  nextFirstTarget.setHours(hour, minute, 0, 0);
  return nextFirstTarget.toISOString();
}

// Hónap intervallum: X Y Z */N *
function getNextEveryXMonths(now, interval, day, hour, minute) {
  const next = new Date(now);
  next.setDate(day);
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setMonth(next.getMonth() + interval);
    next.setDate(day);
  }

  return next.toISOString();
}

// Több hónap: X Y Z W,X *
function getNextOnMonths(now, months, day, hour, minute) {
  const next = new Date(now);
  const currentMonth = next.getMonth() + 1;

  const sortedMonths = months.sort((a, b) => a - b);

  for (const month of sortedMonths) {
    const isMonthPassed = month > currentMonth
        || (month === currentMonth && next.getDate() < day)
        || (month === currentMonth && next.getDate() === day && next.getHours() < hour)
        || (month === currentMonth && next.getDate() === day && next.getHours() === hour
          && next.getMinutes() < minute);
    if (isMonthPassed) {
      next.setMonth(month - 1);
      next.setDate(day);
      next.setHours(hour, minute, 0, 0);
      if (next > now) {
        return next.toISOString();
      }
    }
  }

  next.setFullYear(next.getFullYear() + 1);
  next.setMonth(sortedMonths[0] - 1);
  next.setDate(day);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

// Hónap-tartomány: X Y Z W-Y *
function getNextMonthRange({ now, monthStart, monthEnd, day, hour, minute }) {
  const next = new Date(now);
  const currentMonth = next.getMonth() + 1;

  for (let month = currentMonth; month <= monthEnd; month++) {
    if (month >= monthStart) {
      next.setMonth(month - 1);
      next.setDate(day);
      next.setHours(hour, minute, 0, 0);
      if (next > now) {
        return next.toISOString();
      }
    }
  }

  next.setFullYear(next.getFullYear() + 1);
  next.setMonth(monthStart - 1);
  next.setDate(day);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

module.exports = {
  getNextCronTime
};
