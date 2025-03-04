import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { htmlToSend } from '../business-alarm/templates/htmlToSend.format';
import { SETTLEMENT_ERROR_EMAIL } from '../utils/email.group';
import { sendEnablePgInfotemp } from './templates/enable.pg.template';
import { sendQueryErrortemplate } from './templates/error.template';

@Injectable()
export class EmailService {
  transporter: any;
  constructor() {
    this.transporter = createTransport({
      pool: true,
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // use TLS
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        refreshToken: process.env.OAUTH_REFRESH_TOKEN,
      },
    });

    if (process.env.NODE_ENV !== 'test')
      this.transporter.verify(function (error, success) {
        if (error) {
          console.log('error in sending mail');

          console.log(error);
        } else {
          console.log('Server is ready to take our messages');
        }
      });
  }

  async sendMail(mailOptions) {
    return await this.transporter.sendMail(mailOptions);
  }

  async sendOTPMail(email_id: string, subject: string, otp: string) {
    if (!email_id) throw new Error('Invalid email id');
    const __dirname = path.resolve();
    const filePath = path.join(__dirname, 'src/email/otpTemplate.html');
    const source = fs.readFileSync(filePath, 'utf-8').toString();
    const template = handlebars.compile(source);
    const replacements = {
      otp: otp,
    };
    const htmlToSend = template(replacements);
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email_id,
      subject: subject,
      html: htmlToSend,
    };

    await this.sendMail(mailOptions);
    console.log('mail sent', { email_id, subject });
    return true;
  }

  async sendRefundInitiatedAlert(
    school_name: string,
    refund_id: string,
    amount: number,
  ) {
    const emailRecipients = ['tarun.k@edviron.com', 'raj.barmaiya@edviron.com']; // List of primary recipients
    const ccRecipients = ['cc1@example.com', 'cc2@example.com']; // List of CC recipients

    const htmlToSend = `
      <html>
        <body>
        <p>A refund has been initiated for <strong> ${school_name}</strong></p>
        <p><strong>Refund Amount:</strong> ₹ ${amount}</p>
    <p><strong>Refund ID:</strong>  ${refund_id} </p>
    </body>
    </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender email
      to: emailRecipients.join(','), // Join multiple recipients with commas
      // cc: ccRecipients.join(','), // Join multiple CC recipients with commas
      subject: 'Refund Initiated',
      html: htmlToSend,
    };

    try {
      await this.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendAutoRefundInitiatedAlert(
    school_name: string,
    refund_id: string,
    amount: number,
    collect_id: string,
  ) {
    const emailRecipients = ['raj.barmaiya@edviron.com']; // List of primary recipients
    const ccRecipients = ['cc1@example.com', 'cc2@example.com']; // List of CC recipients

    const htmlToSend = `
      <html>
        <body>
        <p>An Auto refund has been initiated for <strong> ${school_name}</strong></p>
        <p><strong>Refund Amount:</strong> ₹ ${amount}</p>
                <p><strong>Refund Order:</strong> ₹ ${collect_id}</p>
    <p><strong>Refund ID:</strong>  ${refund_id} </p>
    </body>
    </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender email
      to: emailRecipients.join(','), // Join multiple recipients with commas
      // cc: ccRecipients.join(','), // Join multiple CC recipients with commas
      subject: 'Refund Initiated',
      html: htmlToSend,
    };

    try {
      await this.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async errorAlert(error: string) {
    const emailRecipients = ['tarun.k@edviron.com', 'raj.barmaiya@edviron.com'];
    const htmlToSend = `
    <html>
      <body>
      <p>
        Error in Generating payments in Payment API's 
      </p>
      <p> Error msg : ${error}</p>
  </body>
  </html>
  `;

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender email
      to: emailRecipients.join(','), // Join multiple recipients with commas
      // cc: ccRecipients.join(','), // Join multiple CC recipients with commas
      subject: 'Refund Initiated',
      html: htmlToSend,
    };
    try {
      await this.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
  sendErrorMail(subject: string, body: string) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: SETTLEMENT_ERROR_EMAIL,
      subject: subject,
      html: body,
    };
    this.transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error.message);
      } else {
        console.log(info.response);
      }
    });
  }

  sendMailToTrustee(subject: string, body: string, emails: Array<string>) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emails,
      subject: subject,
      html: body,
    };
    this.transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error.message);
      } else {
        console.log(info.response);
      }
    });
  }

  sendMailWithAttachment(
    subject: string,
    body: string,
    emails: Array<string>,
    filename: string,
    content: Buffer,
  ) {
    const mailOpts = {
      from: process.env.EMAIL_USER,
      to: emails,
      subject: subject,
      html: body,
      attachments: [{ filename: filename, content }],
    };
    this.transporter.sendMail(mailOpts, (err) => {
      if (err) {
        console.error('Error sending receipt attachment');
      } else {
        console.log('receipt attachment sent successfully.');
      }
    });
  }

  sendAlert(emailBody: string, sub: string) {
    // const emailRecipients = ['tarun.k@edviron.com', 'raj.barmaiya@edviron.com'];
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: SETTLEMENT_ERROR_EMAIL,
      subject: sub,
      html: emailBody,
    };

    this.transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error('Error sending  alert email:');
      } else {
        console.log('alert email sent successfully.');
      }
    });
  }

  async sendEnablePgInfo(data) {
    // const emailRecipients = ['tarun.k@edviron.com', 'raj.barmaiya@edviron.com'];
    const emailRecipients = ['manish.verma@edviron.com'];

    const template = await sendEnablePgInfotemp(data);

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender email
      to: emailRecipients.join(','), // Join multiple recipients with commas
      // cc: ccRecipients.join(','), // Join multiple CC recipients with commas
      subject: data.status,
      html: template,
    };
    try {
      await this.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async reconMissmatched(
    utr: string,
    school: string,
  ) {
    const emailRecipients = ['tarun.k@edviron.com', 'raj.barmaiya@edviron.com'];
    const htmlToSend = `
    <html>
      <body>
      <p>
        Missmatched found in Settlement ${utr}
      </p>
      <p> School Name : ${school} </p>
  </body>
  </html>
  `;

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender email
      to: emailRecipients.join(','), // Join multiple recipients with commas
      // cc: ccRecipients.join(','), // Join multiple CC recipients with commas
      subject: 'Refund Initiated',
      html: htmlToSend,
    };
    try {
      await this.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
}
