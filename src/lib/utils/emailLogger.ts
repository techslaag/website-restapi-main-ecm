import { prisma } from "@/lib/prisma";
import { EmailTemplate } from "@prisma/client";

interface EmailLogData {
  userId: string;
  templateType: EmailTemplate | string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailLogger {
  static async logEmail(data: EmailLogData): Promise<void> {
    try {
      // Use existing template types, fallback to a default
      let templateType: EmailTemplate;
      
      if (data.templateType === 'expired_subscription') {
        templateType = 'renewal_reminder_1d'; // Use existing renewal reminder as fallback
      } else if (data.templateType === 'custom_message') {
        templateType = 'special_offer'; // Use existing special offer as fallback
      } else if (typeof data.templateType === 'string') {
        templateType = 'special_offer'; // Default fallback
      } else {
        templateType = data.templateType as EmailTemplate;
      }

      await prisma.emailLog.create({
        data: {
          userId: data.userId,
          templateType,
          subject: data.subject,
          status: data.status,
          errorMessage: data.errorMessage,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Failed to log email:", error);
    }
  }

  static async logEmailSent(
    userId: string,
    templateType: EmailTemplate | string,
    subject: string,
    result: EmailSendResult
  ): Promise<void> {
    await this.logEmail({
      userId,
      templateType,
      subject,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error,
    });
  }

  static async logBulkEmails(
    emails: Array<{
      userId: string;
      templateType: EmailTemplate | string;
      subject: string;
      result: EmailSendResult;
    }>
  ): Promise<void> {
    try {
      for (const email of emails) {
        await this.logEmail({
          userId: email.userId,
          templateType: email.templateType,
          subject: email.subject,
          status: email.result.success ? 'sent' : 'failed',
          errorMessage: email.result.error,
        });
      }
    } catch (error) {
      console.error("Failed to log bulk emails:", error);
    }
  }

  static async getEmailLogs(filters?: {
    userId?: string;
    templateType?: EmailTemplate;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.templateType) {
      where.templateType = filters.templateType;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.sentAt = {};
      if (filters.startDate) {
        where.sentAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.sentAt.lte = filters.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.emailLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async getEmailStats(filters?: {
    startDate?: Date;
    endDate?: Date;
    templateType?: EmailTemplate;
  }) {
    const where: any = {};

    if (filters?.templateType) {
      where.templateType = filters.templateType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.sentAt = {};
      if (filters.startDate) {
        where.sentAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.sentAt.lte = filters.endDate;
      }
    }

    const [totalEmails, sentEmails, failedEmails] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.count({ where: { ...where, status: 'sent' } }),
      prisma.emailLog.count({ where: { ...where, status: 'failed' } }),
    ]);

    const templateStats = await prisma.emailLog.groupBy({
      by: ['templateType'],
      where,
      _count: {
        templateType: true,
      },
    });

    return {
      total: totalEmails,
      sent: sentEmails,
      failed: failedEmails,
      successRate: totalEmails > 0 ? (sentEmails / totalEmails) * 100 : 0,
      byTemplate: templateStats.map(stat => ({
        template: stat.templateType,
        count: stat._count.templateType,
      })),
    };
  }
}