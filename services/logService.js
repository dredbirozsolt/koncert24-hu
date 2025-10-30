const fs = require('fs').promises;
const logger = require('../config/logger');

/**
 * Get log level name from numeric level
 */
function getLevelName(level) {
  const levels = {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL'
  };
  return levels[level] || 'UNKNOWN';
}

/**
 * Process log entry for filtering and formatting
 * @param {string} line - Log line to process
 * @param {string} level - Filter level
 * @param {string} search - Search term
 * @returns {Object|null} Processed log entry or null if filtered out
 */
function processLogEntry(line, level, search) {
  if (!line.trim()) {return null;}

  try {
    const entry = JSON.parse(line);

    // Level filtering
    if (level && level !== 'all') {
      const levelMap = {
        trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60
      };
      const minLevel = levelMap[level] || 30;
      if (entry.level < minLevel) {return null;}
    }

    // Search filtering
    if (search) {
      const searchLower = search.toLowerCase();
      const searchableText = JSON.stringify(entry).toLowerCase();
      if (!searchableText.includes(searchLower)) {return null;}
    }

    // Format entry for display
    return {
      timestamp: new Date(entry.time).toLocaleString('hu-HU'),
      level: getLevelName(entry.level),
      levelClass: getLevelClass(entry.level),
      message: entry.msg || '',
      details: getEntryDetails(entry),
      raw: entry
    };
  } catch {
    // Handle non-JSON log lines
    if (search) {
      const searchLower = search.toLowerCase();
      if (!line.toLowerCase().includes(searchLower)) {return null;}
    }

    return {
      timestamp: 'N/A',
      level: 'RAW',
      levelClass: 'text-muted',
      message: line,
      details: null,
      raw: null
    };
  }
}

/**
 * Get CSS class for log level
 */
function getLevelClass(level) {
  if (level >= 50) {return 'text-danger';}  // ERROR, FATAL
  if (level >= 40) {return 'text-warning';} // WARN
  if (level >= 30) {return 'text-info';}    // INFO
  return 'text-muted';                     // DEBUG, TRACE
}

/**
 * Extract additional details from log entry
 */
function getEntryDetails(entry) {
  const details = { ...entry };
  delete details.time;
  delete details.level;
  delete details.msg;
  delete details.hostname;
  delete details.pid;
  delete details.v;

  return Object.keys(details).length > 0 ? details : null;
}

/**
 * Filter log lines based on level and search criteria
 * @param {Array} lines - Array of log lines
 * @param {string} level - Log level filter
 * @param {string} search - Search term
 * @returns {Array} Filtered and processed log entries
 */
function filterLogLines(lines, level, search) {
  const entries = [];

  for (const line of lines) {
    const entry = processLogEntry(line, level, search);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Get available log files from logs directory
 */
async function getLogFiles() {
  try {
    const logsDir = 'logs';
    const files = await fs.readdir(logsDir);

    const logFiles = [];
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = `${logsDir}/${file}`;
        const stats = await fs.stat(filePath);
        logFiles.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          sizeFormatted: formatFileSize(stats.size)
        });
      }
    }

    // Sort by modification time, newest first
    logFiles.sort((a, b) => b.modified - a.modified);

    return logFiles;
  } catch (error) {
    logger.error({ err: error, service: 'log', operation: 'readLogFiles' }, 'Error reading log files');
    return [];
  }
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) {return '0 B';}

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

module.exports = {
  getLevelName,
  processLogEntry,
  filterLogLines,
  getLogFiles,
  formatFileSize
};
