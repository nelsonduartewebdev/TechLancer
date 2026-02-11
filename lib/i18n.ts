/**
 * Lightweight i18n helpers.
 * Default locale: pt (Portugal). Can be extended with expo-localization.
 */

export type Locale = 'pt' | 'en';

let _locale: Locale = 'pt';

/** Get current app locale. Default: pt */
export function getLocale(): Locale {
  return _locale;
}

/** Set locale (e.g. from user preference or device) */
export function setLocale(locale: Locale): void {
  _locale = locale;
}

/** Pick localized label (label_pt / label_en) */
export function label(obj: { label_pt?: string; label_en?: string } | null | undefined): string {
  if (!obj) return '';
  const loc = getLocale();
  return (loc === 'pt' ? obj.label_pt : obj.label_en) || obj.label_pt || obj.label_en || '';
}

/** Pick localized description (description_pt / description_en / description) */
export function description(obj: Record<string, unknown> | null | undefined): string {
  if (!obj || typeof obj !== 'object') return '';
  const loc = getLocale();
  const pt = (obj.description_pt ?? obj.description) as string | null | undefined;
  const en = (obj.description_en ?? obj.description) as string | null | undefined;
  return (loc === 'pt' ? pt : en) || pt || en || '';
}
