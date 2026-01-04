/**
 * Slack Integration Service
 *
 * Sends notifications to Slack channels via webhooks
 */

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: SlackBlockElement[];
  accessory?: SlackBlockElement;
  fields?: { type: string; text: string }[];
}

interface SlackBlockElement {
  type: string;
  text?: string | { type: string; text: string; emoji?: boolean };
  url?: string;
  action_id?: string;
  style?: string;
}

interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  ts?: number;
}

class SlackService {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Send a message to a Slack webhook
   */
  async sendWebhook(webhookUrl: string, message: SlackMessage): Promise<boolean> {
    if (!webhookUrl) {
      console.warn('Slack webhook URL not provided');
      return false;
    }

    if (this.isDevelopment) {
      console.log('\n========== SLACK MESSAGE ===========');
      console.log(`Webhook: ${webhookUrl.substring(0, 50)}...`);
      console.log('Message:', JSON.stringify(message, null, 2));
      console.log('=====================================\n');
      return true;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        console.error('Slack webhook failed:', response.status, await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to send Slack message:', error);
      return false;
    }
  }

  /**
   * Send a brand mention alert to Slack
   */
  async sendBrandMentionAlert(
    webhookUrl: string,
    mention: {
      platform: string;
      authorUsername: string;
      content: string;
      sentiment: string;
      relevanceScore: number;
      url?: string;
      metrics?: { likes?: number; comments?: number; shares?: number };
    },
    ruleName: string
  ): Promise<boolean> {
    const sentimentEmoji = {
      positive: '🟢',
      neutral: '⚪',
      negative: '🔴',
    }[mention.sentiment] || '⚪';

    const sentimentColor = {
      positive: '#22c55e',
      neutral: '#6b7280',
      negative: '#ef4444',
    }[mention.sentiment] || '#6b7280';

    const message: SlackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${sentimentEmoji} Brand Mention on ${mention.platform}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*@${mention.authorUsername}* mentioned your brand`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `> ${mention.content.substring(0, 300)}${mention.content.length > 300 ? '...' : ''}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Platform:*\n${mention.platform}` },
            { type: 'mrkdwn', text: `*Sentiment:*\n${mention.sentiment}` },
            { type: 'mrkdwn', text: `*Relevance:*\n${mention.relevanceScore}%` },
            { type: 'mrkdwn', text: `*Rule:*\n${ruleName}` },
          ],
        },
      ],
      attachments: [
        {
          color: sentimentColor,
          fields: mention.metrics ? [
            { title: 'Likes', value: String(mention.metrics.likes || 0), short: true },
            { title: 'Comments', value: String(mention.metrics.comments || 0), short: true },
            { title: 'Shares', value: String(mention.metrics.shares || 0), short: true },
          ] : [],
          footer: 'Influencer Platform • Social Listening',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    if (mention.url) {
      message.blocks!.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${mention.url}|View Original Post>`,
        },
      });
    }

    return this.sendWebhook(webhookUrl, message);
  }

  /**
   * Send a campaign update to Slack
   */
  async sendCampaignUpdate(
    webhookUrl: string,
    campaign: {
      name: string;
      status: string;
      action: string;
      details?: string;
      url?: string;
    }
  ): Promise<boolean> {
    const statusEmoji = {
      DRAFT: '📝',
      ACTIVE: '🚀',
      PAUSED: '⏸️',
      COMPLETED: '✅',
      CANCELLED: '❌',
    }[campaign.status] || '📋';

    const message: SlackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${statusEmoji} Campaign Update`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${campaign.name}*\n${campaign.action}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Status:*\n${campaign.status}` },
          ],
        },
      ],
    };

    if (campaign.details) {
      message.blocks!.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: campaign.details,
        },
      });
    }

    if (campaign.url) {
      message.blocks!.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Campaign', emoji: true },
            url: campaign.url,
            action_id: 'view_campaign',
          },
        ],
      });
    }

    return this.sendWebhook(webhookUrl, message);
  }

  /**
   * Send a payment notification to Slack
   */
  async sendPaymentNotification(
    webhookUrl: string,
    payment: {
      type: 'invoice_sent' | 'invoice_paid' | 'payout_completed';
      amount: number;
      currency: string;
      recipientName: string;
      description?: string;
    }
  ): Promise<boolean> {
    const typeConfig = {
      invoice_sent: { emoji: '📧', title: 'Invoice Sent', color: '#3b82f6' },
      invoice_paid: { emoji: '💰', title: 'Invoice Paid', color: '#22c55e' },
      payout_completed: { emoji: '✅', title: 'Payout Completed', color: '#22c55e' },
    }[payment.type];

    const message: SlackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${typeConfig.emoji} ${typeConfig.title}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Amount:*\n${payment.currency} ${payment.amount.toFixed(2)}` },
            { type: 'mrkdwn', text: `*Recipient:*\n${payment.recipientName}` },
          ],
        },
      ],
      attachments: [
        {
          color: typeConfig.color,
          text: payment.description || '',
          footer: 'Influencer Platform • Payments',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    return this.sendWebhook(webhookUrl, message);
  }

  /**
   * Send a simple text notification
   */
  async sendSimpleMessage(webhookUrl: string, text: string): Promise<boolean> {
    return this.sendWebhook(webhookUrl, { text });
  }
}

export const slackService = new SlackService();
