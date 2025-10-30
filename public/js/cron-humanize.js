
function matchFixedPatterns(cron) {
  const patterns = {
    '0 0 * * *': 'Minden nap éjfélkor',
    '0 6 * * *': 'Minden nap reggel 6-kor',
    '0 2 * * *': 'Minden nap hajnali 2-kor',
    '0 12 * * *': 'Minden nap délben',
    '0 18 * * *': 'Minden nap este 6-kor',
    '0 8 * * 1-5': 'Munkanapokon reggel 8-kor',
    '0 8 * * 6,0': 'Hétvégén reggel 8-kor',
    '0 0 * * 1': 'Minden hétfőn éjfélkor',
    '0 0 1 * *': 'Minden hónap első napján éjfélkor',
    '0 3 * * 0#1': 'Minden hónap első vasárnapján 3:00-kor',
    '0 3 1-7 * 0': 'Minden hónap első vasárnapján 3:00-kor',
    '0 1 2 * *': 'Minden hónap 2. napján 1:00-kor',
    '0 0 1 1 *': 'Minden év január 1-jén éjfélkor',
    '0 0 25 12 *': 'Minden év december 25-én éjfélkor',
    '0 0 * * 0': 'Minden vasárnap éjfélkor',
    '0 0 * * 6': 'Minden szombaton éjfélkor',
    '0 0 * * 2': 'Minden kedden éjfélkor',
    '0 0 * * 3': 'Minden szerdán éjfélkor',
    '0 0 * * 4': 'Minden csütörtökön éjfélkor',
    '0 0 * * 5': 'Minden pénteken éjfélkor',
    '0 0 1 */2 *': 'Minden második hónap első napján éjfélkor',
    '0 0 1 */3 *': 'Minden negyedév első napján éjfélkor',
    '0 0 1 7 *': 'Minden év július 1-jén éjfélkor',
    '0 0 1 12 *': 'Minden év december 1-jén éjfélkor',
    '0 0 15 * *': 'Minden hónap 15-én éjfélkor',
    '0 0 1 5 *': 'Minden év május 1-jén éjfélkor',
    '0 0 20 * *': 'Minden hónap 20-án éjfélkor',
    '0 0 1 9 *': 'Minden év szeptember 1-jén éjfélkor',
    '0 0 1 10 *': 'Minden év október 1-jén éjfélkor',
    '0 0 1 11 *': 'Minden év november 1-jén éjfélkor',
    '0 0 1 2 *': 'Minden év február 1-jén éjfélkor',
    '0 0 1 3 *': 'Minden év március 1-jén éjfélkor',
    '0 0 1 4 *': 'Minden év április 1-jén éjfélkor',
    '0 0 1 6 *': 'Minden év június 1-jén éjfélkor',
    '0 0 1 8 *': 'Minden év augusztus 1-jén éjfélkor'
  };
  return patterns[cron] || null;
}

function matchEveryN(cron) {
  // Perces intervallumok
  const everyNMinutes = cron.match(/^\*\/(\d+) \* \* \* \*$/);
  if (everyNMinutes) { return `${everyNMinutes[1]} percenként`; }

  // Óránkénti intervallumok
  const everyNHours = cron.match(/^(\d+) \*\/(\d+) \* \* \*$/);
  if (everyNHours) { return `${everyNHours[2]} óránként, ${everyNHours[1].padStart(2, '0')} perckor`; }

  const everyNHoursZero = cron.match(/^0 \*\/(\d+) \* \* \*$/);
  if (everyNHoursZero) { return `${everyNHoursZero[1]} óránként`; }

  // Napi intervallumok
  const everyNDays = cron.match(/^0 0 \*\/(\d+) \* \*$/);
  if (everyNDays) { return `${everyNDays[1]} naponta éjfélkor`; }

  // Havi intervallumok
  const everyNMonths = cron.match(/^0 0 1 \*\/(\d+) \*$/);
  if (everyNMonths) { return `${everyNMonths[1]} havonta, hónap első napján éjfélkor`; }

  return null;
}

// Helper: Day names in Hungarian
function getDayNames() {
  return ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
}

// Helper: Format time string
function formatTime(hour, min) {
  return `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
}

// Pattern matcher: Special patterns (first weekday of month, etc.)
function matchSpecialPatterns(parts) {
  const [min, hour, dom, month, dow] = parts;

  // Első adott hétköznap (1-7 tartomány + nap)
  if (dom === '1-7' && month === '*' && /^\d+$/.test(dow)) {
    const napok = getDayNames();
    const napnev = napok[parseInt(dow)];
    return `Minden hónap első ${napnev}ján ${formatTime(hour, min)}-kor`;
  }

  return null;
}

// Pattern matcher: Day-based patterns
function matchDayPatterns(parts) {
  const [min, hour, dom, month, dow] = parts;

  // Nap-tartomány kezelése (pl. 1-7, 10-15)
  const dayRangeMatch = dom.match(/^(\d+)-(\d+)$/);
  if (dayRangeMatch && month === '*' && dow === '*') {
    const [, start, end] = dayRangeMatch;
    return `Minden hónap ${start}-${end}. napján ${formatTime(hour, min)}-kor`;
  }

  // Több konkrét nap: X,Y,Z
  if (dom.includes(',') && month === '*' && dow === '*') {
    const days = dom.split(',').join(', ');
    return `Minden hónap ${days}. napján ${formatTime(hour, min)}-kor`;
  }

  return null;
}

// Pattern matcher: Hour-based patterns
function matchHourPatterns(parts) {
  const [min, hour, dom, month, dow] = parts;

  // Óra-tartomány: Y-Z
  const hourRangeMatch = hour.match(/^(\d+)-(\d+)$/);
  if (hourRangeMatch && dom === '*' && month === '*' && dow === '*') {
    const [, start, end] = hourRangeMatch;
    return `Minden nap ${start.padStart(2, '0')}:00-${end.padStart(2, '0')}:00 között, ${min.padStart(2, '0')} perckor`;
  }

  // Több konkrét óra: Y,Z
  if (hour.includes(',') && dom === '*' && month === '*' && dow === '*') {
    const hours = hour.split(',').map((h) => h.padStart(2, '0')).join(', ');
    return `Minden nap ${hours} órakor, ${min.padStart(2, '0')} perckor`;
  }

  return null;
}

// Pattern matcher: Minute-based patterns
function matchMinutePatterns(parts) {
  const [min, hour, dom, month, dow] = parts;

  // Perc-tartomány: X-Y
  const minuteRangeMatch = min.match(/^(\d+)-(\d+)$/);
  if (minuteRangeMatch && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const [, start, end] = minuteRangeMatch;
    return `Minden órában, ${start.padStart(2, '0')}-${end.padStart(2, '0')}. perc között`;
  }

  // Több konkrét perc: X,Y,Z
  if (min.includes(',') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const minutes = min.split(',').map((m) => m.padStart(2, '0')).join(', ');
    return `Minden órában, ${minutes}. perckor`;
  }

  return null;
}

// Pattern matcher: Weekday-based patterns
function matchWeekdayPatterns(parts) {
  const [min, hour, dom, month, dow] = parts;
  const napok = getDayNames();

  // Hétköznap-tartomány: A-B (pl. 1-5 = hétfő-péntek)
  const dowRangeMatch = dow.match(/^(\d+)-(\d+)$/);
  if (dowRangeMatch && dom === '*' && month === '*') {
    const [, startIdx, endIdx] = dowRangeMatch;
    const start = napok[parseInt(startIdx)];
    const end = napok[parseInt(endIdx)];
    return `${start}-${end} ${formatTime(hour, min)}-kor`;
  }

  // Több hétköznap: A,B,C (pl. 1,3,5)
  if (dow.includes(',') && dom === '*' && month === '*') {
    const daysText = dow.split(',').map((d) => napok[parseInt(d.trim())]).join(', ');
    return `${daysText} ${formatTime(hour, min)}-kor`;
  }

  return null;
}

// Pattern matcher: Month-based patterns
function matchMonthPatterns(parts) {
  const [min, hour, dom, month, dow] = parts;

  // Több hónap: W,X,Y
  if (month.includes(',') && /^\d+$/.test(dom) && dow === '*') {
    const months = month.split(',').join(', ');
    return `Minden év ${months}. hónap ${dom}. napján ${formatTime(hour, min)}-kor`;
  }

  // Hónap-tartomány: W-Y
  const monthRangeMatch = month.match(/^(\d+)-(\d+)$/);
  if (monthRangeMatch && /^\d+$/.test(dom) && dow === '*') {
    const [, start, end] = monthRangeMatch;
    return `${start}-${end}. hónap ${dom}. napján ${formatTime(hour, min)}-kor`;
  }

  return null;
}

// Pattern matcher: Basic/default patterns
function matchBasicPatterns(parts) {
  const [min, hour, dom, month, dow] = parts;
  const napok = getDayNames();

  // Minden nap
  if (dom === '*' && month === '*' && dow === '*') {
    return `Minden nap ${formatTime(hour, min)}-kor`;
  }

  // Minden hónap X. napján
  if (dom !== '*' && month === '*' && dow === '*') {
    return `Minden hónap ${dom}. napján ${formatTime(hour, min)}-kor`;
  }

  // Minden héten adott napon
  if (dom === '*' && month === '*' && dow !== '*') {
    let napnev = dow;
    if (!isNaN(parseInt(dow))) {
      napnev = napok[parseInt(dow)];
    }
    return `Minden héten ${napnev} ${formatTime(hour, min)}-kor`;
  }

  // Minden év adott hónap adott napján
  if (dom !== '*' && month !== '*' && dow === '*') {
    return `Minden év ${month}. hónap ${dom}. napján ${formatTime(hour, min)}-kor`;
  }

  // Minden hónap adott napján, adott napon
  if (dom !== '*' && month === '*' && dow !== '*') {
    let napnev = dow;
    if (!isNaN(parseInt(dow))) {
      napnev = napok[parseInt(dow)];
    }
    return `Minden hónap ${dom}. napján, ${napnev} ${formatTime(hour, min)}-kor`;
  }

  return null;
}

// Main function: Try all pattern matchers in order
function matchGeneralPatterns(cron) {
  const parts = cron.split(' ');
  if (parts.length !== 5) {
    return null;
  }

  // Try pattern matchers in order of specificity
  return matchSpecialPatterns(parts)
    || matchDayPatterns(parts)
    || matchHourPatterns(parts)
    || matchMinutePatterns(parts)
    || matchWeekdayPatterns(parts)
    || matchMonthPatterns(parts)
    || matchBasicPatterns(parts);
}

function humanizeCron(cron) {
  if (!cron) { return ''; }

  // Speciális: X Y * * Z#1 (első adott hétköznap)
  const firstWeekdayMatch = cron.match(/^(\d+) (\d+) \* \* (\d+)#1$/);
  if (firstWeekdayMatch) {
    const napok = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
    const min = firstWeekdayMatch[1].padStart(2, '0');
    const hour = firstWeekdayMatch[2].padStart(2, '0');
    const dow = parseInt(firstWeekdayMatch[3], 10);
    const napnev = napok[dow];
    return `Minden hónap első ${napnev}ján ${hour}:${min}-kor`;
  }

  const fixed = matchFixedPatterns(cron);
  if (fixed) { return fixed; }
  const everyN = matchEveryN(cron);
  if (everyN) { return everyN; }
  const general = matchGeneralPatterns(cron);
  if (general) { return general; }
  return `${cron} (cron)`;
}

// Böngészőben globálisra tesszük, hogy elérhető legyen más scriptekből is
if (typeof window !== 'undefined') {
  window.humanizeCron = humanizeCron;
}

