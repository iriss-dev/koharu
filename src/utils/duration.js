/**
 * Parses human duration strings (e.g. '10m', '2h', '1d', '30s') into milliseconds.
 * @param {string} input
 * @returns {number|null} Milliseconds, or null if invalid.
 */
function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;

  const match = input.trim().match(/^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hrs?|hours?|d|days?|w|weeks?)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase()[0];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/**
 * Formats milliseconds back into a clean readable duration string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

module.exports = {
  parseDuration,
  formatDuration,
};
