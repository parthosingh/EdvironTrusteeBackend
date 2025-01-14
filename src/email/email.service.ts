import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
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

  // async sendRefundInitiatedAlert() {
  //   const emailRecipients = ['tarun.k@edviron.com', 'raj.barmaiya@edviron.com']; // List of primary recipients
  //   const ccRecipients = ['cc1@example.com', 'cc2@example.com']; // List of CC recipients
  
  //   const htmlToSend = `
  //     Refund has been initiated.
  //   `;
  
  //   const mailOptions = {
  //     from: process.env.EMAIL_USER, // Sender email
  //     to: emailRecipients.join(','), // Join multiple recipients with commas
  //     cc: ccRecipients.join(','), // Join multiple CC recipients with commas
  //     subject: 'Refund',
  //     html: htmlToSend,
  //   };
  
  //   try {
  //     const transporter = nodemailer.createTransport({
  //       service: 'Gmail', // or your preferred email service
  //       auth: {
  //         user: process.env.EMAIL_USER, // Email address of the sender
  //         pass: process.env.EMAIL_PASS, // Email password or app-specific password
  //       },
  //     });
  
  //     const info = await transporter.sendMail(mailOptions);
  //     console.log('Email sent successfully:', info.messageId);
  //   } catch (error) {
  //     console.error('Error sending email:', error);
  //   }
  // }
  
}
