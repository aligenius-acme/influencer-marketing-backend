import { prisma } from '../config/postgres.js';
import { NotFoundError, BadRequestError } from '../middlewares/errorHandler.js';

// Available merge tags for templates
export const MERGE_TAGS = {
  influencer: [
    { tag: '{{influencer_name}}', description: 'Influencer display name' },
    { tag: '{{influencer_username}}', description: 'Influencer username/handle' },
    { tag: '{{influencer_platform}}', description: 'Platform (Instagram, TikTok, etc.)' },
    { tag: '{{influencer_followers}}', description: 'Follower count' },
    { tag: '{{influencer_email}}', description: 'Contact email (if available)' },
  ],
  brand: [
    { tag: '{{brand_name}}', description: 'Your company name' },
    { tag: '{{brand_website}}', description: 'Your website URL' },
    { tag: '{{sender_name}}', description: 'Your name' },
    { tag: '{{sender_email}}', description: 'Your email address' },
  ],
  campaign: [
    { tag: '{{campaign_name}}', description: 'Campaign name' },
    { tag: '{{campaign_budget}}', description: 'Campaign budget' },
    { tag: '{{campaign_start_date}}', description: 'Campaign start date' },
    { tag: '{{campaign_end_date}}', description: 'Campaign end date' },
    { tag: '{{campaign_brief}}', description: 'Campaign brief/description' },
  ],
  general: [
    { tag: '{{today_date}}', description: 'Today\'s date' },
    { tag: '{{custom_message}}', description: 'Custom message placeholder' },
  ],
};

// Template types
export const TEMPLATE_TYPES = [
  { value: 'outreach', label: 'Initial Outreach', description: 'First contact with influencers' },
  { value: 'follow_up', label: 'Follow Up', description: 'Follow up on previous messages' },
  { value: 'collaboration', label: 'Collaboration Proposal', description: 'Detailed collaboration offer' },
  { value: 'negotiation', label: 'Negotiation', description: 'Rate and terms discussion' },
  { value: 'confirmation', label: 'Confirmation', description: 'Confirm agreement details' },
  { value: 'reminder', label: 'Reminder', description: 'Deadline and task reminders' },
  { value: 'thank_you', label: 'Thank You', description: 'Post-campaign appreciation' },
  { value: 'custom', label: 'Custom', description: 'General purpose template' },
];

// Default templates
const DEFAULT_TEMPLATES = [
  {
    name: 'Initial Outreach',
    subject: 'Collaboration Opportunity with {{brand_name}}',
    body: `Hi {{influencer_name}},

I hope this message finds you well! I'm {{sender_name}} from {{brand_name}}, and I've been following your content on {{influencer_platform}} for a while now. Your authentic style and engaged community really stood out to us.

We're currently looking for creators to partner with for an upcoming campaign, and I think you'd be a perfect fit!

Here's a quick overview:
- Campaign: {{campaign_name}}
- Timeline: {{campaign_start_date}} - {{campaign_end_date}}
- Budget: {{campaign_budget}}

Would you be interested in learning more? I'd love to hop on a quick call or share more details via email.

Looking forward to hearing from you!

Best,
{{sender_name}}
{{brand_name}}
{{brand_website}}`,
    templateType: 'outreach',
    variables: ['influencer_name', 'brand_name', 'sender_name', 'influencer_platform', 'campaign_name', 'campaign_start_date', 'campaign_end_date', 'campaign_budget', 'brand_website'],
  },
  {
    name: 'Follow Up',
    subject: 'Following up - {{brand_name}} Collaboration',
    body: `Hi {{influencer_name}},

I wanted to follow up on my previous message about a potential collaboration with {{brand_name}}.

I understand you're probably busy, but I didn't want you to miss out on this opportunity! We think your content style would be a great match for our {{campaign_name}} campaign.

If you're interested, just reply to this email and we can discuss the details. If not, no worries at all - I appreciate your time!

Best,
{{sender_name}}
{{brand_name}}`,
    templateType: 'follow_up',
    variables: ['influencer_name', 'brand_name', 'sender_name', 'campaign_name'],
  },
  {
    name: 'Collaboration Details',
    subject: 'Partnership Details - {{campaign_name}}',
    body: `Hi {{influencer_name}},

Thank you for your interest in collaborating with {{brand_name}}! Here are the full details of our campaign:

**Campaign Overview**
{{campaign_brief}}

**Timeline**
- Start Date: {{campaign_start_date}}
- End Date: {{campaign_end_date}}

**Compensation**
{{campaign_budget}}

**Deliverables**
[Please specify deliverables]

**Next Steps**
1. Review the details above
2. Let me know if you have any questions
3. If everything looks good, we'll send over a contract

Looking forward to working together!

Best,
{{sender_name}}
{{brand_name}}`,
    templateType: 'collaboration',
    variables: ['influencer_name', 'brand_name', 'sender_name', 'campaign_name', 'campaign_brief', 'campaign_start_date', 'campaign_end_date', 'campaign_budget'],
  },
  {
    name: 'Thank You',
    subject: 'Thank You for the Amazing Collaboration!',
    body: `Hi {{influencer_name}},

I just wanted to reach out and say a huge THANK YOU for your work on our {{campaign_name}} campaign!

Your content was fantastic, and we've received great feedback from our team and audience. It was such a pleasure working with you.

We'd love to collaborate again in the future. I'll definitely be in touch when we have upcoming opportunities that would be a good fit for your audience.

Thanks again for everything!

Best,
{{sender_name}}
{{brand_name}}`,
    templateType: 'thank_you',
    variables: ['influencer_name', 'brand_name', 'sender_name', 'campaign_name'],
  },
];

interface CreateTemplateInput {
  name: string;
  subject: string;
  body: string;
  templateType: string;
  variables?: string[];
}

interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  templateType?: string;
  variables?: string[];
}

interface MergeData {
  influencer?: {
    name?: string;
    username?: string;
    platform?: string;
    followers?: number;
    email?: string;
  };
  brand?: {
    name?: string;
    website?: string;
    senderName?: string;
    senderEmail?: string;
  };
  campaign?: {
    name?: string;
    budget?: string;
    startDate?: string;
    endDate?: string;
    brief?: string;
  };
  customMessage?: string;
}

class EmailTemplateService {
  /**
   * Get all templates for a user
   */
  async getTemplates(userId: string, templateType?: string) {
    const where: any = { userId };
    if (templateType) {
      where.templateType = templateType;
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return templates;
  }

  /**
   * Get a single template
   */
  async getTemplate(userId: string, templateId: string) {
    const template = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
    });

    if (!template) {
      throw NotFoundError('Template not found');
    }

    return template;
  }

  /**
   * Create a new template
   */
  async createTemplate(userId: string, input: CreateTemplateInput) {
    // Extract variables from the template body and subject
    const extractedVariables = this.extractVariables(input.subject + ' ' + input.body);

    const template = await prisma.emailTemplate.create({
      data: {
        userId,
        name: input.name,
        subject: input.subject,
        body: input.body,
        templateType: input.templateType,
        variables: input.variables || extractedVariables,
      },
    });

    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(userId: string, templateId: string, input: UpdateTemplateInput) {
    // Check if template exists and belongs to user
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
    });

    if (!existing) {
      throw NotFoundError('Template not found');
    }

    // Re-extract variables if body or subject changed
    let variables = input.variables;
    if ((input.body || input.subject) && !input.variables) {
      const body = input.body || existing.body;
      const subject = input.subject || existing.subject;
      variables = this.extractVariables(subject + ' ' + body);
    }

    const template = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.subject && { subject: input.subject }),
        ...(input.body && { body: input.body }),
        ...(input.templateType && { templateType: input.templateType }),
        ...(variables && { variables }),
      },
    });

    return template;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(userId: string, templateId: string) {
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
    });

    if (!existing) {
      throw NotFoundError('Template not found');
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId },
    });
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(userId: string, templateId: string) {
    const existing = await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
    });

    if (!existing) {
      throw NotFoundError('Template not found');
    }

    const template = await prisma.emailTemplate.create({
      data: {
        userId,
        name: `${existing.name} (Copy)`,
        subject: existing.subject,
        body: existing.body,
        templateType: existing.templateType,
        variables: existing.variables,
      },
    });

    return template;
  }

  /**
   * Initialize default templates for a user
   */
  async initializeDefaultTemplates(userId: string) {
    // Check if user already has templates
    const existingCount = await prisma.emailTemplate.count({
      where: { userId },
    });

    if (existingCount > 0) {
      return { message: 'Templates already exist', created: 0 };
    }

    // Create default templates
    const templates = await prisma.emailTemplate.createMany({
      data: DEFAULT_TEMPLATES.map(t => ({
        userId,
        ...t,
      })),
    });

    return { message: 'Default templates created', created: templates.count };
  }

  /**
   * Preview template with merged data
   */
  async previewTemplate(userId: string, templateId: string, mergeData: MergeData) {
    const template = await this.getTemplate(userId, templateId);

    const mergedSubject = this.mergeTemplate(template.subject, mergeData);
    const mergedBody = this.mergeTemplate(template.body, mergeData);

    return {
      subject: mergedSubject,
      body: mergedBody,
      originalTemplate: template,
    };
  }

  /**
   * Merge template with data (for preview or sending)
   */
  mergeTemplate(content: string, data: MergeData): string {
    let merged = content;

    // Influencer data
    if (data.influencer) {
      merged = merged.replace(/\{\{influencer_name\}\}/g, data.influencer.name || '[Influencer Name]');
      merged = merged.replace(/\{\{influencer_username\}\}/g, data.influencer.username || '[Username]');
      merged = merged.replace(/\{\{influencer_platform\}\}/g, data.influencer.platform || '[Platform]');
      merged = merged.replace(/\{\{influencer_followers\}\}/g,
        data.influencer.followers ? this.formatNumber(data.influencer.followers) : '[Followers]');
      merged = merged.replace(/\{\{influencer_email\}\}/g, data.influencer.email || '[Email]');
    }

    // Brand data
    if (data.brand) {
      merged = merged.replace(/\{\{brand_name\}\}/g, data.brand.name || '[Brand Name]');
      merged = merged.replace(/\{\{brand_website\}\}/g, data.brand.website || '[Website]');
      merged = merged.replace(/\{\{sender_name\}\}/g, data.brand.senderName || '[Your Name]');
      merged = merged.replace(/\{\{sender_email\}\}/g, data.brand.senderEmail || '[Your Email]');
    }

    // Campaign data
    if (data.campaign) {
      merged = merged.replace(/\{\{campaign_name\}\}/g, data.campaign.name || '[Campaign Name]');
      merged = merged.replace(/\{\{campaign_budget\}\}/g, data.campaign.budget || '[Budget]');
      merged = merged.replace(/\{\{campaign_start_date\}\}/g, data.campaign.startDate || '[Start Date]');
      merged = merged.replace(/\{\{campaign_end_date\}\}/g, data.campaign.endDate || '[End Date]');
      merged = merged.replace(/\{\{campaign_brief\}\}/g, data.campaign.brief || '[Campaign Brief]');
    }

    // General
    merged = merged.replace(/\{\{today_date\}\}/g, new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }));
    merged = merged.replace(/\{\{custom_message\}\}/g, data.customMessage || '');

    return merged;
  }

  /**
   * Get available merge tags
   */
  getMergeTags() {
    return MERGE_TAGS;
  }

  /**
   * Get template types
   */
  getTemplateTypes() {
    return TEMPLATE_TYPES;
  }

  /**
   * Extract variables from template content
   */
  private extractVariables(content: string): string[] {
    const regex = /\{\{([a-z_]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Format number with K/M suffix
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}

export const emailTemplateService = new EmailTemplateService();
