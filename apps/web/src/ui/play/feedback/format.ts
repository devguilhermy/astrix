/** Locale-aware text shared by the frame strip, its accessible label and the report. */

/** Hemisphere letters: Portuguese writes east and west as L (leste) and O (oeste). */
export function formatCoordinates(latDeg: number, lonDeg: number, locale: string | undefined): string {
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), pt = !!locale?.startsWith('pt');
  const lat = Math.round(Math.abs(latDeg) * 10) / 10, lon = Math.round(Math.abs(lonDeg) * 10) / 10;
  const north = lat === 0 || latDeg > 0, east = lon === 0 || lonDeg > 0;
  return `${number.format(lat)}°${north ? 'N' : 'S'} ${number.format(lon)}°${east ? pt ? 'L' : 'E' : pt ? 'O' : 'W'}`;
}

/** Same units as the play `Duration` component, as plain text for labels. */
export function formatElapsed(seconds: number, locale: string | undefined): string {
  const pt = !!locale?.startsWith('pt'), value = seconds >= 86400 ? seconds / 86400 : seconds >= 3600 ? seconds / 3600 : seconds >= 60 ? seconds / 60 : seconds;
  const singular = new Intl.PluralRules(locale).select(Math.round(value * 10) / 10) === 'one';
  const unit = seconds >= 86400 ? pt ? singular ? 'dia' : 'dias' : singular ? 'day' : 'days' : seconds >= 3600 ? 'h' : seconds >= 60 ? 'min' : 's';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

/** Signed quantity with a sign on every non-zero value, e.g. "+17.5" or "−0.4". */
export function formatSigned(value: number, locale: string | undefined, digits = 2): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(value);
}
