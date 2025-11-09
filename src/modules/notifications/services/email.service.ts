import { Injectable, Logger, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { RESEND_CLIENT } from "../providers/resend.provider";
import {
  getNotificationEmailHtml,
  getWelcomeEmailHtml,
} from "../templates/email-templates";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend,
    private configService: ConfigService
  ) {
    this.fromEmail = this.configService.get<string>(
      "RESEND_FROM_EMAIL",
      "noreply@vibelist.cc"
    );
  }

  async sendNotificationEmail(
    email: string,
    title: string,
    body: string,
    actionUrl?: string
  ): Promise<boolean> {
    try {
      const html = getNotificationEmailHtml({
        title,
        body,
        actionUrl,
        appName: "VibeList",
      });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: title,
        html,
      });

      if (error) {
        throw error;
      }

      this.logger.log(`Email sent successfully to ${email}, ID: ${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, displayName: string): Promise<boolean> {
    try {
      const html = getWelcomeEmailHtml({
        displayName,
        appName: "VibeList",
      });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: "Welcome to VibeList!",
        html,
      });

      if (error) {
        throw error;
      }

      this.logger.log(
        `Welcome email sent successfully to ${email}, ID: ${data?.id}`
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email:`, error);
      return false;
    }
  }

  async sendFollowerNotificationEmail(
    email: string,
    followerName: string
  ): Promise<boolean> {
    return this.sendNotificationEmail(
      email,
      "New Follower",
      `${followerName} started following you on VibeList!`,
      `${this.configService.get("APP_URL")}/profile`
    );
  }

  async sendItemReservedEmail(
    email: string,
    itemName: string,
    reserverName: string
  ): Promise<boolean> {
    return this.sendNotificationEmail(
      email,
      "Item Reserved",
      `${reserverName} reserved your wishlist item: ${itemName}`,
      `${this.configService.get("APP_URL")}/wishlist`
    );
  }
}
