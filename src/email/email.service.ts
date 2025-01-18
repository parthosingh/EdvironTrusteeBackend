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

  tt = {
    customer_details: {
      customer_email: null,
      customer_id: '7112AAA812234',
      customer_name: null,
      customer_phone: '9898989898',
    },
    error_details: {
      error_code: 'TECHNICAL_FAILURE',
      error_code_raw: null,
      error_description:
        "Authentication could not be completed by customer's bank due to technical issue. Request customer to attempt again.",
      error_description_raw: null,
      error_reason: 'authentication_failed',
      error_source: 'issuer bank/scheme',
    },
    order: {
      order_amount: 150,
      order_currency: 'INR',
      order_id: '678a17af40e0a39139677805',
      order_tags: null,
    },
    payment: {
      auth_id: null,
      bank_reference: null,
      cf_payment_id: 3419040617,
      payment_amount: 150.9,
      payment_currency: 'INR',
      payment_group: 'debit_card',
      payment_message: '!ERROR!-FSS0001-Authentication Not Available.',
      payment_method: {
        card: {
          card_bank_name: 'STATE BANK OF INDIA',
          card_country: 'IN',
          card_network: 'visa',
          card_number: 'XXXXXXXXXXXX1757',
          card_sub_type: 'R',
          card_type: 'debit_card',
          channel: null,
        },
      },
      payment_status: 'FAILED',
      payment_time: '2025-01-17T14:14:13+05:30',
    },
    payment_gateway_details: {
      gateway_name: 'CASHFREE',
      gateway_order_id: '3688046163',
      gateway_order_reference_id: 'null',
      gateway_payment_id: '3419040617',
      gateway_settlement: null,
      gateway_status_code: null,
    },
    payment_offers: null,
  };
}
