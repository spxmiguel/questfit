/**
 * Returns the local date string in YYYY-MM-DD format based on the user's local timezone.
 * Optionally offsets the date by a number of days (e.g. -1 for yesterday).
 */
export const getLocalDateString = (offsetDays = 0): string => {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
