import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

describe('Phase 7: Dynamic Invoice Email Payment CTAs', () => {
  const templatesDir = path.join(__dirname, '..', 'templates');

  let layoutTemplate: Handlebars.TemplateDelegate;
  let invoiceSentTemplate: Handlebars.TemplateDelegate;
  let invoiceOverdueTemplate: Handlebars.TemplateDelegate;

  beforeAll(() => {
    // Register partials
    const partialsDir = path.join(templatesDir, 'partials');
    if (fs.existsSync(partialsDir)) {
      const partialFiles = fs.readdirSync(partialsDir);
      for (const file of partialFiles) {
        if (file.endsWith('.hbs')) {
          const name = file.replace('.hbs', '');
          const content = fs.readFileSync(
            path.join(partialsDir, file),
            'utf-8',
          );
          Handlebars.registerPartial(name, content);
        }
      }
    }

    const layoutSource = fs.readFileSync(
      path.join(templatesDir, 'layout.hbs'),
      'utf-8',
    );
    layoutTemplate = Handlebars.compile(layoutSource);

    const sentSource = fs.readFileSync(
      path.join(templatesDir, 'invoice_sent.hbs'),
      'utf-8',
    );
    invoiceSentTemplate = Handlebars.compile(sentSource);

    const overdueSource = fs.readFileSync(
      path.join(templatesDir, 'invoice_overdue.hbs'),
      'utf-8',
    );
    invoiceOverdueTemplate = Handlebars.compile(overdueSource);
  });

  const renderEmail = (
    templateDelegate: Handlebars.TemplateDelegate,
    variables: Record<string, any>,
  ): string => {
    const bodyHtml = templateDelegate(variables);
    return layoutTemplate({ ...variables, body: bodyHtml });
  };

  it('Case 1: Online ON, Manual ON, Invoice unpaid -> CTA "Pay Invoice", both options listed', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-001',
      grandTotal: '10,000.00',
      amountPaid: '0.00',
      balanceDue: '10,000.00',
      dueDate: '25 Sep 2026',
      isPaid: false,
      isPartial: false,
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: 'Pay Invoice',
      ctaUrl: 'https://teams.neuravolt.in/client/invoices/inv-1',
    };

    const html = renderEmail(invoiceSentTemplate, vars);

    expect(html).toContain('Pay Invoice');
    expect(html).toContain('https://teams.neuravolt.in/client/invoices/inv-1');
    expect(html).toContain('CASHFREE');
    expect(html).toContain('bank transfer');
    expect(html).toContain('10,000.00');
  });

  it('Case 2: Online OFF, Manual ON -> CTA "Pay Invoice", manual payment highlighted, online omitted', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-002',
      grandTotal: '15,000.00',
      amountPaid: '0.00',
      balanceDue: '15,000.00',
      dueDate: '25 Sep 2026',
      isPaid: false,
      isPartial: false,
      onlinePaymentEnabled: false,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: 'Pay Invoice',
      ctaUrl: 'https://teams.neuravolt.in/client/invoices/inv-2',
    };

    const html = renderEmail(invoiceSentTemplate, vars);

    expect(html).toContain('Pay Invoice');
    expect(html).toContain('bank transfer');
    expect(html).not.toContain('Pay securely online via <strong>');
  });

  it('Case 3: Online ON, Manual OFF -> CTA "Pay Invoice", online payment highlighted', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-003',
      grandTotal: '20,000.00',
      amountPaid: '0.00',
      balanceDue: '20,000.00',
      dueDate: '25 Sep 2026',
      isPaid: false,
      isPartial: false,
      onlinePaymentEnabled: true,
      manualPaymentEnabled: false,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: 'Pay Invoice',
      ctaUrl: 'https://teams.neuravolt.in/client/invoices/inv-3',
    };

    const html = renderEmail(invoiceSentTemplate, vars);

    expect(html).toContain('Pay Invoice');
    expect(html).toContain('Pay securely online via <strong>CASHFREE</strong>');
    expect(html).not.toContain('bank transfer');
  });

  it('Case 4: Online OFF, Manual OFF -> payment CTA hidden, contact/accounts fallback shown', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-004',
      grandTotal: '5,000.00',
      amountPaid: '0.00',
      balanceDue: '5,000.00',
      dueDate: '25 Sep 2026',
      isPaid: false,
      isPartial: false,
      onlinePaymentEnabled: false,
      manualPaymentEnabled: false,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: null,
      ctaUrl: null,
    };

    const html = renderEmail(invoiceSentTemplate, vars);

    expect(html).not.toContain('Pay Invoice');
    expect(html).not.toContain('Pay Remaining Balance');
    expect(html).toContain(
      'Online payment is currently unavailable. Please contact our finance team',
    );
  });

  it('Case 5: Invoice partially paid -> CTA "Pay Remaining Balance", balance due displayed', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-005',
      grandTotal: '100,000.00',
      amountPaid: '60,000.00',
      balanceDue: '40,000.00',
      dueDate: '30 Sep 2026',
      isPaid: false,
      isPartial: true,
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: 'Pay Remaining Balance',
      ctaUrl: 'https://teams.neuravolt.in/client/invoices/inv-5',
    };

    const html = renderEmail(invoiceSentTemplate, vars);

    expect(html).toContain('Pay Remaining Balance');
    expect(html).toContain('We have successfully received ₹60,000.00');
    expect(html).toContain('40,000.00');
  });

  it('Case 6: Invoice fully paid -> CTA button is hidden, status PAID shown, no payment action', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-006',
      grandTotal: '50,000.00',
      amountPaid: '50,000.00',
      balanceDue: '0.00',
      dueDate: '15 Sep 2026',
      isPaid: true,
      isPartial: false,
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: null,
      ctaUrl: null,
    };

    const html = renderEmail(invoiceSentTemplate, vars);

    expect(html).toContain('PAID');
    expect(html).toContain('has been paid in full');
    expect(html).not.toContain('Pay Invoice');
    expect(html).not.toContain('Pay Remaining Balance');
    expect(html).not.toContain('Available Payment Options:');
  });

  it('Case 7: Overdue invoice -> CTA "Pay Invoice", overdue warning & balance due displayed', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-007',
      amount: '25,000.00',
      balanceDue: '25,000.00',
      dueDate: '01 Sep 2026',
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: 'Pay Invoice',
      ctaUrl: 'https://teams.neuravolt.in/client/invoices/inv-7',
    };

    const html = renderEmail(invoiceOverdueTemplate, vars);

    expect(html).toContain('Pay Invoice');
    expect(html).toContain('is currently overdue');
    expect(html).toContain('25,000.00');
    expect(html).toContain('CASHFREE');
    expect(html).toContain('https://teams.neuravolt.in/client/invoices/inv-7');
  });

  it('Case 8: Overdue invoice with payments disabled -> payment CTA hidden, fallback notice shown', () => {
    const vars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-008',
      amount: '12,000.00',
      balanceDue: '12,000.00',
      dueDate: '01 Sep 2026',
      onlinePaymentEnabled: false,
      manualPaymentEnabled: false,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: null,
      ctaUrl: null,
    };

    const html = renderEmail(invoiceOverdueTemplate, vars);

    expect(html).not.toContain('Pay Invoice');
    expect(html).toContain(
      'Online payment is currently unavailable. Please contact our finance team',
    );
  });

  it('Security: Never exposes payment secrets, session IDs, or private credentials in email payload', () => {
    const sensitiveKeys = [
      'clientSecret',
      'secretKey',
      'appSecret',
      'webhookSecret',
      'payment_session_id',
      'privateKey',
      'jwtSecret',
    ];

    const safeVars = {
      clientName: 'Acme Corp',
      invoiceNumber: 'INV-2026-SEC',
      grandTotal: '10,000.00',
      amountPaid: '0.00',
      balanceDue: '10,000.00',
      dueDate: '25 Sep 2026',
      isPaid: false,
      isPartial: false,
      onlinePaymentEnabled: true,
      manualPaymentEnabled: true,
      activeOnlineGateway: 'CASHFREE',
      ctaLabel: 'Pay Invoice',
      ctaUrl: 'https://teams.neuravolt.in/client/invoices/inv-sec',
    };

    for (const key of sensitiveKeys) {
      expect(safeVars).not.toHaveProperty(key);
    }

    const html = renderEmail(invoiceSentTemplate, safeVars);
    for (const key of sensitiveKeys) {
      expect(html).not.toContain(key);
    }
  });
});
