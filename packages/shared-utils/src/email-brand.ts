/**
 * Which brand an email goes out under. Guardian (monitoring) emails carry the Guardian logo;
 * everything else carries nORBIT. Every email ends with the same NeuraVolt footer mark.
 */
export interface EmailBrand {
  key: 'guardian' | 'norbit';
  name: string;
  /** Empty when no hosted image exists: the header then shows a text wordmark instead of a broken image. */
  logoUrl: string;
  tagline: string;
  accent: string;
  watermarkUrl: string;
}

const GUARDIAN_TEMPLATES = /^(generic_alert|guardian_.*)$/;

export function emailBrand(template: string, variables: Record<string, any> = {}, env: Record<string, string | undefined> = process.env): EmailBrand {
  const assets = (env.EMAIL_ASSET_BASE_URL || env.WEB_URL || 'https://teams.neuravolt.in').replace(/\/+$/, '');
  const watermarkUrl = env.EMAIL_WATERMARK_URL || 'https://neuravolt.in/neuravolt-logo.svg';
  const guardian = variables.brand === 'guardian' || (variables.brand !== 'norbit' && GUARDIAN_TEMPLATES.test(String(template || '')));
  return guardian
    ? { key: 'guardian', name: 'Guardian', logoUrl: env.EMAIL_GUARDIAN_LOGO_URL || '', tagline: 'Always one step ahead', accent: '#ea580c', watermarkUrl }
    : { key: 'norbit', name: 'nORBIT', logoUrl: env.EMAIL_NORBIT_LOGO_URL || `${assets}/norbit-logo.png`, tagline: 'One platform. Your entire business.', accent: '#4f46e5', watermarkUrl };
}
