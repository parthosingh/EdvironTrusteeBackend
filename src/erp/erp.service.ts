import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import mongoose, { ObjectId, Types } from 'mongoose';
import {
  charge_type,
  DisabledModes,
  PlatformCharge,
  TrusteeSchool,
} from '../schema/school.schema';
import { Trustee } from '../schema/trustee.schema';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { Cron } from '@nestjs/schedule';
import { SettlementReport } from '../schema/settlement.schema';
import { SchoolMdr } from '../schema/school_mdr.schema';
import { BaseMdr } from '../schema/base.mdr.schema';
import { CashfreeService } from '../cashfree/cashfree.service';
import * as crypto from 'crypto';
import { VirtualAccount } from 'src/schema/virtual.account.schema';
import { PosMachine, PosMachineSchema } from 'src/schema/pos.machine.schema';
import { ObjectType } from '@nestjs/graphql';
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
    @InjectModel(VirtualAccount.name)
    private VirtualAccountModel: mongoose.Model<VirtualAccount>,
    @InjectModel(PosMachine.name)
    private posMachineModel: mongoose.Model<PosMachine>,
    private readonly cashfreeService: CashfreeService,
  ) {}

  async createApiKey(trusteeId: string,otp:string): Promise<string> {
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
        ignoreExpiration: true,
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
      console.log(error);

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
      console.log('p');

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
        // const mdr = await this.schoolMdrModel.create({
        //   school_id: trusteeSchool.school_id,
        //   mdr2: base_charge.platform_charges,
        // });
        trusteeSchool.platform_charges = base_charge.platform_charges;
        await trusteeSchool.save();
        await this.updatePlatformChargesInPg(
          base_charge.platform_charges,
          trusteeSchool.trustee_id.toString(),
          trusteeSchool.school_id.toString(),
        );
      }

      return school;
    } catch (error) {
      console.log(error);

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

  async easebuzzSettlements(settlementDate?: Date) {
    if (!settlementDate) {
      settlementDate = new Date();
    }
    console.log(settlementDate, 'ss');

    const date = new Date(settlementDate.getTime());
    date.setUTCHours(0, 0, 0, 0);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const formattedDateString = `${day}-${month}-${year}`; //eazebuzz accepts date in DD-MM-YYYY formal seprated with - like '19-07-2024'
    console.log(formattedDateString, 'formant date');

    console.log('running cron for Easebuzz', settlementDate);
    //merchant_key|merchant_email|payout_date|salt
    const merchants = await this.trusteeSchoolModel.find({});
    const hashBody = `${process.env.EASEBUZZ_KEY}|${process.env.EASEBUZZ_MERCHANT_EMAIL}|${formattedDateString}|${process.env.EASEBUZZ_SALT}`;
    const hash = await this.calculateSHA512Hash(hashBody);
    console.log(hash);

    merchants
      .filter((m) => m.easebuzz_id)
      .map(async (merchant) => {
        if (!merchant.easebuzz_id) return;
        console.log(
          `Getting easebuzz settlement Report for  ${merchant.school_name}(${merchant.easebuzz_id}`,
        );

        const start = new Date(settlementDate.getTime() - 24 * 60 * 60 * 1000);
        console.log(start, 'start');
        console.log(
          new Date(start.getTime() - 24 * 60 * 60 * 1000),
          'start new',
        );

        start.setHours(0, 0, 0, 0);
        const end = new Date(settlementDate.getTime() - 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);

        const axios = require('axios');
        const qs = require('qs');

        const data = qs.stringify({
          merchant_email: process.env.EASEBUZZ_MERCHANT_EMAIL,
          merchant_key: process.env.EASEBUZZ_KEY,
          hash: hash,
          payout_date: formattedDateString,
          submerchant_id: merchant.easebuzz_id,
        });

        //easebuzz prod url https://dashboard.easebuzz.in
        const config = {
          method: 'POST',
          url: `${process.env.EASEBUZZ_ENDPOINT_PROD_DB}/payout/v1/retrieve`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          data: data,
        };
        try {
          const response = await axios.request(config);
          console.log(response.data.payouts_history_data, 'data');
          if (
            !response?.data?.payouts_history_data ||
            response?.data?.payouts_history_data?.length === 0
          ) {
            console.log(response.data, 'res');

            console.log('no data');
            return;
          }
          response.data.payouts_history_data.map(async (data: any) => {
            console.log('saving....', data);
            const easebuzzDate = new Date(data.payout_actual_date);
            const existingSettlement = await this.settlementReportModel.findOne(
              {
                utrNumber: data.bank_transaction_id,
              },
            );

            if (!existingSettlement) {
              try {
                const settlementReport = new this.settlementReportModel({
                  settlementAmount: data.payout_amount,
                  adjustment: (0.0).toString(),
                  netSettlementAmount: data.payout_amount,
                  easebuzz_id: merchant.easebuzz_id,
                  fromDate: new Date(
                    easebuzzDate.getTime() - 24 * 60 * 60 * 1000,
                  ),
                  tillDate: new Date(
                    easebuzzDate.getTime() - 24 * 60 * 60 * 1000,
                  ),
                  status: 'Settled',
                  utrNumber: data.bank_transaction_id,
                  settlementDate: new Date(data.payout_actual_date),
                  trustee: merchant.trustee_id,
                  schoolId: merchant.school_id,
                  clientId: merchant.client_id,
                });
                //add mail option
                console.log(
                  `saving settlement report for ${merchant.school_name}(${merchant.client_id}) on ${settlementDate}`,
                );
                await settlementReport.save();

                try {
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
                      new Date(
                        settlementDate.getTime() - 86400000 * 1,
                      ).toDateString(),
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
                    )},	Settled, ${
                      response.data.data[0].settlement_utr
                    }, ${new Date(
                      settlementDate.getTime() - 86400000 * 1,
                    ).toDateString()}`,
                      },
                    ],
                    html: `
                Dear School, <br/><br/>
                
                Attached is the settlement report for transactions processed on ${new Date(
                  settlementDate.getTime() - 86400000 * 2,
                ).toDateString()}. <br/><br/>
                
                If you have any questions or require further clarification, feel free to reach out. <br/><br/>
                
                Regards,<br/>
                Edviron Team 
                `,
                  };
                  const mailOptions2 = {
                    from: process.env.EMAIL_USER,
                    to: merchant.email,
                    subject:
                      'Settlement Report Dt.' +
                      new Date(
                        settlementDate.getTime() - 86400000 * 1,
                      ).toDateString(),
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
                    )},	Settled, ${
                      response.data.data[0].settlement_utr
                    }, ${new Date(
                      settlementDate.getTime() - 86400000 * 1,
                    ).toDateString()}`,
                      },
                    ],
                    html: `
                Dear School, <br/><br/>
                
                Attached is the settlement report for transactions processed on ${new Date(
                  settlementDate.getTime() - 86400000 * 2,
                ).toDateString()}. <br/><br/>
                
                If you have any questions or require further clarification, feel free to reach out. <br/><br/>
                
                Regards,<br/>
                Edviron Team 
                `,
                  };
                  // const info = await transporter.sendMail(mailOptions);
                  // await transporter.sendMail(mailOptions2);
                } catch (e) {
                  console.log('Error in sending mail to merchant');
                }
              } catch (e) {
                console.log(e.message);
              }
            } else {
              console.log(
                'Settlement already exists',
                existingSettlement.utrNumber,
              );
            }
          });
        } catch (e) {
          console.log(e);
          console.log(e.message);
        }
      });
  }

  async calculateSHA512Hash(data: any) {
    const hash = crypto.createHash('sha512');
    hash.update(data);
    return hash.digest('hex');
  }

  @Cron('0 1 * * *')
  async sendSettlements(settlementDate?: Date) {
    if (!settlementDate) {
      settlementDate = new Date();
    }
    await this.easebuzzSettlements(settlementDate);
    console.log('running cron', settlementDate);
    const merchants = await this.trusteeSchoolModel.find({});
    merchants
      .filter((m) => m.client_id)
      .map(async (merchant) => {
        if (!merchant.client_id) return;
        console.log(
          `getting report for ${merchant.school_name}(${merchant.client_id})`,
        );
        const start = new Date(settlementDate.getTime() - 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        const end = new Date(settlementDate.getTime() - 24 * 60 * 60 * 1000);
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

        const promise = () =>
          new Promise(async (resolve, reject) => {
            console.log('promise called');
            try {
              const response = await axios.request(config);

              if (response.data.data.length === 0) return;
              console.log(response.data.data, 'cashfree response');

              const existingSettlement =
                await this.settlementReportModel.findOne({
                  utrNumber: response.data.data[0].settlement_utr,
                });
              if (!existingSettlement) {
                const settlementReport = new this.settlementReportModel({
                  settlementAmount:
                    response.data.data[0].payment_amount.toFixed(2),
                  adjustment:
                    response.data.data[0].adjustment.toFixed(2).toString() ||
                    '0.0',
                  netSettlementAmount:
                    response.data.data[0].amount_settled.toFixed(2),
                  clientId: merchant.client_id,
                  fromDate:
                    new Date(response?.data?.data[0]?.payment_from) || start,
                  tillDate:
                    new Date(response?.data?.data[0]?.payment_till) || start,
                  status: 'Settled',
                  utrNumber: response.data.data[0].settlement_utr,
                  settlementDate: new Date(
                    settlementDate.getTime() - 86400000 * 1,
                  ).toDateString(),
                  trustee: merchant.trustee_id,
                  schoolId: merchant.school_id,
                });
                console.log(
                  `saving settlement report for ${merchant.school_name}(${merchant.client_id}) on ${settlementDate}`,
                );
                await settlementReport.save();
              } else {
                console.log('Settlement already exists', existingSettlement);
              }

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
                  new Date(
                    settlementDate.getTime() - 86400000 * 1,
                  ).toDateString(),
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
                  settlementDate.getTime() - 86400000 * 1,
                ).toDateString()}`,
                  },
                ],
                html: `
            Dear School, <br/><br/>
            
            Attached is the settlement report for transactions processed on ${new Date(
              settlementDate.getTime() - 86400000 * 2,
            ).toDateString()}. <br/><br/>
            
            If you have any questions or require further clarification, feel free to reach out. <br/><br/>
            
            Regards,<br/>
            Edviron Team 
            `,
              };
              const mailOptions2 = {
                from: process.env.EMAIL_USER,
                to: merchant.email,
                subject:
                  'Settlement Report Dt.' +
                  new Date(
                    settlementDate.getTime() - 86400000 * 1,
                  ).toDateString(),
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
                  settlementDate.getTime() - 86400000 * 1,
                ).toDateString()}`,
                  },
                ],
                html: `
            Dear School, <br/><br/>
            
            Attached is the settlement report for transactions processed on ${new Date(
              settlementDate.getTime() - 86400000 * 2,
            ).toDateString()}. <br/><br/>
            
            If you have any questions or require further clarification, feel free to reach out. <br/><br/>
            
            Regards,<br/>
            Edviron Team 
            `,
              };
              // const info = await transporter.sendMail(mailOptions);
              // await transporter.sendMail(mailOptions2);
              // console.log(info);
              resolve({});
            } catch (error) {
              console.log(
                `error getting settlement report for ${merchant.school_name}(${merchant.client_id}) on ${settlementDate}`,
                error.message,
              );
            }
            // .catch((error) => {
            //   console.log(error.message);
            // });
          });
        this.cashfreeService.enqueue(promise);
      });

    try {
      console.log('settlement saved');
    } catch (e) {
      console.log('error in eazebuzz settlement');
    }
  }

  async calculateCommissions(commission, payment_mode, platform_type, amount) {
    let commissionEntry = commission.find(
      (c) =>
        c.payment_mode.toLowerCase() === payment_mode.toLowerCase() &&
        c.platform_type.toLowerCase() === platform_type.toLowerCase(),
    );
    ``;
    if (!commissionEntry) {
      commissionEntry = commission.find(
        (c) =>
          c.payment_mode.toLowerCase() === 'others' &&
          c.platform_type.toLowerCase() === platform_type.toLowerCase(),
      );
    } // handel if payment_mode is not present in platform charges treat it as Others

    if (!commissionEntry) {
      throw new NotFoundException(
        `Commission entry not found for payment mode: ${payment_mode} and platform type: ${platform_type}`,
      );
    }

    const { range_charge } = commissionEntry;
    let commissionAmount = 0;

    for (const range of range_charge) {
      if (range.upto === null || amount <= range.upto) {
        if (range.charge_type === 'FLAT') {
          commissionAmount = range.charge;
        } else if (range.charge_type === 'PERCENT') {
          commissionAmount = (range.charge / 100) * amount;
        }
        break;
      }
    }
    return commissionAmount;
  }

  async testSettlementSingle(settlementDate: Date) {
    const start = new Date(settlementDate.getTime() - 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(settlementDate.getTime() - 24 * 60 * 60 * 1000);
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
        'x-partner-merchantid': 'CF_750839cc-0b2a-43ce-a90e-21eb92121b29',
      },
      data: data,
    };
    const response = await axios.request(config);
    if (response.data.data.length === 0) {
      console.log('no data found');

      return;
    }
    console.log(response.data.data, 'cashfree response');

    const existingSettlement = await this.settlementReportModel.findOne({
      utrNumber: response.data.data[0].settlement_utr,
    });
    const merchant = await this.trusteeSchoolModel.findOne({
      client_id: 'CF_750839cc-0b2a-43ce-a90e-21eb92121b29',
    });
    if (!existingSettlement) {
      const settlementReport = new this.settlementReportModel({
        settlementAmount: response.data.data[0].payment_amount.toFixed(2),
        adjustment:
          response.data.data[0].adjustment.toFixed(2).toString() || '0.0',
        netSettlementAmount: response.data.data[0].amount_settled.toFixed(2),
        clientId: merchant.client_id,
        fromDate: new Date(response?.data?.data[0]?.payment_from) || start,
        tillDate: new Date(response?.data?.data[0]?.payment_till) || start,
        status: 'Settled',
        utrNumber: response.data.data[0].settlement_utr,
        settlementDate: new Date(
          settlementDate.getTime() - 86400000 * 1,
        ).toDateString(),
        trustee: merchant.trustee_id,
        schoolId: merchant.school_id,
      });
      console.log(
        `saving settlement report for ${merchant.school_name}(${merchant.client_id}) on ${settlementDate}`,
      );
      await settlementReport.save();
    } else {
      console.log('Settlement already exists', existingSettlement);
    }
  }

  async updatePlatformChargesInPg(
    platformCharges: PlatformCharge[],
    trusteeId: string,
    schoolId: string,
  ) {
    try {
      const token = this.jwtService.sign(
        {
          trustee_id: trusteeId,
          school_id: schoolId,
        },
        {
          secret: process.env.PAYMENTS_SERVICE_SECRET,
        },
      );

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/update-school-mdr`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          trustee_id: trusteeId,
          school_id: schoolId,
          platform_charges: platformCharges,
          token: token,
        },
      };
      const response = await axios(config);
      console.log('response from payments service', response.data);
      return response.data;
    } catch (e) {
      throw new BadGatewayException(e.message);
    }
  }

  async validateDisabledModes(disabled_modes: string[]) {
    const invalidModes = disabled_modes.filter(
      (mode) => !Object.keys(DisabledModes).includes(mode as DisabledModes),
    );

    if (invalidModes.length > 0) {
      throw new BadRequestException(
        `Invalid disabled_modes: ${invalidModes.join(', ')}`,
      );
    }
    return true;
  }

  async generateVirtualAccountId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    while (result.length < 8) {
      const byte = crypto.randomBytes(1)[0];
      const char = chars.charAt(byte % chars.length);
      result += char;
    }
    return result;
  }

  async generateUniqueVirtualAccountId() {
    let unique = false;
    let virtualAccountId;

    while (!unique) {
      virtualAccountId = await this.generateVirtualAccountId();

      const existing = await this.VirtualAccountModel.findOne({
        virtual_account_id: virtualAccountId,
      });
      if (!existing) {
        unique = true;
      }
    }
    return virtualAccountId;
  }

  async createStudentVBA(
    student_id: string,
    student_name: string,
    student_email: string,
    student_number: string,
    school_id: string,
    amount: number,
  ) {
    try {
      // fetch mdr
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      const platformCharge = await this.getPlatformCharge(
        school_id,
        'vba',
        'Others',
        amount,
      );
      const finalAmount = amount + platformCharge * 1.18;

      if (!school.cf_x_client_id || !school.cf_x_client_secret) {
        throw new BadRequestException(
          `Virtual account is not ennabled for your account. Kindly contact us at tarun.k@edviron.com.`,
        );
      }
      const virtualAccountId = await this.generateUniqueVirtualAccountId();
      const virtualAccount = await this.VirtualAccountModel.create({
        school_id: school.school_id,
        trustee_id: school.trustee_id,
        status: 'INITIATED',
        student_email,
        student_id,
        student_name,
        student_number,
        notification_group: 'test',
        gateway: 'CASHFREE',
        virtual_account_id: virtualAccountId,
        min_amount: finalAmount.toFixed(2),
        max_amount: finalAmount.toFixed(2),
      });
      const token = await this.jwtService.sign(
        { school_id: school_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/v2/create-vba`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          cf_x_client_id: school.cf_x_client_id,
          cf_x_clien_secret: school.cf_x_client_secret,
          school_id,
          token,
          virtual_account_details: {
            virtual_account_id: virtualAccount.virtual_account_id,
            virtual_account_name: school.school_name,
            virtual_account_email: 'kyc@edviron.com',
            virtual_account_phone: '0000000000',
          },
          notification_group: virtualAccount.notification_group || 'test',
          amount: finalAmount.toFixed(2),
        },
      };

      const { data: response } = await axios.request(config);
      const details = {
        status: response.virtual_bank_accounts[0].status,
        vba_account_number:
          response.virtual_bank_accounts[0].vba_account_number,
        vba_ifsc: response.virtual_bank_accounts[0].vba_ifsc,
        vba_status: response.virtual_bank_accounts[0].vba_status,
      };
      virtualAccount.status = details.vba_status;
      virtualAccount.virtual_account_number = details.vba_account_number;
      virtualAccount.virtual_account_ifsc = details.vba_ifsc;
      await virtualAccount.save();
      return details;
    } catch (e) {
      console.log(e);

      throw new BadRequestException(e.message);
    }
  }

  async getPlatformCharge(
    school_id: string,
    platform_type: string,
    payment_mode: string,
    amount: number,
  ) {
    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) {
      throw new BadRequestException('INVALID SCHOOL ID');
    }
    const platform = school.platform_charges.find(
      (pc) =>
        pc.platform_type.toLowerCase() === platform_type.toLowerCase() &&
        pc.payment_mode.toLowerCase() === payment_mode.toLowerCase(),
    );

    if (!platform) {
      return 0;
    }

    const chargeRule = platform.range_charge
      .filter((rc) => rc.upto === null || rc.upto >= amount)
      .sort((a, b) => (a.upto ?? Infinity) - (b.upto ?? Infinity))[0];

    if (!chargeRule) {
      return 0;
    }

    if (chargeRule.charge_type === charge_type.FLAT) {
      return chargeRule.charge;
    } else if (chargeRule.charge_type === charge_type.PERCENT) {
      return (chargeRule.charge / 100) * amount;
    }

    return 0;
  }

  async updateVBA(collect_id: string, vba_account: string) {
    try {
      await this.VirtualAccountModel.findOneAndUpdate(
        { virtual_account_number: vba_account }, // Find by vba_account
        { $set: { collect_id } }, // Update collect_id
        { new: true }, // Optionally return the updated document
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  async createPosMachine(
    school_id: string,
    trustee_id: string,
    machine_name: string,
    machine_details: {
      device_mid: string;
      merchant_key: string;
      Device_serial_no: string;
      device_tid: string;
      channel_id: string;
      device_id: string;
    },

    status: string,
  ) {
    try {
      const checkDevice = await this.posMachineModel.findOne({
        'machine_details.device_id': machine_details.device_id,
      });

      if (checkDevice) {
        throw new BadRequestException(
          `Device already added for ${checkDevice.school_id}`,
        );
      }
      const newPosMachine = await new this.posMachineModel({
        school_id: new Types.ObjectId(school_id),
        trustee_id: new Types.ObjectId(trustee_id),
        machine_name: machine_name,
        machine_details: {
          device_mid: machine_details?.device_mid || '',
          merchant_key: machine_details?.merchant_key || '',
          Device_serial_no: machine_details?.Device_serial_no || '',
          device_tid: machine_details?.device_tid || '',
          channel_id: machine_details?.channel_id || '',
          device_id: machine_details?.device_id || '',
        },
        status: status,
        created_at: new Date(),
        updated_at: new Date(),
      });

      return newPosMachine.save();
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async getUTCUnix(dateStr: string, isEnd = false) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      throw new BadRequestException(
        `Invalid date format: ${dateStr}. Use YYYY-MM-DD.`,
      );
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new BadRequestException(
        `Invalid date format: ${dateStr}. Must contain valid numbers.`,
      );
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`Invalid date value: ${dateStr}`);
    }
    if (isEnd) {
      date.setUTCHours(23, 59, 59, 999);
    } else {
      date.setUTCHours(0, 0, 0, 0);
    }
    return Math.floor(date.getTime() / 1000);
  }

  @Cron('0 1 * * *')
  async settlementRazorpay(settlementDate?: Date) {
    try {
      if (!settlementDate) {
        settlementDate = new Date();
      }
      const merchants = await this.trusteeSchoolModel.find({
        'razorpay.razorpay_id': { $exists: true, $ne: null },
      });

      for (const merchant of merchants) {
        console.log(
          `Getting report for ${merchant.school_name} (${merchant.razorpay.razorpay_id})`,
        );

        try {
          const prevDay = new Date(settlementDate);
          const endDateStr = prevDay.toISOString().slice(0, 10);
          prevDay.setDate(prevDay.getDate() - 1);
          const startDateStr = prevDay.toISOString().slice(0, 10);
          // console.log(startDateStr, 'startDateStr');
          const startDate = this.getUTCUnix(startDateStr);
          const to = this.getUTCUnix(endDateStr);
          const config = {
            url: `https://api.razorpay.com/v1/settlements?from=${startDate}&to=${to}`,
            headers: { 'Content-Type': 'application/json' },
            auth: {
              username: merchant.razorpay.razorpay_id,
              password: merchant.razorpay.razorpay_secret,
            },
          };
          const response = await axios.request(config);
          const settlement = response.data.items;
          if (settlement.length === 0) {
            console.log(`No settlements found for ${merchant.school_name}`);
            continue;
          }
          for (const value of settlement) {
            const existing = await this.settlementReportModel.findOne({
              utrNumber: value.utr,
            });
            if (!existing) {
              const report = new this.settlementReportModel({
                settlementAmount: (value.amount / 100).toFixed(2),
                adjustment: 0.0,
                clientId: '',
                netSettlementAmount: (value.amount / 100).toFixed(2),
                razorpay_id: merchant.razorpay.razorpay_id,
                fromDate: new Date(startDateStr),
                tillDate: new Date(startDateStr),
                status: value.status,
                gateway: 'EDVIRON_RAZORPAY',
                utrNumber: value.utr,
                settlementDate: new Date(value.created_at * 1000).toISOString(),
                trustee: merchant.trustee_id,
                schoolId: merchant.school_id,
              });
              console.log(
                `Saving consolidated settlement report for ${merchant.school_name} (${merchant.razorpay.razorpay_id})`,
              );
              await report.save();
            } else {
              console.log(
                `Consolidated report already exists for ${merchant.school_name} (${merchant.razorpay.razorpay_id})`,
              );
            }
          }
        } catch (error) {
          throw new BadGatewayException(error.message);
        }
      }
    } catch (error) {
      throw new BadGatewayException(error.message);
    }
  }

  async updateBulkSettlement(
    allSettlements: any,
    trusteeId: string,
    schoolId: string,
    authId: string,
  ) {
    await Promise.all(
      allSettlements.map(async (data) => {
        const existingSettlement = await this.settlementReportModel.findOne({
          utrNumber: data.utr,
        });
        if (!existingSettlement) {
          try {
            const settlementDate = new Date(data.created_at * 1000);
            const createdAtDate = new Date(data.created_at * 1000);
            const status =
              data.status === 'processed'
                ? 'SUCCESS'
                : data.status === 'created'
                  ? 'Settled'
                  : 'fail';
            const settlementReport = new this.settlementReportModel({
              settlementAmount: data.amount / 100,
              adjustment: '0.0',
              netSettlementAmount: data.amount / 100,
              fromDate: createdAtDate,
              tillDate: createdAtDate,
              status: status,
              remarks: 'N/A',
              settlementInitiatedOn: settlementDate,
              utrNumber: data.utr,
              razorpay_id: authId,
              settlementDate: settlementDate,
              gateway: 'EDVIRON_RAZORPAY',
              trustee: new Types.ObjectId(trusteeId),
              schoolId: new Types.ObjectId(schoolId),
              createdAt: createdAtDate,
              updatedAt: createdAtDate,
            });
            console.log(settlementReport, 'settlementReport');
            await settlementReport.save();
            console.log('Inserted:', data.utr);
          } catch (err) {
            console.error('Error saving settlement:', data.utr, err);
          }
        } else {
          console.log('Already exists:', data.utr);
        }
      }),
    );
  }

  async delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async safeAxios(config, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.request({ ...config });
      return response;
    } catch (err) {
      console.error(`Retry ${i + 1}/${retries} failed:`, err.message || err);
      if (i < retries - 1) await this.delay(delayMs); // wait before retry
    }
  }
  throw new Error('All retries failed for request: ' + config.url);
}


}
