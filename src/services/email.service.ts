import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.initTransporter();
  }

  private initTransporter() {
    // In development, we'll log emails to console
    // In production, use SMTP configuration
    if (!this.isDevelopment && process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    if (this.isDevelopment || !this.transporter) {
      // Log email to console in development
      console.log('\n========== EMAIL ===========');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('------- HTML -------');
      console.log(html);
      console.log('============================\n');
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@influencerplatform.com',
        to,
        subject,
        html,
        text: text || this.htmlToText(html),
      });
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string, userName?: string): Promise<boolean> {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); border-radius: 8px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Influencer Platform</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Verify Your Email</h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #52525b;">
                Hi${userName ? ` ${userName}` : ''},<br><br>
                Welcome to Influencer Platform! Please verify your email address by clicking the button below.
              </p>

              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${verifyUrl}" style="color: #8B5CF6; word-break: break-all;">${verifyUrl}</a>
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Influencer Platform',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); border-radius: 8px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Influencer Platform</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Reset Your Password</h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #52525b;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>

              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #8B5CF6; word-break: break-all;">${resetUrl}</a>
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Influencer Platform',
      html,
    });
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Influencer Platform</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); border-radius: 8px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700;">Influencer Platform</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Welcome, ${userName}!</h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #52525b;">
                Your email has been verified and your account is now active. You're all set to start discovering influencers and managing campaigns!
              </p>

              <h2 style="margin: 32px 0 16px; font-size: 18px; font-weight: 600; color: #18181b;">Get Started</h2>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #52525b; font-size: 15px; line-height: 28px;">
                <li>Discover influencers that match your brand</li>
                <li>Create and manage campaigns</li>
                <li>Track performance and analytics</li>
                <li>Build lasting relationships</li>
              </ul>

              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 32px 0 20px;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Influencer Platform!',
      html,
    });
  }

  async sendInvoiceEmail(
    email: string,
    invoiceData: {
      invoiceNumber: string;
      influencerName: string;
      brandName: string;
      total: number;
      currency: string;
      dueDate: Date;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
      notes?: string;
      paymentTerms?: string;
    }
  ): Promise<boolean> {
    const { invoiceNumber, influencerName, brandName, total, currency, dueDate, lineItems, notes, paymentTerms } = invoiceData;
    const invoicesUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invoices`;

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount);
    };

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const lineItemsHtml = lineItems
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e4e4e7;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e4e4e7; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e4e4e7; text-align: right;">${formatCurrency(item.unitPrice)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e4e4e7; text-align: right;">${formatCurrency(item.amount)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); border-radius: 8px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700;">📄 Invoice</span>
              </div>
            </td>
          </tr>

          <!-- Invoice Info -->
          <tr>
            <td style="padding: 20px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: top;">
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #18181b;">Invoice ${invoiceNumber}</h1>
                    <p style="margin: 0; font-size: 14px; color: #71717a;">From: ${brandName}</p>
                  </td>
                  <td style="text-align: right; vertical-align: top;">
                    <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">Due Date</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #18181b;">${formatDate(dueDate)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <p style="margin: 0; font-size: 16px; line-height: 24px; color: #52525b;">
                Hi ${influencerName},<br><br>
                You have received a new invoice for your collaboration. Please review the details below.
              </p>
            </td>
          </tr>

          <!-- Line Items Table -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden;">
                <tr style="background-color: #f4f4f5;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #52525b; text-transform: uppercase;">Description</th>
                  <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #52525b; text-transform: uppercase;">Qty</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #52525b; text-transform: uppercase;">Price</th>
                  <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #52525b; text-transform: uppercase;">Amount</th>
                </tr>
                ${lineItemsHtml}
              </table>
            </td>
          </tr>

          <!-- Total -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td></td>
                  <td style="text-align: right; width: 200px;">
                    <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px;">
                      <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">Total Due</p>
                      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #18181b;">${formatCurrency(total)}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            notes
              ? `
          <!-- Notes -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #92400e; text-transform: uppercase;">Notes</p>
                <p style="margin: 0; font-size: 14px; color: #78350f;">${notes}</p>
              </div>
            </td>
          </tr>
          `
              : ''
          }

          ${
            paymentTerms
              ? `
          <!-- Payment Terms -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <p style="margin: 0; font-size: 14px; color: #71717a;">
                <strong>Payment Terms:</strong> ${paymentTerms}
              </p>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Button -->
          <tr>
            <td style="padding: 10px 40px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${invoicesUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      View Invoice
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                This invoice was sent via Influencer Platform.<br>
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject: `Invoice ${invoiceNumber} from ${brandName} - ${formatCurrency(total)} Due ${formatDate(dueDate)}`,
      html,
    });
  }

  async sendInvoicePaidEmail(
    email: string,
    invoiceData: {
      invoiceNumber: string;
      influencerName: string;
      brandName: string;
      total: number;
      currency: string;
      paidAt: Date;
    }
  ): Promise<boolean> {
    const { invoiceNumber, influencerName, brandName, total, currency, paidAt } = invoiceData;

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount);
    };

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received - Invoice ${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 16px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 50%;">
                <span style="color: #ffffff; font-size: 32px;">✓</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #18181b;">Payment Received!</h1>
              <p style="margin: 0 0 24px; font-size: 16px; color: #52525b;">
                Invoice ${invoiceNumber} has been marked as paid.
              </p>

              <div style="background-color: #f0fdf4; padding: 24px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #166534;">Amount Paid</p>
                <p style="margin: 0; font-size: 36px; font-weight: 700; color: #15803d;">${formatCurrency(total)}</p>
                <p style="margin: 8px 0 0; font-size: 14px; color: #166534;">Paid on ${formatDate(paidAt)}</p>
              </div>

              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a;">
                Hi ${influencerName}, ${brandName} has confirmed payment for your invoice.
                The funds will be transferred to your connected account shortly.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject: `Payment Received - Invoice ${invoiceNumber} (${formatCurrency(total)})`,
      html,
    });
  }

  async sendBrandMentionAlert(
    email: string,
    mentionData: {
      ruleName: string;
      platform: string;
      content: string;
      contentPreview: string;
      authorUsername: string;
      authorFollowers?: number;
      isVerified?: boolean;
      sentiment: 'positive' | 'neutral' | 'negative';
      relevanceScore: number;
      sourceUrl?: string;
      matchedKeywords?: string[];
      matchedHashtags?: string[];
      detectedAt: Date;
      likes?: number;
      comments?: number;
      shares?: number;
    }
  ): Promise<boolean> {
    const {
      ruleName,
      platform,
      content,
      contentPreview,
      authorUsername,
      authorFollowers,
      isVerified,
      sentiment,
      relevanceScore,
      sourceUrl,
      matchedKeywords,
      matchedHashtags,
      detectedAt,
      likes,
      comments,
      shares,
    } = mentionData;

    const listeningUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/listening/mentions`;

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const formatNumber = (num?: number) => {
      if (!num) return '0';
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    };

    const getSentimentColor = (sent: string) => {
      switch (sent) {
        case 'positive':
          return { bg: '#dcfce7', text: '#166534', border: '#22c55e' };
        case 'negative':
          return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' };
        default:
          return { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' };
      }
    };

    const getPlatformIcon = (plat: string) => {
      switch (plat.toLowerCase()) {
        case 'instagram':
          return '📸';
        case 'tiktok':
          return '🎵';
        case 'youtube':
          return '▶️';
        case 'twitter':
          return '🐦';
        default:
          return '📱';
      }
    };

    const sentimentColors = getSentimentColor(sentiment);
    const platformIcon = getPlatformIcon(platform);

    const matchedItems = [
      ...(matchedKeywords || []).map((k) => `"${k}"`),
      ...(matchedHashtags || []).map((h) => `#${h}`),
    ];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brand Mention Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%); border-radius: 8px;">
                <span style="color: #ffffff; font-size: 20px; font-weight: 700;">🔔 Brand Mention Alert</span>
              </div>
            </td>
          </tr>

          <!-- Rule Info -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
                Triggered by rule: <strong style="color: #18181b;">${ruleName}</strong>
              </p>
            </td>
          </tr>

          <!-- Mention Card -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <div style="border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden;">
                <!-- Author Header -->
                <div style="background-color: #f9fafb; padding: 16px; border-bottom: 1px solid #e4e4e7;">
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="width: 48px; vertical-align: top;">
                        <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                          <span style="color: #ffffff; font-size: 20px; line-height: 44px; text-align: center; display: block; width: 44px;">${platformIcon}</span>
                        </div>
                      </td>
                      <td style="vertical-align: middle; padding-left: 12px;">
                        <p style="margin: 0 0 2px; font-size: 16px; font-weight: 600; color: #18181b;">
                          @${authorUsername}
                          ${isVerified ? '<span style="color: #3b82f6;">✓</span>' : ''}
                        </p>
                        <p style="margin: 0; font-size: 13px; color: #71717a;">
                          ${platform.charAt(0).toUpperCase() + platform.slice(1)} • ${formatNumber(authorFollowers)} followers
                        </p>
                      </td>
                      <td style="text-align: right; vertical-align: middle;">
                        <span style="display: inline-block; padding: 4px 12px; background-color: ${sentimentColors.bg}; color: ${sentimentColors.text}; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: capitalize;">
                          ${sentiment}
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Content -->
                <div style="padding: 16px;">
                  <p style="margin: 0 0 12px; font-size: 15px; line-height: 22px; color: #18181b;">
                    ${contentPreview.length > 280 ? contentPreview.substring(0, 280) + '...' : contentPreview}
                  </p>

                  ${
                    matchedItems.length > 0
                      ? `
                  <p style="margin: 0 0 12px; font-size: 13px; color: #71717a;">
                    <strong>Matched:</strong> ${matchedItems.join(', ')}
                  </p>
                  `
                      : ''
                  }

                  <!-- Metrics -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                    <tr>
                      <td style="font-size: 13px; color: #71717a;">
                        ❤️ ${formatNumber(likes)} &nbsp;&nbsp; 💬 ${formatNumber(comments)} &nbsp;&nbsp; 🔄 ${formatNumber(shares)}
                      </td>
                      <td style="text-align: right; font-size: 13px; color: #71717a;">
                        ${formatDate(detectedAt)}
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Relevance Score -->
                <div style="background-color: #faf5ff; padding: 12px 16px; border-top: 1px solid #e4e4e7;">
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="font-size: 13px; color: #7c3aed;">
                        <strong>Relevance Score:</strong> ${Math.round(relevanceScore * 100)}%
                      </td>
                      <td style="width: 150px;">
                        <div style="background-color: #e9d5ff; border-radius: 4px; height: 8px; overflow: hidden;">
                          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); height: 100%; width: ${Math.round(relevanceScore * 100)}%;"></div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
            </td>
          </tr>

          <!-- View Button -->
          <tr>
            <td style="padding: 10px 40px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    ${
                      sourceUrl
                        ? `
                    <a href="${sourceUrl}" style="display: inline-block; padding: 14px 24px; background: #18181b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; margin-right: 12px;">
                      View Original Post
                    </a>
                    `
                        : ''
                    }
                    <a href="${listeningUrl}" style="display: inline-block; padding: 14px 24px; background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px;">
                      View All Mentions
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa; text-align: center;">
                You're receiving this because you enabled email alerts for the "${ruleName}" monitoring rule.
              </p>
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const sentimentEmoji = sentiment === 'positive' ? '🟢' : sentiment === 'negative' ? '🔴' : '⚪';

    return this.sendEmail({
      to: email,
      subject: `${sentimentEmoji} Brand Mention on ${platform}: @${authorUsername} mentioned your brand`,
      html,
    });
  }

  async sendSignatureRequestEmail(
    email: string,
    signatureData: {
      recipientName: string;
      senderName: string;
      contractTitle: string;
      contractId: string;
      signingUrl: string;
      expiresAt?: Date;
      message?: string;
    }
  ): Promise<boolean> {
    const { recipientName, senderName, contractTitle, contractId, signingUrl, expiresAt, message } = signatureData;

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signature Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 16px; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); border-radius: 50%;">
                <span style="color: #ffffff; font-size: 32px;">✍️</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">Signature Requested</h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #52525b; text-align: center;">
                ${senderName} has requested your signature
              </p>

              <!-- Contract Card -->
              <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin: 20px 0; border: 1px solid #e4e4e7;">
                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Document</p>
                <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #18181b;">${contractTitle}</p>

                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Reference</p>
                <p style="margin: 0; font-size: 14px; color: #52525b; font-family: monospace;">${contractId.substring(0, 8).toUpperCase()}</p>
              </div>

              ${message ? `
              <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #92400e;">Message from ${senderName}:</p>
                <p style="margin: 0; font-size: 14px; color: #78350f;">${message}</p>
              </div>
              ` : ''}

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #52525b;">
                Hi ${recipientName},<br><br>
                Please review and sign the document at your earliest convenience. Click the button below to access the signing page.
              </p>

              ${expiresAt ? `
              <p style="margin: 0 0 16px; font-size: 14px; color: #dc2626; text-align: center;">
                ⚠️ This request expires on <strong>${formatDate(expiresAt)}</strong>
              </p>
              ` : ''}

              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${signingUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Review & Sign Document
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #71717a; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${signingUrl}" style="color: #3B82F6; word-break: break-all;">${signingUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <div style="background-color: #f0fdf4; padding: 12px 16px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <p style="margin: 0; font-size: 13px; color: #166534;">
                  🔒 <strong>Secure Signing:</strong> Your signature will be legally binding and encrypted.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa; text-align: center;">
                This signature request was sent via Influencer Platform.
              </p>
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject: `✍️ Signature Requested: ${contractTitle} from ${senderName}`,
      html,
    });
  }

  async sendContractSignedEmail(
    email: string,
    contractData: {
      recipientName: string;
      contractTitle: string;
      contractId: string;
      signerName: string;
      signedAt: Date;
      allSigned: boolean;
      viewUrl: string;
      downloadUrl?: string;
    }
  ): Promise<boolean> {
    const { recipientName, contractTitle, contractId, signerName, signedAt, allSigned, viewUrl, downloadUrl } = contractData;

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const statusBg = allSigned ? '#dcfce7' : '#dbeafe';
    const statusText = allSigned ? '#166534' : '#1e40af';
    const statusIcon = allSigned ? '✅' : '📝';
    const statusLabel = allSigned ? 'Fully Executed' : 'Partially Signed';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract ${allSigned ? 'Completed' : 'Update'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; padding: 16px; background: ${allSigned ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)'}; border-radius: 50%;">
                <span style="color: #ffffff; font-size: 32px;">${statusIcon}</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #18181b;">
                ${allSigned ? 'Contract Completed!' : 'Document Signed'}
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; color: #52525b;">
                ${allSigned
                  ? 'All parties have signed the document.'
                  : `${signerName} has signed the document.`}
              </p>

              <!-- Contract Info Card -->
              <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin: 20px 0; border: 1px solid #e4e4e7; text-align: left;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Document</p>
                      <p style="margin: 4px 0 0; font-size: 16px; font-weight: 600; color: #18181b;">${contractTitle}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Signed By</p>
                      <p style="margin: 4px 0 0; font-size: 14px; color: #52525b;">${signerName}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Signed At</p>
                      <p style="margin: 4px 0 0; font-size: 14px; color: #52525b;">${formatDate(signedAt)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="margin: 0; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Status</p>
                      <span style="display: inline-block; margin-top: 4px; padding: 4px 12px; background-color: ${statusBg}; color: ${statusText}; border-radius: 20px; font-size: 13px; font-weight: 600;">
                        ${statusLabel}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #52525b;">
                Hi ${recipientName},<br><br>
                ${allSigned
                  ? 'Great news! Your contract has been fully executed. All parties have signed the document. You can now download the completed contract for your records.'
                  : 'A party has signed your contract. You will be notified when all signatures are collected.'}
              </p>

              <!-- Buttons -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${viewUrl}" style="display: inline-block; padding: 14px 28px; background: ${allSigned ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)'}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px; margin-right: 8px;">
                      View Contract
                    </a>
                    ${downloadUrl && allSigned ? `
                    <a href="${downloadUrl}" style="display: inline-block; padding: 14px 28px; background: #18181b; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                      Download PDF
                    </a>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Audit Trail Note -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <div style="background-color: #f9fafb; padding: 12px 16px; border-radius: 8px; border: 1px solid #e4e4e7;">
                <p style="margin: 0; font-size: 13px; color: #52525b;">
                  📋 <strong>Audit Trail:</strong> All signature events are securely logged and timestamped.
                  Reference: <code style="background: #e4e4e7; padding: 2px 6px; border-radius: 4px;">${contractId.substring(0, 8).toUpperCase()}</code>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} Influencer Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: email,
      subject: allSigned
        ? `✅ Contract Completed: ${contractTitle}`
        : `📝 ${signerName} signed: ${contractTitle}`,
      html,
    });
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const emailService = new EmailService();
