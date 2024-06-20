import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import mongoose, { ObjectId, Types } from 'mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import { Trustee } from '../schema/trustee.schema';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { Cron } from '@nestjs/schedule';
import { SettlementReport } from '../schema/settlement.schema';
import { SchoolMdr } from 'src/schema/school_mdr.schema';
import { BaseMdr } from 'src/schema/base.mdr.schema';

@Injectable()
export class ErpService {
  constructor(
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    private jwtService: JwtService,
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>,
    @InjectModel(SchoolMdr.name)
    private schoolMdrModel: mongoose.Model<SchoolMdr>,
    @InjectModel(BaseMdr.name)
    private baseMdrModel: mongoose.Model<BaseMdr>,
  ) {}

  async createApiKey(trusteeId: string): Promise<string> {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeId input');
      }
      const trustee = await this.trusteeModel.findById(trusteeId, {
        password_hash: 0,
      });

      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }

      trustee.IndexOfApiKey++;
      const updatedTrustee = await trustee.save();
      const payload = {
        trusteeId: updatedTrustee._id,
        IndexOfApiKey: updatedTrustee.IndexOfApiKey,
      };
      const apiKey = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_API_KEY,
        expiresIn: '1y',
      });
      const lastFourChars = apiKey.slice(-4);
      updatedTrustee.apiKey = lastFourChars;
      await updatedTrustee.save();

      return apiKey;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  async genrateLink(phone_number: string) {
    try {
      const token = this.jwtService.sign(
        { phone_number },
        { secret: process.env.JWT_SECRET_FOR_INTRANET, expiresIn: '2h' },
      );
      const response = await axios.get(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/payment-link?token=${token}`,
      );
      const link = this.jwtService.verify(response.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      return link;
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async validateApiKey(apiKey: string): Promise<any> {
    try {
      const decodedPayload = this.jwtService.verify(apiKey, {
        secret: process.env.JWT_SECRET_FOR_API_KEY,
      });

      const trustee = await this.trusteeModel.findById(
        decodedPayload.trusteeId,
      );

      if (!trustee) throw new NotFoundException('trustee not found');

      if (trustee.IndexOfApiKey !== decodedPayload.IndexOfApiKey)
        throw new Error('API key expired');

      const userTrustee = {
        id: trustee._id,
        name: trustee.name,
        email: trustee.email_id,
      };

      return userTrustee;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new UnauthorizedException('Invalid API key');
    }
  }

  async createSection(school_id, data: object, trustee_id) {
    try {
      if (!Types.ObjectId.isValid(school_id)) {
        throw new BadRequestException('Invalid school_id format');
      }
      const schoolId = new Types.ObjectId(school_id);
      const checkSchool = await this.trusteeSchoolModel.findOne({
        trustee_id,
        school_id: schoolId,
      });
      if (!checkSchool) {
        throw new NotFoundException('school not found for given trustee');
      }

      const info = {
        school_id: schoolId,
        data: data,
      };
      const token = this.jwtService.sign(info, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: '2h',
      });

      const sectionToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/section`,
        {
          token: token,
        },
      );
      const section = this.jwtService.verify(sectionToken.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      return section;
    } catch (error) {
      if (error.response.data && error.response.data.statusCode === 409) {
        throw new ConflictException(error.response.data.message);
      } else if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  async createSchool(
    phone_number: string,
    name: string,
    email: string,
    school_name: string,
    trustee: ObjectId,
  ): Promise<any> {
    try {
      const no_of_schools = await this.trusteeSchoolModel.countDocuments({
        trustee_id: trustee,
      });
      const existingTrustee = await this.trusteeModel.findById(trustee);
      if (no_of_schools >= existingTrustee.school_limit) {
        throw new ForbiddenException('School limit reached');
      }

      const data = {
        phone_number,
        name,
        email,
        school_name,
        trustee_id: trustee,
        trustee_name: existingTrustee.name,
      };

      const token = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: '2h',
      });

      const schoolToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/create-school`,
        {
          token: token,
        },
      );

      const school = this.jwtService.verify(schoolToken.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      const schoolId = new Types.ObjectId(school.adminInfo.school_id);
      console.log(schoolId);

      const trusteeSchool = await this.trusteeSchoolModel.create({
        school_id: schoolId,
        school_name: school.updatedSchool.updates.name,
        trustee_id: trustee,
        email: email,
        phone_number,
        super_admin_name: name,
      });

      const base_charge = await this.baseMdrModel.findOne({
        trustee_id: trustee,
      });
      if (base_charge) {
        const mdr = await this.schoolMdrModel.create({
          school_id: trusteeSchool.school_id,
          mdr2: base_charge.platform_charges,
        });
      }

      return school;
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a non-success status code
        if (error.response.status === 409) {
          throw new ConflictException(error.response.data?.message);
        } else if (error.response.data?.message == 'Invalid phone number!') {
          throw new BadRequestException('Invalid phone number!');
        } else if (error.response.data?.message == 'Invalid email!') {
          throw new BadRequestException('Invalid email!');
        } else if (error.response.data?.message === 'User already exists') {
          throw new BadRequestException('User already exists');
        } else if (error instanceof ForbiddenException) {
          throw error;
        } else {
          console.log(error.response.data);
          throw new BadRequestException('Failed to create school');
        }
      } else if (error.request) {
        throw new BadRequestException('No response received from the server');
      } else {
        throw new BadRequestException('Request setup error');
      }
    }
  }

  async createStudent(Student, schoolId, trustee_id) {
    try {
      const Key = process.env.JWT_SECRET_FOR_INTRANET;

      const school_id = new Types.ObjectId(schoolId);
      const checkSchool = await this.trusteeSchoolModel.findOne({
        trustee_id,
        school_id,
      });
      if (!checkSchool) {
        throw new NotFoundException('school not found for given trustee');
      }

      const info = {
        schoolId: schoolId,
        ...Student,
      };
      const token = this.jwtService.sign(info, {
        secret: Key,
        expiresIn: '2h',
      });
      const studentToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/createStudent`,
        {
          token: token,
        },
      );

      const student = this.jwtService.verify(studentToken.data, {
        secret: Key,
      });

      return student;
    } catch (error) {
      if (error.response?.data && error.response?.data?.statusCode === 400) {
        throw new BadRequestException(error.response.data);
      } else if (
        error.response?.data &&
        error.response?.data.statusCode === 409
      ) {
        throw new ConflictException(error.response.data);
      } else if (error.response && error.response?.statusCode === 404) {
        throw new NotFoundException(error.message);
      } else if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  async getUser(trusteeId: ObjectId) {
    try {
      const trustee = await this.trusteeModel.findById(trusteeId);
      if (!trustee) throw new NotFoundException('Trustee doesn not exist');
      const userInfo = {
        name: trustee.name,
        email_id: trustee.email_id,
        phone_number: trustee.phone_number,
      };
      return userInfo;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ConflictException('Error in finding trustee');
    }
  }

  async sendPaymentLinkToWhatsaap(body: {
    student_name: string;
    phone_no: string;
    amount: number;
    reason: string;
    school_id: string;
    paymentURL: string;
  }) {
    try {
      const obj = {
        messaging_product: 'whatsapp',
        to: '+91' + body.phone_no,
        type: 'template',
        template: {
          name: 'custom_payment_link',
          language: {
            code: 'en',
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: body.student_name,
                },
                {
                  type: 'text',
                  text: body.amount,
                },
                {
                  type: 'text',
                  text: body.reason,
                },
              ],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                {
                  type: 'text',
                  text: body.paymentURL.split('/')[4].substring(8),
                },
              ],
            },
          ],
        },
      };

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://graph.facebook.com/v16.0/103031782859865/messages',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + process.env.FACEBOOK_ACCESS_TOKEN,
        },
        data: obj,
      };

      await axios.request(config);

      return `Whatsaap message successfully sent to ${body.student_name} on ${body.phone_no}`;
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Server responded with an error:', error.response.data);
        console.error('Status Code:', error.response.status);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from the server');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up the request:', error.message);
      }
      throw new Error(error);
    }
  }

  async sendPaymentLinkTOMail(body: {
    student_name: string;
    mail_id: string;
    school_id: string;
    amount: number;
    reason: string;
    paymentURL: string;
  }) {
    try {
      const __dirname = path.resolve();
      const filePath = path.join(__dirname, 'src/erp/sendPaymentLink.html');
      const source = fs.readFileSync(filePath, 'utf-8').toString();
      const template = handlebars.compile(source);

      const replacements = {
        student_name: body.student_name,
        payment_url: body.paymentURL,
        reason: body.reason,
        amount: body.amount,
      };

      const htmlToSend = template(replacements);

      const transporter = nodemailer.createTransport({
        pool: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          type: 'OAuth2',
          user: process.env.EMAIL_USER,
          clientId: process.env.OAUTH_CLIENT_ID,
          clientSecret: process.env.OAUTH_CLIENT_SECRET,
          refreshToken: process.env.OAUTH_REFRESH_TOKEN,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: body.mail_id,
        subject: 'Fee reminder',
        html: htmlToSend,
      };
      const info = await transporter.sendMail(mailOptions);

      return `Payment link successfully send to ${body.student_name} on ${body.mail_id}`;
    } catch (err) {
      throw new Error(err);
    }
  }

  async sendPaymentLink(body: {
    student_name: string;
    phone_no: string;
    amount: number;
    reason: string;
    school_id: string;
    mail_id: string;
    paymentURL: string;
  }) {
    try {
      const {
        student_name,
        phone_no,
        amount,
        reason,
        school_id,
        mail_id,
        paymentURL,
      } = body;

      if (body.mail_id) {
        await this.sendPaymentLinkTOMail({
          student_name,
          amount,
          reason,
          school_id,
          mail_id,
          paymentURL,
        });

        console.log('mail sent');
      }

      if (body.phone_no) {
        await this.sendPaymentLinkToWhatsaap({
          student_name,
          phone_no,
          amount,
          reason,
          school_id,
          paymentURL,
        });

        console.log('whatsaap sent');
      }

      return 'Notification sent scuccessfully';
    } catch (err) {
      throw new Error(err.message);
    }
  }

  @Cron('0 1 * * *')
  async sendSettlements() {
    console.log('running cron');
    const merchants = await this.trusteeSchoolModel.find({});
    merchants.forEach((merchant) => {
      if (!merchant.client_id) return;
      console.log(
        `getting report for ${merchant.merchantName}(${merchant.client_id})`,
      );
      const start = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
      end.setHours(23, 59, 59, 999);

      const axios = require('axios');
      const data = JSON.stringify({
        pagination: {
          limit: 1000,
        },
        filters: {
          start_date: start.toISOString(),
          end_date: end.toISOString(),
        },
      });

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.cashfree.com/pg/settlements',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-partner-apikey': process.env.CASHFREE_API_KEY,
          'x-partner-merchantid': merchant.client_id,
        },
        data: data,
      };

      axios
        .request(config)
        .then(async (response) => {
          console.log('response', response.data.data[0]);
          if (response.data.data.length === 0) return;

          const settlementReport = new this.settlementReportModel({
            settlementAmount: response.data.data[0].payment_amount.toFixed(2),
            adjustment: (0.0).toString(),
            netSettlementAmount:
              response.data.data[0].payment_amount.toFixed(2),
            clientId: merchant.client_id,
            fromDate: new Date(start.getTime() - 24 * 60 * 60 * 1000),
            tillDate: new Date(start.getTime() - 24 * 60 * 60 * 1000),
            status: 'Settled',
            utrNumber: response.data.data[0].settlement_utr,
            settlementDate: new Date(
              new Date().getTime() - 86400000 * 1,
            ).toDateString(),
            trustee: merchant.trustee_id,
            schoolId: merchant.school_id,
          });
          await settlementReport.save();

          const transporter = nodemailer.createTransport({
            pool: true,
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
              type: 'OAuth2',
              user: process.env.EMAIL_USER,
              clientId: process.env.OAUTH_CLIENT_ID,
              clientSecret: process.env.OAUTH_CLIENT_SECRET,
              refreshToken: process.env.OAUTH_REFRESH_TOKEN,
            },
          });

          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'tarun.k@edviron.com',
            subject:
              'Settlement Report Dt.' +
              new Date(new Date().getTime() - 86400000 * 1).toDateString(),
            attachments: [
              {
                filename: `setllement_report_${merchant.school_name}.csv`,
                content: `
                S.No., Settlement Amount,	Adjustment,	Net Settlement Amount,	From,	Till,	Status,	UTR No.,	Settlement Date
                1, ${response.data.data[0].payment_amount.toFixed(
                  2,
                )}, ${(0.0).toString()}, ${response.data.data[0].payment_amount.toFixed(
                  2,
                )},	${new Date(
                  start.getTime() - 24 * 60 * 60 * 1000,
                )}, ${new Date(
                  start.getTime() - 24 * 60 * 60 * 1000,
                )},	Settled, ${response.data.data[0].settlement_utr}, ${new Date(
                  new Date().getTime() - 86400000 * 1,
                ).toDateString()}`,
              },
            ],
            html: `
            Dear School, <br/><br/>
            
            Attached is the settlement report for transactions processed on ${new Date(
              new Date().getTime() - 86400000 * 2,
            ).toDateString()}. <br/><br/>
            
            If you have any questions or require further clarification, feel free to reach out. <br/><br/>
            
            Regards,<br/>
            Edviron Team 
            `,
          };
          const info = await transporter.sendMail(mailOptions);
          console.log(info);
        })
        .catch((error) => {
          console.log(error);
        });
    });
  }
}
