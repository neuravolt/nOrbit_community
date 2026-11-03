import { slugify } from './strings';

describe('slugify', () => {
  it('converts simple text to lowercase hyphenated slug', () => {
    expect(slugify('Fix login bug')).toBe('fix-login-bug');
  });

  it('removes special characters and symbols', () => {
    expect(slugify('Implement OAuth2.0 & SSO (Auth!)')).toBe('implement-oauth20-sso-auth');
  });

  it('collapses multiple consecutive spaces and hyphens', () => {
    expect(slugify('test   ---   slug --- string')).toBe('test-slug-string');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('---hello-world---')).toBe('hello-world');
  });

  it('handles empty strings gracefully', () => {
    expect(slugify('')).toBe('');
  });

  it('truncates length to 50 characters for safe branch names', () => {
    const long = 'a'.repeat(80);
    expect(slugify(long).length).toBe(50);
  });
});
