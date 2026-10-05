/**
 * Date Utility Functions
 * Prevents timezone offset shifts (UTC vs Local) when selecting and rendering dates.
 */

/**
 * Formats an ISO string (YYYY-MM-DD) or other date string directly into DD-MM-YYYY or "DD Month YYYY"
 * without passing through UTC conversions that shift the day in negative timezone offsets.
 */
export const formatDisplayDate = (dateStr?: string, format: 'numeric' | 'long' = 'numeric'): string => {
  if (!dateStr) return '';

  const cleanStr = String(dateStr).trim();

  // Try matching YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const matchIso = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchIso) {
    const year = matchIso[1];
    const month = parseInt(matchIso[2], 10);
    const day = parseInt(matchIso[3], 10);
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');

    if (format === 'long') {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${dayStr} ${monthNames[month - 1] || ''} ${year}`;
    }

    return `${dayStr}-${monthStr}-${year}`;
  }

  // Try matching DD-MM-YYYY or DD/MM/YYYY
  const matchReverse = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (matchReverse) {
    const day = parseInt(matchReverse[1], 10);
    const month = parseInt(matchReverse[2], 10);
    const year = matchReverse[3];
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');

    if (format === 'long') {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${dayStr} ${monthNames[month - 1] || ''} ${year}`;
    }

    return `${dayStr}-${monthStr}-${year}`;
  }

  // Fallback to standard Date object using local components
  try {
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');

      if (format === 'long') {
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${dayStr} ${monthNames[month - 1] || ''} ${year}`;
      }

      return `${dayStr}-${monthStr}-${year}`;
    }
  } catch (e) {
    // Keep original string if parsing fails
  }

  return cleanStr;
};

/**
 * Returns the current calendar date in local timezone formatted as YYYY-MM-DD
 * suitable for `<input type="date" />`.
 */
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
