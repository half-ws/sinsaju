/**
 * Longitude-based time correction for saju calculation.
 *
 * Correction formula: (longitude - standard_meridian) × 4 minutes per degree
 *
 * Each timezone has a standard meridian:
 * - KST/JST (UTC+9): 135°E
 * - CST China (UTC+8): 120°E
 * - EST (UTC-5): -75°
 * - CST US (UTC-6): -90°
 * - PST (UTC-8): -120°
 * - GMT (UTC+0): 0°
 * - CET (UTC+1): 15°E
 */

/**
 * Location data: countries with standard meridians and major cities.
 * Longitude is in degrees (positive = East, negative = West).
 */
export const LOCATIONS = {
  '한국': {
    meridian: 135,
    cities: {
      '서울': 126.98, '부산': 129.08, '대구': 128.60,
      '인천': 126.71, '광주': 126.85, '대전': 127.38,
      '울산': 129.31, '세종': 127.01, '제주': 126.53,
      '수원': 127.01, '창원': 128.68, '전주': 127.15,
      '청주': 127.49, '춘천': 127.73, '포항': 129.37,
    }
  },
  '일본': {
    meridian: 135,
    cities: {
      '도쿄': 139.69, '오사카': 135.50, '나고야': 136.91,
      '삿포로': 141.35, '후쿠오카': 130.42, '교토': 135.77,
      '요코하마': 139.64, '고베': 135.20,
    }
  },
  '중국': {
    meridian: 120,
    cities: {
      '베이징': 116.41, '상하이': 121.47, '광저우': 113.26,
      '선전': 114.06, '청두': 104.07, '시안': 108.94,
      '항저우': 120.15, '난징': 118.80,
    }
  },
  '대만': {
    meridian: 120,
    cities: {
      '타이베이': 121.56, '가오슝': 120.31, '타이중': 120.68,
    }
  },
  '미국 동부': {
    meridian: -75,
    cities: {
      '뉴욕': -74.01, '워싱턴DC': -77.04, '보스턴': -71.06,
      '필라델피아': -75.17, '마이애미': -80.19, '애틀랜타': -84.39,
    }
  },
  '미국 중부': {
    meridian: -90,
    cities: {
      '시카고': -87.63, '휴스턴': -95.37, '댈러스': -96.80,
      '미니애폴리스': -93.27, '디트로이트': -83.05,
    }
  },
  '미국 서부': {
    meridian: -120,
    cities: {
      '로스앤젤레스': -118.24, '샌프란시스코': -122.42,
      '시애틀': -122.33, '포틀랜드': -122.68,
      '라스베이거스': -115.14, '샌디에이고': -117.16,
    }
  },
  '영국': {
    meridian: 0,
    cities: {
      '런던': -0.12, '맨체스터': -2.24, '에든버러': -3.19,
      '버밍엄': -1.90, '리버풀': -2.99,
    }
  },
  '독일': {
    meridian: 15,
    cities: {
      '베를린': 13.41, '뮌헨': 11.58, '함부르크': 9.99,
      '프랑크푸르트': 8.68, '쾰른': 6.96,
    }
  },
  '프랑스': {
    meridian: 15,
    cities: {
      '파리': 2.35, '마르세유': 5.37, '리옹': 4.83, '니스': 7.26,
    }
  },
  '캐나다': {
    meridian: -75,
    cities: {
      '토론토': -79.38, '밴쿠버': -123.12, '몬트리올': -73.57,
      '오타와': -75.70, '캘거리': -114.07,
    }
  },
};

/**
 * Get the standard meridian for a country name.
 * @param {string} country - Country name (key of LOCATIONS)
 * @returns {number} Standard meridian in degrees
 */
export function getMeridian(country) {
  return LOCATIONS[country]?.meridian ?? 135;
}

/**
 * Calculate the time correction in minutes for a given longitude.
 * Negative means the true solar time is earlier than clock time.
 *
 * @param {number} longitude - Degrees (positive = East, negative = West)
 * @param {number} [meridian=135] - Standard meridian for the timezone
 * @returns {number} Correction in minutes
 */
export function longitudeCorrection(longitude, meridian = 135) {
  return (longitude - meridian) * 4;
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
 * @param {number} [meridian=135] - Standard meridian for the timezone
 * @returns {{ year, month, day, hour, minute, correctionMinutes, originalTime, correctedTime }}
 */
export function applyLongitudeCorrection(year, month, day, hour, minute, longitude, meridian = 135) {
  const correction = longitudeCorrection(longitude, meridian);
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
      adjDay = new Date(adjYear, adjMonth, 0).getDate();
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
 * Common Korean city longitudes (backward compatibility).
 */
export const KOREAN_CITIES = LOCATIONS['한국'].cities;
