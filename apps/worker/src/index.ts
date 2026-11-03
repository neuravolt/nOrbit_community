import { Worker, Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { prisma } from '@neuravolt/shared-prisma';
import { emailBrand } from '@neuravolt/shared-utils';

// Phase 5A (AI Worker Fail-Closed, Step 3): the generation/failure logic itself lives in
// ai-generation-job-processor.ts, which has no import-time side effects (no Redis connection,
// no Worker registration) so it can be unit-tested directly — see
// ai-generation-job-processor.spec.ts. This file only wires it into the live queue below.
import {
  getGeminiApiKey,
  callGemini,
  getPromptMapping,
  processAiGenerationJob,
} from './ai-generation-job-processor';

// Phase 5A (AI Worker Fail-Closed) — residual item: the same fail-open pattern in
// codeReviewWorker below, extracted the same way for the same testability reason.
import { getCodeReviewOutcome } from './code-review-outcome';
import { fenceUntrustedContent } from './prompt-fencing';

// Load .env — try cwd first, then walk up to monorepo root
dotenv.config();
(function loadParentEnv() {
  const envVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'DATABASE_URL', 'REDIS_URL'];
  const alreadyLoaded = envVars.some(k => !!process.env[k]);
  if (alreadyLoaded) return;
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 6; i++) {
    dir = path.dirname(dir);
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      console.log(`[Worker] Loaded env from: ${candidate}`);
      break;
    }
  }
})();
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPass = process.env.SMTP_PASS?.trim();
const hasSmtpAuth = !!(smtpUser && smtpPass);

console.log(
  `Worker SMTP startup: host=${process.env.SMTP_HOST || '127.0.0.1'}, port=${process.env.SMTP_PORT || '25'}, auth=${hasSmtpAuth ? `enabled (${smtpUser})` : 'none (relay)'}`
);

// Standard Handlebars helpers
Handlebars.registerHelper('formatDate', (date: any) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
});

Handlebars.registerHelper('formatCurrency', (amount: any) => {
  if (amount === undefined || amount === null) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

Handlebars.registerHelper('formatNumber', (n: any) => {
  if (n === undefined || n === null) return '0';
  return Number(n).toLocaleString('en-IN');
});

Handlebars.registerHelper('add', (a: number, b: number) => a + b);
Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '127.0.0.1',
  port: parseInt(process.env.SMTP_PORT || '25', 10),
  secure: process.env.SMTP_SECURE === 'true',
  ...(hasSmtpAuth
    ? {
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      }
    : {}),
  tls: {
    rejectUnauthorized: false,
  },
});

// Fallback HTML templates for 100% backward compatibility
const fallbackTemplates: Record<string, (data: any) => string> = {
  ticket_assigned: (data) => `
    <h2>Hello ${data.userName},</h2>
    <p>A new ticket has been assigned to you.</p>
    <div style="background: #f4f4f4; padding: 15px; border-left: 4px solid #0052cc; margin: 20px 0;">
      <strong>Ticket:</strong> ${data.ticketTitle}<br>
      <strong>Priority:</strong> ${data.priority ?? 'MEDIUM'}
    </div>
    <p>Please log in to NeuraVolt OS to view the details.</p>
  `,
  ticket_commented: (data) => `
    <h2>Hello,</h2>
    <p>A new comment has been posted on the ticket <strong>"${data.ticketTitle}"</strong>.</p>
    <p>Please click the button below to view the ticket.</p>
  `,
  invoice_overdue: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #d93025;">Hello ${data.clientName},</h2>
      <p>This is a reminder that invoice <strong>${data.invoiceNumber}</strong> is currently overdue.</p>
      <p>Amount Due: $${data.amount}</p>
      <p>Please process the payment at your earliest convenience.</p>
    </div>
  `,
  amc_renewal: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hello ${data.clientName},</h2>
      <p>Your Annual Maintenance Contract (AMC) is expiring soon.</p>
      <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <strong>Contract:</strong> ${data.contractName || data.contractNumber}<br>
        <strong>Expiry Date:</strong> ${data.expiryDate || data.endDate}
      </div>
    </div>
  `,
  generic_alert: (data) => {
    const raw = String(data.severity || 'WARNING').toUpperCase();
    const severity = /^(RESOLVED|NORMAL|RECOVERED)$/.test(raw) ? 'RESOLVED' : raw;
    const tone = severity === 'RESOLVED' ? ['#ecfdf5', '#047857', '#a7f3d0'] : /CRITICAL|EMERGENCY/.test(severity) ? ['#fef2f2', '#b91c1c', '#fecaca'] : severity === 'WARNING' ? ['#fffbeb', '#b45309', '#fde68a'] : ['#f1f5f9', '#475569', '#e2e8f0'];
    const consoleUrl = data.consoleUrl || `${process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in'}/guardian`;
    // Never leak raw model errors into a client email.
    const message = String(data.message || '')
      .replace(/Failed to invoke AI Assistant:[^\n]*/gi, 'Autonomous SRE Telemetry Evaluated.')
      .replace(/Gemini[^\n]*/gi, '')
      .replace(/\\n/g, '\n');
    return `
    <div style="color: #0f172a;">
      <span style="display: inline-block; padding: 3px 10px; font-size: 11px; font-weight: 700; border-radius: 9999px; background-color: ${tone[0]}; color: ${tone[1]}; border: 1px solid ${tone[2]};">${severity}</span>
      <h2 style="margin: 12px 0 4px 0; font-size: 18px; line-height: 1.35; color: #0f172a;">${data.title || 'Guardian alert'}</h2>
      ${data.targetName ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 14px;">${data.targetName}</div>` : ''}
      <div style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line; margin-bottom: 16px;">${message}</div>
      ${data.suggestedRemediation ? `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;"><div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">Suggested fix — needs approval, not run</div><div style="font-size: 12px; font-family: monospace; color: #0f172a; word-break: break-all;">${data.suggestedRemediation}</div></div>` : ''}
      <a href="${consoleUrl}" target="_blank" style="display: inline-block; background-color: ${data.brand?.accent || '#ea580c'}; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 13px; font-weight: 600; border-radius: 8px;">Open this alert →</a>
    </div>
    `;
  },
  project_deadline: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hello ${data.userName},</h2>
      <p>A project deadline is approaching within the next 48 hours.</p>
      <div style="background: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
        <strong>Project:</strong> ${data.projectName}<br>
        <strong>Deadline:</strong> ${data.deadline}
      </div>
    </div>
  `,
  quote_sent: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hello ${data.clientName},</h2>
      <p>Please find attached the quotation <strong>${data.quoteNumber}</strong>: <strong>${data.title}</strong>.</p>
      <p>Valid Until: ${data.validUntil}</p>
    </div>
  `,
  api_key_otp: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">View API Secret Key</h2>
        <p style="font-size: 13px; color: #64748b; margin: 0;">Verification code for product <strong>${data.appName || data.appId}</strong></p>
      </div>
      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0; border: 1px dashed #cbd5e1;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; display: block; margin-bottom: 10px;">Verification OTP Code</span>
        <span style="font-family: 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; display: inline-block;">${data.otp}</span>
        <p style="font-size: 11px; color: #94a3b8; margin: 12px 0 0 0;">Expires in 10 minutes. Please do not share this OTP with anyone.</p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 16px 0 0 0;">If you didn't request this verification code, please ignore this email or review your NeuraVolt OS security logs.</p>
    </div>
  `,
  invoice_sent: (data) => {
    if (data.isPaid) {
      return `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hello ${data.clientName},</h2>
          <p>Thank you for your payment.</p>
          <p>We confirm that Invoice <strong>${data.invoiceNumber}</strong> has been paid in full.</p>
          <p><strong>Invoice Number:</strong> ${data.invoiceNumber}<br>
             <strong>Grand Total:</strong> ₹${data.grandTotal}<br>
             <strong>Amount Paid:</strong> ₹${data.amountPaid}<br>
             <strong>Balance Due:</strong> ₹${data.balanceDue}<br>
             <strong>Payment Status:</strong> PAID</p>
          <p>Please find the paid invoice attached for your records.</p>
        </div>
      `;
    } else if (data.isPartial) {
      return `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hello ${data.clientName},</h2>
          <p>Thank you for your payment.</p>
          <p>We have successfully received ₹${data.amountPaid} against Invoice <strong>${data.invoiceNumber}</strong>.</p>
          <p><strong>Invoice Number:</strong> ${data.invoiceNumber}<br>
             <strong>Grand Total:</strong> ₹${data.grandTotal}<br>
             <strong>Amount Paid:</strong> ₹${data.amountPaid}<br>
             <strong>Balance Due:</strong> ₹${data.balanceDue}<br>
             <strong>Due Date:</strong> ${data.dueDate}</p>
          <p>Please find the updated invoice attached.</p>
        </div>
      `;
    } else {
      return `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hello ${data.clientName},</h2>
          <p>Please find attached Invoice <strong>${data.invoiceNumber}</strong>.</p>
          <p><strong>Invoice Number:</strong> ${data.invoiceNumber}<br>
             <strong>Total Amount:</strong> ₹${data.grandTotal}<br>
             <strong>Amount Paid:</strong> ₹${data.amountPaid}<br>
             <strong>Balance Due:</strong> ₹${data.balanceDue}<br>
             <strong>Due Date:</strong> ${data.dueDate}</p>
          <p>Please complete the payment before the due date.</p>
        </div>
      `;
    }
  },
  amc_hours_consumed: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Alert: AMC Hours Consumption</h2>
      <p>AMC contract <strong>${data.contractNumber}</strong> has consumed over 80% of its hours.</p>
      <p>Used Hours: ${data.usedHours} / ${data.totalHours}</p>
    </div>
  `,
  client_portal_access_created: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0052cc; margin-top: 0;">Welcome to the NeuraVolt Client Portal!</h2>
      <p>Hello ${data.clientName},</p>
      <p>Your access to the NeuraVolt Client Portal has been successfully created. You can now log in to monitor your active projects, submit support tickets, review quotes, and pay invoices.</p>
      <div style="background: #f4f6f9; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0052cc;">
        <strong style="display: block; margin-bottom: 8px; color: #333;">Your Logins:</strong>
        <strong>Email:</strong> ${data.email}<br>
        <strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace;">${data.password}</code>
      </div>
      <p>Please click the button below to access the portal and update your password on your first login:</p>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${data.loginUrl}" style="background: #0052cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Access Client Portal</a>
      </div>
      <p style="font-size: 11px; color: #777; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px;">This is an automated notification from NeuraVolt OS. Please do not reply directly to this email.</p>
    </div>
  `,
  launchpad_student_applied: (data) => `
    <div style="font-family: Arial, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 40px;">🚀</span>
        <h1 style="color: #6366f1; margin: 10px 0 0; font-size: 26px;">NeuraVolt LaunchPad</h1>
        <p style="color: #9ca3af; margin: 5px 0 0;">Application Received</p>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; padding: 25px; border-radius: 8px;">
        <h2 style="color: #f3f4f6; margin-top: 0; font-size: 20px;">Hi ${data.studentName},</h2>
        <p style="line-height: 1.6; color: #d1d5db;">Thank you for applying to the NeuraVolt LaunchPad program! We are excited to review your application.</p>
        <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #d1d5db;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #9ca3af; width: 120px;">Selected Track:</td>
              <td style="padding: 6px 0; color: #818cf8;">${data.trackName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #9ca3af;">Applied Date:</td>
              <td style="padding: 6px 0;">${new Date().toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #9ca3af;">Review Time:</td>
              <td style="padding: 6px 0; color: #34d399;">3 Business Days</td>
            </tr>
          </table>
        </div>
        <p style="line-height: 1.6; color: #9ca3af; font-size: 14px;">We will perform a screening of your profile and get back to you with a decision shortly. Once approved, you will receive your login details via email.</p>
      </div>
      <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937; padding-top: 20px;">
        This is an automated notification from NeuraVolt LaunchPad. Support: ${data.supportEmail ?? 'launchpad@neuravolt.in'}
      </div>
    </div>
  `,
  launchpad_student_approved: (data) => `
    <div style="font-family: Arial, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 40px;">🎉</span>
        <h1 style="color: #10b981; margin: 10px 0 0; font-size: 26px;">Application Approved!</h1>
        <p style="color: #9ca3af; margin: 5px 0 0;">Welcome to NeuraVolt LaunchPad</p>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; padding: 25px; border-radius: 8px;">
        <h2 style="color: #f3f4f6; margin-top: 0; font-size: 20px;">Congratulations ${data.studentName},</h2>
        <p style="line-height: 1.6; color: #d1d5db;">We are thrilled to inform you that your application for the <strong>${data.trackName}</strong> track has been approved! You are now an active candidate in our incubation program.</p>
        
        <div style="background: #1f2937; padding: 18px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
          <strong style="display: block; margin-bottom: 8px; color: #f3f4f6; font-size: 15px;">Your Login Credentials:</strong>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #d1d5db;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #9ca3af; width: 150px;">Portal Username/Email:</td>
              <td style="padding: 4px 0; color: #818cf8; word-break: break-all;">${data.email}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">Temporary Password:</td>
              <td style="padding: 4px 0;"><code style="background: #0f172a; border: 1px solid #374151; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #34d399; font-family: monospace;">${data.temporaryPassword}</code></td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">Password Validity:</td>
              <td style="padding: 4px 0; color: #f59e0b;">48 Hours (Please reset on first login)</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0 15px;">
          <a href="${data.loginUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">Log In to LaunchPad Portal</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937; padding-top: 20px;">
        This is an automated security email. Do not share your password with anyone.
      </div>
    </div>
  `,
  launchpad_student_forgot_password: (data) => `
    <div style="font-family: Arial, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 40px;">🔑</span>
        <h1 style="color: #818cf8; margin: 10px 0 0; font-size: 26px;">Password Reset Requested</h1>
        <p style="color: #9ca3af; margin: 5px 0 0;">NeuraVolt LaunchPad Security</p>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; padding: 25px; border-radius: 8px;">
        <h2 style="color: #f3f4f6; margin-top: 0; font-size: 20px;">Hi ${data.studentName},</h2>
        <p style="line-height: 1.6; color: #d1d5db;">You have requested to reset your account password. A new temporary password has been generated for you.</p>
        
        <div style="background: #1f2937; padding: 18px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #818cf8;">
          <strong style="display: block; margin-bottom: 8px; color: #f3f4f6; font-size: 15px;">Your New Login Credentials:</strong>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #d1d5db;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #9ca3af; width: 150px;">Portal Username/Email:</td>
              <td style="padding: 4px 0; color: #818cf8; word-break: break-all;">${data.email}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">Temporary Password:</td>
              <td style="padding: 4px 0;"><code style="background: #0f172a; border: 1px solid #374151; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #34d399; font-family: monospace;">${data.temporaryPassword}</code></td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">Password Validity:</td>
              <td style="padding: 4px 0; color: #f59e0b;">24 Hours (Please reset on login)</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0 15px;">
          <a href="${data.loginUrl}" style="background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);">Log In to LaunchPad</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937; padding-top: 20px;">
        If you did not request this password reset, please contact support immediately.
      </div>
    </div>
  `,
  launchpad_student_rejected: (data) => `
    <div style="font-family: Arial, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 40px;">✍️</span>
        <h1 style="color: #ef4444; margin: 10px 0 0; font-size: 26px;">Application Status Update</h1>
        <p style="color: #9ca3af; margin: 5px 0 0;">NeuraVolt LaunchPad Screening</p>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; padding: 25px; border-radius: 8px;">
        <h2 style="color: #f3f4f6; margin-top: 0; font-size: 20px;">Hi ${data.studentName},</h2>
        <p style="line-height: 1.6; color: #d1d5db;">Thank you for your interest in the NeuraVolt LaunchPad program. After careful screening of your application, we regret to inform you that we are unable to accept you into the program at this time.</p>
        
        <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <strong style="display: block; margin-bottom: 5px; color: #f3f4f6;">Feedback from Reviewer:</strong>
          <p style="margin: 0; font-size: 14px; color: #d1d5db; line-height: 1.5;">${data.rejectionReason}</p>
        </div>

        <div style="background: #181c25; padding: 15px; border-radius: 6px; font-size: 14px; color: #9ca3af; line-height: 1.5;">
          <strong>Reapplication Policy:</strong><br>
          You are eligible to reapply starting <strong>${data.reapplyDate}</strong>.
          <br><br>
          <em>${data.reapplyInstructions}</em>
        </div>
      </div>
      <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937; padding-top: 20px;">
        We appreciate your efforts and wish you the best of luck in your future endeavors.
      </div>
    </div>
  `,
  hr_document_sent: (data) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0052cc;">HR Document: ${data.documentTitle}</h2>
      <p>Dear ${data.employeeName},</p>
      <p>Please find your HR document <strong>${data.documentTitle}</strong> attached to this email.</p>
      <p style="font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 12px; margin-top: 24px;">This is an automated notification from NeuraVolt OS.</p>
    </div>
  `,
  employee_invite: (data) => `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px 16px; max-width: 580px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="margin-bottom: 24px; text-align: center;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">${data.companyName || 'NeuraVolt'}</h1>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Employee Workspace & HRMS Portal</p>
      </div>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 12px;">Welcome to the team, ${data.firstName || ''}</h2>
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: #334155;">
          Your official workspace account has been created. You can manage your daily attendance, leave requests, assigned tasks, payslips, and HR documents.
        </p>
        <div style="background: #f1f5f9; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 6px; margin: 18px 0; font-size: 13px;">
          <div><strong>Portal URL:</strong> <a href="https://teams.neuravolt.in/login" style="color: #4f46e5; text-decoration: underline;">https://teams.neuravolt.in/login</a></div>
          <div style="margin-top: 4px;"><strong>Login Email:</strong> <span style="font-family: monospace;">${data.email || 'Your official email'}</span></div>
        </div>
        <p style="margin: 0 0 16px; font-size: 13px; color: #475569;">
          To activate your account and choose your personal password, click the button below (link expires in ${data.validDays || 7} days):
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.inviteUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(79,70,229,0.3);">Activate Account & Set Password</a>
        </div>
        <p style="font-size: 11px; color: #94a3b8; word-break: break-all; margin: 0;">
          If the button does not work, copy and paste this link in your browser:<br/>
          <a href="${data.inviteUrl}" style="color: #64748b;">${data.inviteUrl}</a>
        </p>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 20px;">
        Automated notification from ${data.companyName || 'NeuraVolt'} OS.
      </p>
    </div>
  `,
  leave_approved: (data) => `
    <div style="font-family: Arial, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 40px;">✅</span>
        <h1 style="color: #10b981; margin: 10px 0 0; font-size: 26px;">Leave Request Approved</h1>
        <p style="color: #9ca3af; margin: 5px 0 0;">NeuraVolt HRMS — Leave Management</p>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; padding: 25px; border-radius: 8px;">
        <h2 style="color: #f3f4f6; margin-top: 0; font-size: 20px;">Hi ${data.employeeName},</h2>
        <p style="line-height: 1.6; color: #d1d5db;">Your leave request has been <strong style="color: #10b981;">APPROVED</strong> by HR.</p>
        <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #d1d5db;">
            <tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af; width: 140px;">Leave Type:</td><td>${data.leaveType}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">From:</td><td>${data.startDate}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">To:</td><td>${data.endDate}</td></tr>
            ${data.remarks ? `<tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">Remarks:</td><td>${data.remarks}</td></tr>` : ''}
          </table>
        </div>
        <p style="color: #9ca3af; font-size: 13px;">Please log in to the NeuraVolt OS portal to view your leave history.</p>
      </div>
      <p style="font-size: 11px; color: #6b7280; text-align: center; margin-top: 20px;">Automated notification from NeuraVolt HRMS.</p>
    </div>
  `,
  leave_rejected: (data) => `
    <div style="font-family: Arial, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 40px;">❌</span>
        <h1 style="color: #ef4444; margin: 10px 0 0; font-size: 26px;">Leave Request Rejected</h1>
        <p style="color: #9ca3af; margin: 5px 0 0;">NeuraVolt HRMS — Leave Management</p>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; padding: 25px; border-radius: 8px;">
        <h2 style="color: #f3f4f6; margin-top: 0; font-size: 20px;">Hi ${data.employeeName},</h2>
        <p style="line-height: 1.6; color: #d1d5db;">Unfortunately, your leave request has been <strong style="color: #ef4444;">REJECTED</strong> by HR.</p>
        <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #d1d5db;">
            <tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af; width: 140px;">Leave Type:</td><td>${data.leaveType}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">From:</td><td>${data.startDate}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">To:</td><td>${data.endDate}</td></tr>
            ${data.remarks ? `<tr><td style="padding: 4px 0; font-weight: bold; color: #9ca3af;">Reason:</td><td style="color: #fca5a5;">${data.remarks}</td></tr>` : ''}
          </table>
        </div>
        <p style="color: #9ca3af; font-size: 13px;">If you have any questions, please contact HR directly.</p>
      </div>
      <p style="font-size: 11px; color: #6b7280; text-align: center; margin-top: 20px;">Automated notification from NeuraVolt HRMS.</p>
    </div>
  `,
  custom_message: (data) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
      ${data.body || data.message || ''}
    </div>
  `,
  mailbox_compose: (data) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
      ${data.body || data.message || ''}
    </div>
  `,
  mailbox_reply: (data) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
      ${data.body || data.message || ''}
    </div>
  `,
  email_verification: (data) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Hello ${data.userName || 'there'},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Welcome to <strong>nORBIT</strong> — The Sovereign Autonomous Enterprise Operations Platform.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Please click the button below to verify your email address and activate your organization workspace:
      </p>
      <div style="margin: 28px 0;">
        <a href="${data.verificationUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
          Verify Email Address →
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        Or copy and paste this verification URL into your browser:<br>
        <span style="color: #2563eb; word-break: break-all; font-family: monospace;">${data.verificationUrl}</span>
      </p>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 16px;">
        This verification link will expire in 24 hours. If you did not create this account, please ignore this email.
      </p>
    </div>
  `,
  password_reset: (data) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Hello ${data.userName || 'there'},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        We received a request to reset your password for your <strong>nORBIT</strong> workspace account.
      </p>
      <div style="margin: 28px 0;">
        <a href="${data.resetUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
          Reset My Password →
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        Or copy and paste this URL into your browser:<br>
        <span style="color: #2563eb; word-break: break-all; font-family: monospace;">${data.resetUrl}</span>
      </p>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 16px;">
        This reset link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  `
};

// Resolve email templates directory
const getTemplateDir = () => {
  const envPath = process.env.EMAIL_TEMPLATES_PATH;
  if (envPath) return envPath;

  // Dev path relative to worker root in monorepo
  const devPath = path.join(process.cwd(), '..', 'api', 'src', 'modules', 'notifications', 'templates');
  if (fs.existsSync(devPath)) return devPath;

  // Fallback to local templates folder (e.g. standalone production build)
  return path.join(process.cwd(), 'templates');
};

// Dynamically register partials
const registerPartials = (templateDir: string) => {
  const partialsDir = path.join(templateDir, 'partials');
  if (fs.existsSync(partialsDir)) {
    const files = fs.readdirSync(partialsDir);
    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const name = path.basename(file, '.hbs');
        const content = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
        Handlebars.registerPartial(name, content);
      }
    }
  }
};

// Inline fallback bodies get the same light shell (brand logo, fixed NeuraVolt footer) as the .hbs templates.
const wrapInLayout = (bodyHtml: string, context: Record<string, any>, templateDir: string): string => {
  if (/<html/i.test(bodyHtml)) return bodyHtml;
  const layoutPath = path.join(templateDir, 'layout.hbs');
  if (fs.existsSync(layoutPath)) {
    registerPartials(templateDir);
    return Handlebars.compile(fs.readFileSync(layoutPath, 'utf-8'))({ ...context, body: bodyHtml });
  }
  const { brand, company, currentYear } = context;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;">
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:32px 12px;"><tr><td align="center">
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
<tr><td style="height:3px;line-height:3px;font-size:0;background-color:${brand.accent};">&nbsp;</td></tr>
<tr><td style="padding:20px 32px;border-bottom:1px solid #f1f5f9;">${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${brand.name}" height="34" style="height:34px;width:auto;display:block;border:0;">` : `<div style="font-size:24px;font-weight:800;color:${brand.accent};">${brand.name}</div><div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-top:4px;">${brand.tagline || ""}</div>`}</td></tr>
<tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td align="center" style="padding:24px 32px;background-color:#fbfcfd;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
<img src="${brand.watermarkUrl}" alt="NeuraVolt" height="30" style="height:30px;width:auto;display:block;margin:0 auto 10px auto;border:0;">
&copy; ${currentYear} ${company?.companyName || 'NeuraVolt'}</td></tr>
</table></td></tr></table></body></html>`;
};

// Retrieve company profile settings
const getCompanyProfile = async () => {
  try {
    const profile = await prisma.companyProfile.findFirst();
    if (profile) {
      const port = process.env.API_PORT || 3001;
      const apiBase = process.env.API_BASE_URL || `http://localhost:${port}`;
      const getFullUrl = (url: string | null | undefined) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `${apiBase}${url}`;
      };
      return {
        ...profile,
        logoUrl: getFullUrl(profile.logoUrl),
        signatureUrl: getFullUrl(profile.signatureUrl),
        stampUrl: getFullUrl(profile.stampUrl),
      };
    }
  } catch (err) {
    console.error('Failed to load company profile, using fallback defaults', err);
  }

  return {
    companyName: 'NeuraVolt Technology',
    email: 'info@neuravolt.com',
    supportEmail: 'info@neuravolt.in',
    phone: '', // set the real number in Settings → Company Profile; empty is hidden in emails
    website: 'https://neuravolt.in',
    address: '',
    logoUrl: null,
    signatureHtml: null,
  };
};

console.log('Worker is starting up and connecting to Redis...');

// Worker configuration
const worker = new Worker(
  'notifications-queue',
  async (job: Job) => {
    console.log(`Processing job ${job.id} of type ${job.name}`);

    if (job.name === 'email-job') {
      const { to, subject, template, variables, attachments, entityType, entityId, clientId } = job.data;
      
      const company = await getCompanyProfile();
      const portalUrl = process.env.CLIENT_PORTAL_URL || 'https://teams.neuravolt.in/client';
      const templateDir = getTemplateDir();
      const brand = emailBrand(template, variables);

      let html = '';
      let isCompiled = false;

      // 1. Try to load active template from database
      try {
        const dbTemplate = await prisma.emailTemplate.findUnique({
          where: { name: template },
          include: { versions: true },
        });

        const activeVersion = dbTemplate?.versions.find((v: any) => v.isActive);
        if (activeVersion && activeVersion.content) {
          registerPartials(templateDir);
          
          // Render layout
          const layoutPath = path.join(templateDir, 'layout.hbs');
          const layoutSource = fs.existsSync(layoutPath)
            ? fs.readFileSync(layoutPath, 'utf-8')
            : '{{{body}}}'; // Fallback layout shell if file missing

          const layoutTemplate = Handlebars.compile(layoutSource);
          const bodyTemplate = Handlebars.compile(activeVersion.content);

          const currentYear = new Date().getFullYear();
          const context = { ...variables, company, portalUrl, currentYear, brand, subject };
          const bodyHtml = bodyTemplate(context);

          html = layoutTemplate({ ...context, body: bodyHtml });
          isCompiled = true;
          console.log(`Rendered email using DB template version: ${activeVersion.id}`);
        }
      } catch (dbError) {
        console.error('Failed to render template from database, trying filesystem', dbError);
      }

      // 2. Try to load template from filesystem
      if (!isCompiled) {
        try {
          const layoutPath = path.join(templateDir, 'layout.hbs');
          const bodyPath = path.join(templateDir, `${template}.hbs`);

          if (fs.existsSync(layoutPath) && fs.existsSync(bodyPath)) {
            registerPartials(templateDir);
            
            const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
            const bodySource = fs.readFileSync(bodyPath, 'utf-8');

            const layoutTemplate = Handlebars.compile(layoutSource);
            const bodyTemplate = Handlebars.compile(bodySource);

            const currentYear = new Date().getFullYear();
            const context = { ...variables, company, portalUrl, currentYear, brand, subject };
            const bodyHtml = bodyTemplate(context);

            html = layoutTemplate({ ...context, body: bodyHtml });
            isCompiled = true;
            console.log(`Rendered email using filesystem template: ${template}.hbs`);
          }
        } catch (fsError) {
          console.error('Failed to render template from filesystem, using fallback JS templates', fsError);
        }
      }

      // 3. Fallback to inline string-builders
      if (!isCompiled) {
        const renderHtml = fallbackTemplates[template];
        if (!renderHtml) {
          throw new Error(`Template ${template} not found in fallback template list`);
        }
        html = wrapInLayout(renderHtml({ ...variables, brand }), { ...variables, company, portalUrl, currentYear: new Date().getFullYear(), brand, subject }, templateDir);
        console.log(`Rendered email using inline fallback string-builder for: ${template}`);
      }

      // Render standardized subject format if it contains Handlebars dynamic tags
      let renderedSubject = subject || '';
      if (renderedSubject.includes('{{')) {
        try {
          renderedSubject = Handlebars.compile(renderedSubject)(variables);
        } catch (subjectError) {
          console.error('Failed to render Handlebars subject line, sending raw subject', subjectError);
        }
      }

      // Construct dynamic mail envelope headers
      const mailHeaders: Record<string, string> = {};
      if (entityType) mailHeaders['X-Entity-Type'] = String(entityType);
      if (entityId) mailHeaders['X-Entity-Id'] = String(entityId);
      if (clientId) mailHeaders['X-Client-Id'] = String(clientId);

      try {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || company.supportEmail || company.email || '"NeuraVolt OS" <no-reply@neuravolt.com>',
          to,
          subject: renderedSubject,
          html,
          headers: mailHeaders,
          attachments: attachments ? attachments.map((att: any) => ({
            filename: att.filename,
            content: Buffer.from(att.content, 'base64'),
            contentType: att.contentType
          })) : undefined
        });
        
        console.log(`Email sent successfully: ${info.messageId}`);

        // Persist sent email records in PostgreSQL
        try {
          await prisma.sentEmail.create({
            data: {
              templateName: template,
              recipientEmail: to,
              subject: renderedSubject,
              smtpMessageId: info.messageId,
              entityType: entityType || null,
              entityId: entityId || null,
              clientId: clientId || null,
            },
          });
          console.log(`Saved email log: template=${template}, to=${to}, messageId=${info.messageId}`);
        } catch (logError) {
          console.error('Failed to persist sent email log record:', logError);
        }

        return { success: true, messageId: info.messageId };
      } catch (error) {
        console.error('Failed to send email via SMTP transporter:', error);
        throw error;
      }
    }

    if (job.name === 'in-app-job') {
      const { userId, type, title, message, link } = job.data;
      try {
        const notification = await prisma.notification.create({
          data: {
            userId,
            type,
            title,
            message,
            link: link ?? null,
          },
        });
        console.log(`In-app notification saved: ${notification.id}`);
        return { success: true, notificationId: notification.id };
      } catch (error) {
        console.error('Failed to save in-app notification:', error);
        throw error;
      }
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  }
);

// ==================== AI ROADMAP ENGINE GENERATOR WORKER ====================

const aiWorker = new Worker(
  'launchpad-ai-generation-queue',
  (job: Job) => processAiGenerationJob(job, { prisma, callGemini, getGeminiApiKey }),
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  }
);

worker.on('completed', (job) => {
  console.log(`Notification Job ${job.id} has completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(`Notification Job ${job?.id} has failed with ${err.message}.`);
});

aiWorker.on('completed', (job) => {
  console.log(`AI Generation Job ${job.id} has completed successfully.`);
});

aiWorker.on('failed', (job, err) => {
  console.error(`AI Generation Job ${job?.id} has failed with ${err.message}.`);
});

async function fetchCodeFromGithub(githubUrl: string): Promise<{ filename: string; content: string }[]> {
  try {
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return [];
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '').replace(/\/pull\/\d+$/, ''); // clean pull paths

    const codeFiles: { filename: string; content: string }[] = [];
    const allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.html', '.css', '.txt', '.md'];
    const ignoredFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.ds_store'];

    async function scanContents(path: string = '') {
      if (codeFiles.length >= 15) return; // limit to 15 files max

      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents${path ? '/' + path : ''}`;
      console.log(`[Worker] Fetching GitHub contents from: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'NeuraVolt-Code-Reviewer' },
      });

      if (!response.ok) return;

      const items = (await response.json()) as any[];
      if (!Array.isArray(items)) return;

      for (const item of items) {
        if (codeFiles.length >= 15) return;

        if (item.type === 'file') {
          const lowerName = item.name.toLowerCase();
          const hasAllowedExtension = allowedExtensions.some(ext => lowerName.endsWith(ext));
          const isIgnored = ignoredFiles.includes(lowerName);

          if (hasAllowedExtension && !isIgnored) {
            const fileRes = await fetch(item.download_url);
            if (fileRes.ok) {
              const content = await fileRes.text();
              codeFiles.push({
                filename: path ? `${path}/${item.name}` : item.name,
                content: content.substring(0, 10000), // limit file length to 10k chars
              });
            }
          }
        } else if (item.type === 'dir') {
          // Only traverse common directories to avoid traversing node_modules or large hidden folders
          const lowerName = item.name.toLowerCase();
          const allowedDirs = ['src', 'app', 'backend', 'agents', 'db', 'models', 'routes', 'controllers', 'views'];
          if (allowedDirs.includes(lowerName) && !lowerName.startsWith('.')) {
            await scanContents(path ? `${path}/${item.name}` : item.name);
          }
        }
      }
    }

    await scanContents();
    return codeFiles;
  } catch (error: any) {
    console.error(`[Worker] Error fetching code from GitHub:`, error.message);
    return [];
  }
}

const enableCodeReviewWorker = process.env.ENABLE_CODE_REVIEW_WORKER === 'true';

const codeReviewWorker = enableCodeReviewWorker ? new Worker(
  'code-review-queue',
  async (job: Job) => {
    const { studentId, nodeId, githubPrUrl, notes } = job.data;
    console.log(`[Worker] Starting code review for Job: ${job.id}, Node: ${nodeId}, PR: ${githubPrUrl}`);

    let genJob: any = null;

    try {
      const node = await prisma.roadmapNode.findUnique({
        where: { id: nodeId },
      });
      if (!node) {
        throw new Error(`Roadmap node ${nodeId} not found`);
      }

      const validationRules = (node.validationRules as any) || {};
      const passThreshold = validationRules.minScore || 70;

      // Fetch prompt from database or use default
      const dbPrompt = await prisma.launchpadAiPrompt.findUnique({
        where: { name: 'code_reviewer' },
      });

      let promptTemplate = dbPrompt?.promptTemplate || `
You are a senior backend engineer reviewing a student's code submission.
Repository Link: {{repoUrl}}
Task Description: {{taskDescription}}
Requirements: {{requirements}}

CRITICAL QUALITY CHECK:
- You must verify if the files and logic in the repository/PR actually implement the requested Task Description and Requirements.
- If the student has submitted a repository or pull request for a completely different project, task, or technology (e.g. submitting a Python project for a Node.js/Express challenge, or an AI agent repository for a simple Idea Board API challenge), you MUST immediately reject the submission!
- Under this rejection scenario, you MUST return:
  1. "score": 0
  2. "passed": false
  3. "feedback": "### Rejection: Unrelated Submission\\nThe submitted repository contains code for a completely different project ({{repoUrl}}) and does not implement the requested challenge ({{taskDescription}}). Please ensure you are submitting the correct codebase."

Please review the code and output a JSON object containing:
1. "score": a number from 0 to 100 representing how well the submission meets requirements.
2. "passed": a boolean representing whether the submission meets the minimum criteria.
3. "feedback": a detailed markdown report summarizing what they did well and areas of improvement.

Ensure you only return valid JSON. Do not include markdown code block backticks around the JSON.
`;

      // 1. Fetch code files from student's GitHub repo to verify their actual logic
      const codeFiles = await fetchCodeFromGithub(githubPrUrl);
      let studentCodeContext = "";
      if (codeFiles.length > 0) {
        studentCodeContext = codeFiles.map(f => `--- FILE: ${f.filename} ---\n${f.content}`).join('\n\n');
      } else {
        studentCodeContext = "No code files could be parsed from the public GitHub contents API. Please verify the URL or ask the student to upload files in root or src directories.";
      }

      const filledPrompt = promptTemplate
        .replace(/\{\{\{?repo_url\}\}?\}/g, githubPrUrl || '')
        .replace(/\{\{\{?repoUrl\}\}?\}/g, githubPrUrl || '')
        .replace(/\{\{\{?topic\}\}?\}/g, node.title || '')
        .replace(/\{\{\{?taskDescription\}\}?\}/g, node.description || 'Task code files submission.')
        .replace(/\{\{\{?task_description\}\}?\}/g, node.description || 'Task code files submission.')
        .replace(/\{\{\{?requirements\}\}?\}/g, (validationRules.reviewCriteria || ['Code functionality', 'Build cleanliness']).join(', '))
        + `\n\n${fenceUntrustedContent('Submitted Code Files', studentCodeContext)}`;

      // Create a db tracking record for this AI review job
      try {
        genJob = await prisma.aIGenerationJob.create({
          data: {
            jobType: 'ai.student.code_review',
            status: 'processing',
            targetType: 'student_challenge',
            targetId: nodeId,
            inputData: {
              prompt: filledPrompt,
              studentId,
              nodeId,
              githubPrUrl,
              notes,
            },
          },
        });
      } catch (dbErr: any) {
        console.error('[Worker] Failed to create AIGenerationJob record:', dbErr.message);
      }

      const reviewResult = await getCodeReviewOutcome(filledPrompt, passThreshold, { callGemini, getGeminiApiKey });
      const finalScore = reviewResult.score;
      const passed = reviewResult.passed;

      const trustLevel = (node as any).trustLevel || validationRules.trustLevel || 'A';
      const requiresMentorApproval = trustLevel === 'B' || trustLevel === 'C' || validationRules.mentorReviewRequired === true;
      const targetStatus = passed ? (requiresMentorApproval ? 'ai_verified' : 'completed') : 'in_progress';
      const mentorStatus = (passed && requiresMentorApproval) ? 'pending' : null;

      // Update student progress status in database
      await prisma.studentNodeProgress.upsert({
        where: {
          studentId_nodeId: {
            studentId,
            nodeId,
          },
        },
        update: {
          aiReviewScore: finalScore,
          aiReviewFeedback: reviewResult.feedback || 'Review completed successfully.',
          status: targetStatus,
          aiVerifiedAt: new Date(),
          mentorReviewStatus: mentorStatus,
          completedAt: passed && !requiresMentorApproval ? new Date() : null,
        },
        create: {
          studentId,
          nodeId,
          aiReviewScore: finalScore,
          aiReviewFeedback: reviewResult.feedback || 'Review completed successfully.',
          status: targetStatus,
          aiVerifiedAt: new Date(),
          mentorReviewStatus: mentorStatus,
          completedAt: passed && !requiresMentorApproval ? new Date() : null,
        },
      });

      // Update db tracking record for AI review job
      if (genJob) {
        try {
          await prisma.aIGenerationJob.update({
            where: { id: genJob.id },
            data: {
              status: 'completed',
              outputData: { ...reviewResult },
              completedAt: new Date(),
            },
          });
        } catch (dbErr: any) {
          console.error('[Worker] Failed to update AIGenerationJob completion:', dbErr.message);
        }
      }

      console.log(`[Worker] Code review for Job ${job.id} successfully completed. Score: ${finalScore}, Passed: ${passed}`);
      return reviewResult;
    } catch (err: any) {
      console.error(`[Worker] Code review job ${job.id} failed:`, err.message);
      
      if (genJob) {
        try {
          await prisma.aIGenerationJob.update({
            where: { id: genJob.id },
            data: {
              status: 'failed',
              errorMessage: err.message,
              completedAt: new Date(),
            },
          });
        } catch (dbErr: any) {
          console.error('[Worker] Failed to update AIGenerationJob failure state:', dbErr.message);
        }
      }

      throw err;
    }
  },
  {
    connection,
    concurrency: 2,
  }
) : null;

if (codeReviewWorker) {
  codeReviewWorker.on('completed', (job) => {
    console.log(`Code Review Job ${job.id} has completed successfully.`);
  });

  codeReviewWorker.on('failed', (job, err) => {
    console.error(`Code Review Job ${job?.id} has failed with ${err.message}.`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Workers shutting down...');
  await worker.close();
  await aiWorker.close();
  if (codeReviewWorker) {
    await codeReviewWorker.close();
  }
  process.exit(0);
});
