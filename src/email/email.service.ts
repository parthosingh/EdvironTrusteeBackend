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
}
