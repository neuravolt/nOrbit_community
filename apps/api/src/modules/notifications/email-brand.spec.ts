import { emailBrand } from '@neuravolt/shared-utils';

describe('which brand an email goes out under', () => {
  const env = { EMAIL_ASSET_BASE_URL: 'https://teams.example.in/' };

  it('Guardian alerts carry the Guardian logo, everything else nORBIT', () => {
    expect(emailBrand('generic_alert', {}, env)).toMatchObject({
      key: 'guardian',
      logoUrl: '',
    }); // text wordmark until a logo is hosted
    expect(
      emailBrand(
        'generic_alert',
        {},
        { EMAIL_GUARDIAN_LOGO_URL: 'https://x/g.png' },
      ).logoUrl,
    ).toBe('https://x/g.png');
    expect(emailBrand('guardian_recovery', {}, env).key).toBe('guardian');
    expect(emailBrand('invoice_overdue', {}, env)).toMatchObject({
      key: 'norbit',
      logoUrl: 'https://teams.example.in/norbit-logo.png',
    });
  });

  it('a caller can pick the brand, and every email keeps the NeuraVolt footer mark', () => {
    expect(emailBrand('ticket_assigned', { brand: 'guardian' }, env).key).toBe(
      'guardian',
    );
    expect(emailBrand('generic_alert', { brand: 'norbit' }, env).key).toBe(
      'norbit',
    );
    expect(emailBrand('quote_sent', {}, {}).watermarkUrl).toBe(
      'https://neuravolt.in/neuravolt-logo.svg',
    );
  });
});
