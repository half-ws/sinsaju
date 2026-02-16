/**
 * Longitude-based time correction for Korean saju calculation.
 *
 * KST reference meridian: 135°E
 * Correction: (longitude - 135) × 4 minutes per degree
 *
 * For Korean locations (typically 126~130°E):
 * - Seoul (127.0°): -32 min
 * - Busan (129.0°): -24 min
 * - Jeju (126.5°): -34 min
 */

const KST_MERIDIAN = 135; // degrees East

/**
 * Calculate the time correction in minutes for a given longitude.
 * Negative means the true solar time is earlier than clock time.
 *
 * @param {number} longitude - Degrees East (e.g., 127.0 for Seoul)
 * @returns {number} Correction in minutes
 */
export function longitudeCorrection(longitude) {
  return (longitude - KST_MERIDIAN) * 4;
}

/**
 * Apply longitude correction to a birth date/time.
 * Returns adjusted hour and minute.
 *
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {number} longitude
 * @returns {{ year, month, day, hour, minute, correctionMinutes }}
 */
export function applyLongitudeCorrection(year, month, day, hour, minute, longitude) {
  const correction = longitudeCorrection(longitude);
  const totalMinutes = hour * 60 + minute + correction;

  let adjDay = day;
  let adjMonth = month;
  let adjYear = year;
  let adjMinutes = totalMinutes;

  // Handle day overflow/underflow
  if (adjMinutes < 0) {
    adjMinutes += 24 * 60;
    adjDay -= 1;
    if (adjDay < 1) {
      adjMonth -= 1;
      if (adjMonth < 1) {
        adjMonth = 12;
        adjYear -= 1;
      }
      adjDay = new Date(adjYear, adjMonth, 0).getDate(); // last day of prev month
    }
  } else if (adjMinutes >= 24 * 60) {
    adjMinutes -= 24 * 60;
    adjDay += 1;
    const maxDay = new Date(adjYear, adjMonth, 0).getDate();
    if (adjDay > maxDay) {
      adjDay = 1;
      adjMonth += 1;
      if (adjMonth > 12) {
        adjMonth = 1;
        adjYear += 1;
      }
    }
  }

  const adjHour = Math.floor(adjMinutes / 60);
  const adjMinute = Math.round(adjMinutes % 60);

  return {
    year: adjYear,
    month: adjMonth,
    day: adjDay,
    hour: adjHour,
    minute: adjMinute,
    correctionMinutes: Math.round(correction),
    originalTime: `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,
    correctedTime: `${String(adjHour).padStart(2,'0')}:${String(adjMinute).padStart(2,'0')}`,
  };
}

/**
 * Common Korean city longitudes for quick selection.
 */
export const KOREAN_CITIES = {
  '서울': 126.98,
  '부산': 129.08,
  '대구': 128.60,
  '인천': 126.71,
  '광주': 126.85,
  '대전': 127.38,
  '울산': 129.31,
  '세종': 127.01,
  '제주': 126.53,
  '수원': 127.01,
  '창원': 128.68,
  '전주': 127.15,
  '청주': 127.49,
  '춘천': 127.73,
  '포항': 129.37,
};
