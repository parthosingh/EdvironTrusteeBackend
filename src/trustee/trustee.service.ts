import { JwtService } from '@nestjs/jwt';
import mongoose, { HydratedDocument, ObjectId, Types } from 'mongoose';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Body,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from '../schema/trustee.schema';
import {
  DisabledModes,
  PlatformCharge,
  TrusteeSchool,
  rangeCharge,
} from '../schema/school.schema';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as csvWriter from 'csv-writer';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { format } from 'date-fns';
import { TrusteeMember } from '../schema/partner.member.schema';
import { EmailService } from '../email/email.service';
import { TransactionInfo } from '../schema/transaction.info.schema';
import { RequestMDR, mdr_status } from '../schema/mdr.request.schema';
import { BaseMdr } from '../schema/base.mdr.schema';
import { SchoolMdr } from '../schema/school_mdr.schema';
import { Vendors } from '../schema/vendors.schema';
import { AwsS3Service } from '../aws.s3/aws.s3.service';
import QRCode from 'qrcode';
import { SettlementReport } from '../schema/settlement.schema';
import { refund_status, RefundRequest } from '../schema/refund.schema';
import { VendorsSettlement } from '../schema/vendor.settlements.schema';
import { Disputes } from '../schema/disputes.schema';
import { Reconciliation } from '../schema/Reconciliation.schema';
import { generateVendorStatusEmailTemplate } from '../email/templates/vendorstatus.template';
import {
  VENDOR_STATUS_EMAIL,
  VENDOR_CREATE_ALERT_EMAIL,
} from '../utils/email.group';
import { generateVendorRequestEmailTemplate } from '../email/templates/vendor_creat_alert.template';
import { EmailGroup } from 'src/schema/email.schema';
import { EmailEvent } from 'src/schema/email.events.schema';
import { getAdminEmailTemplate } from 'src/email/templates/dipute.template';
import { generateRefundMailReciept } from 'src/business-alarm/templates/htmlToSend.format';
import { BusinessAlarmService } from 'src/business-alarm/business-alarm.service';
import { ErrorLogs } from 'src/schema/error.log.schema';
import { ReportsLogs } from 'src/schema/reports.logs.schmea';
import { Parser } from 'json2csv';
import e from 'express';
import { url } from 'inspector';
import { log } from 'console';
import { SubTrustee } from 'src/schema/subTrustee.schema';

var otps: any = {}; //reset password
var editOtps: any = {}; // edit email
var editNumOtps: any = {}; // edit number
var apiOtps: any = {}; // create api keys
var deletOtps: any = {}; //delete member
var apiOtpTimeouts: any = {};
var resetOtpTimeouts: any = {};
var editMailOtpTimeouts: any = {};
var editNumOtpTimeouts: any = {};

@Injectable()
export class TrusteeService {
  constructor(
    private readonly emailService: EmailService,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    private jwtService: JwtService,
    private readonly awsS3Service: AwsS3Service,
    @InjectModel(TrusteeMember.name)
    private trusteeMemberModel: mongoose.Model<TrusteeMember>,
    @InjectModel(TransactionInfo.name)
    private transactionInfoModel: mongoose.Model<TransactionInfo>,
    @InjectModel(RequestMDR.name)
    private requestMDRModel: mongoose.Model<RequestMDR>,
    @InjectModel(BaseMdr.name)
    private baseMdrModel: mongoose.Model<BaseMdr>,
    @InjectModel(SchoolMdr.name)
    private schoolMdrModel: mongoose.Model<SchoolMdr>,
    @InjectModel(Vendors.name)
    private vendorsModel: mongoose.Model<Vendors>,
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
    @InjectModel(VendorsSettlement.name)
    private vendorsSettlementModel: mongoose.Model<VendorsSettlement>,
    @InjectModel(Disputes.name)
    private DisputesModel: mongoose.Model<Disputes>,
    @InjectModel(Reconciliation.name)
    private ReconciliationModel: mongoose.Model<Reconciliation>,
    @InjectModel(EmailGroup.name)
    private EmailGroupModel: mongoose.Model<EmailGroup>,
    @InjectModel(EmailEvent.name)
    private EmailEventModel: mongoose.Model<EmailEvent>,
    private businessServices: BusinessAlarmService,
    @InjectModel(ErrorLogs.name)
    private ErrorLogsModel: mongoose.Model<ErrorLogs>,
    @InjectModel(ReportsLogs.name)
    private ReportsLogsModel: mongoose.Model<ReportsLogs>,
    @InjectModel(SubTrustee.name)
    private SubTrusteeModel: mongoose.Model<SubTrustee>,
  ) { }

  async loginAndGenerateToken(
    emailId: string,
    passwordHash: string,
  ): Promise<{ token: string }> {
    try {
      // Try to find the user in the trustee database
      const trustee = await this.trusteeModel.findOne({ email_id: emailId });
      if (trustee) {
        // User found in trustee database, proceed with trustee authentication
        const passwordMatch = await bcrypt.compare(
          passwordHash,
          trustee.password_hash,
        );

        if (!passwordMatch) {
          throw new UnauthorizedException('Invalid credentials');
        }
        const payload = {
          id: trustee._id,
          role: 'owner',
        };

        return {
          token: await this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
            expiresIn: '30d',
          }),
        };
      }

      const member = await this.trusteeMemberModel.findOne({ email: emailId });
      if (member) {
        const passwordMatch = await bcrypt.compare(
          passwordHash,
          member.password_hash,
        );

        if (!passwordMatch) {
          throw new UnauthorizedException('Invalid credentials');
        }
        const payload = {
          id: member._id,
          role: member.access,
        };

        return {
          token: await this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
            expiresIn: '30d',
          }),
        };
      }

      throw new UnauthorizedException('Invalid credentials');
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async validateTrustee(token: string): Promise<any> {
    try {
      const decodedPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
      });
      const trustee = await this.trusteeModel.findById(decodedPayload.id);

      if (trustee) {
        const baseMdr = await this.baseMdrModel.findOne({
          trustee_id: trustee._id,
        });
        const userTrustee = {
          id: trustee._id,
          name: trustee.name,
          email: trustee.email_id,
          apiKey: trustee.apiKey || null,
          phone_number: trustee.phone_number,
          role: 'owner',
          trustee_id: trustee._id,
          brand_name: trustee.brand_name || null,
          base_mdr: baseMdr,
        };
        return userTrustee;
      }
      const member = await this.trusteeMemberModel.findById(decodedPayload.id);
      if (member) {
        const trustee = await this.trusteeModel.findById(member.trustee_id);
        const baseMdr = await this.baseMdrModel.findOne({
          trustee_id: trustee._id,
        });
        const userTrustee = {
          id: member._id,
          name: member.name,
          email: member.email,
          apiKey: trustee.apiKey || null,
          role: member.access || null,
          phone_number: member.phone_number,
          trustee_id: member.trustee_id || null,
          brand_name: trustee.brand_name || null,
          base_mdr: baseMdr,
        };
        return userTrustee;
      }
      throw new NotFoundException('User not found');
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getSchools(
    trusteeId: string,
    searchQuery: string,
    page: number,
    limit: number,
    kycStatus: string[],
  ) {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeID format');
      }
      const trusteeObjectId = new mongoose.Types.ObjectId(trusteeId);

      const trustee = await this.trusteeModel.findById(trusteeId);

      const pageNumber = page || 1;
      const pageSize = limit || 10;
      const skip = (pageNumber - 1) * pageSize;

      let searchFilter: any = {
        trustee_id: trusteeObjectId,
        ...(searchQuery
          ? Types.ObjectId.isValid(searchQuery)
            ? { school_id: new mongoose.Types.ObjectId(searchQuery) }
            : {
              $or: [
                { school_name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } },
                { pg_key: { $regex: searchQuery, $options: 'i' } },
              ],
            }
          : {}),
      };
      if (kycStatus && kycStatus.length > 0) {
        searchFilter = {
          ...searchFilter,
          merchantStatus: { $in: kycStatus },
        };
      }
      if (!trustee) {
        throw new ConflictException(`no trustee found`);
      }

      const totalItems =
        await this.trusteeSchoolModel.countDocuments(searchFilter);
      const totalPages = Math.ceil(totalItems / pageSize);

      const schools = await this.trusteeSchoolModel
        .aggregate([
          {
            $match: searchFilter,
          },
          {
            $project: {
              school_id: 1,
              school_name: 1,
              merchantStatus: 1,
              _id: 1,
              email: 1,
              pg_key: 1,
              disabled_modes: 1,
              platform_charges: 1,
              phone_number: 1,
              updatedAt: 1,
              bank_details: 1,
              gstIn: 1,
              residence_state: 1,
              createdAt: 1,
            },
          },
          {
            $sort: { createdAt: -1, _id: -1 },
          },
          {
            $skip: skip,
          },
          {
            $limit: pageSize,
          },
        ])
        .exec();

      const schoolsWithBankDetails = await Promise.all(
        schools.map(async (school) => {
          try {
            const school_id = school.school_id.toString();
            const tokenAuth = this.jwtService.sign(
              { school_id },
              { secret: process.env.JWT_SECRET_FOR_INTRANET! },
            );
            const response = await axios.get(
              `${process.env.MAIN_BACKEND_URL}/api/trustee/get-school-kyc?school_id=${school_id}&token=${tokenAuth}`,
            );

            const bankDetails = {
              account_holder_name:
                response?.data?.bankDetails?.account_holder_name ||
                school.bank_details?.account_holder_name ||
                null,
              account_number:
                response?.data?.bankDetails?.account_number ||
                school.bank_details?.account_number ||
                null,
              ifsc_code:
                response?.data?.bankDetails?.ifsc_code ||
                school.bank_details?.ifsc_code ||
                null,
            };
            return {
              ...school,
              bank_details: bankDetails,
            };
          } catch (error) {
            console.error(
              `Failed to fetch bank details for school_id: ${school.school_id}`,
              error.message,
            );
            return {
              ...school,
              // bank_details: null,
            };
          }
        }),
      );

      return {
        schoolData: schoolsWithBankDetails,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
        },
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }
  async getTrusteeSchools(trusteeId: string, page: number) {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeID format');
      }
      const trusteeObjectId = new mongoose.Types.ObjectId(trusteeId);

      const trustee = await this.trusteeModel.findById(trusteeId);

      if (!trustee) {
        throw new ConflictException(`no trustee found`);
      }
      const count = await this.trusteeSchoolModel.countDocuments({
        trustee_id: trusteeObjectId,
      });
      const pageSize = 10;
      const schools = await this.trusteeSchoolModel
        .find({ trustee_id: trusteeObjectId })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

      return { schoolData: schools, total_pages: Math.ceil(count / pageSize) };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  async generateSchoolToken(
    schoolId: string,
    password: string,
    trusteeId: string,
  ) {
    try {
      const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
      // Parallel execution of database queries using Promise.all()
      const [school, trustee] = await Promise.all([
        this.trusteeSchoolModel.findOne({ school_id: schoolObjectId }),
        this.trusteeModel.findById(trusteeId),
      ]);

      // Specific error handling using custom error classes
      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }
      if (!school) {
        throw new NotFoundException('School not found!');
      }
      if (school.trustee_id.toString() !== trustee._id.toString())
        throw new NotFoundException('School not found for trustee');

      // Password validation and JWT token generation
      const passwordMatch = await bcrypt.compare(
        password,
        trustee.password_hash,
      );
      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const data = { schoolId: school.school_id };
      const token = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      // Making a POST request to an external endpoint
      const schoolToken = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/gen-school-token`,
        {
          token: token,
        },
      );
      return schoolToken.data;
    } catch (error) {
      // Structured error handling for different scenarios
      if (error.response) {
        throw error;
      } else if (error.request) {
        throw new BadRequestException('No response received from the server');
      } else if (
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      )
        throw error;
      else {
        throw new BadRequestException('Request setup error');
      }
    }
  }

  async sendMails(email, mailOptions) {
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

      const info = await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error.message);
    }
  }

  async sentResetMail(email) {
    try {
      const expirationTime = Math.floor(Date.now() / 1000) + 1 * 60; // 30 minutes
      const secretKey = process.env.JWT_SECRET_FOR_RESETPASSWORD_LINK;
      const data = {
        email: email,
        // exp: expirationTime
      };
      const token = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: expirationTime, //30 mins
      });

      const resetURL = `${process.env.TRUSTEE_DASHBOARD_URL}/reset-password?token=${token}`;
      const __dirname = path.resolve();
      const filePath = path.join(
        __dirname,
        'src/trustee/reset-mail-template.html',
      );
      const source = fs.readFileSync(filePath, 'utf-8').toString();
      const template = handlebars.compile(source);

      const replacements = {
        email: email,
        url: resetURL,
      };

      const htmlToSend = template(replacements);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Reset password',
        html: htmlToSend,
      };

      await this.sendMails(email, mailOptions);
      return true;
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error.message);
    }
  }

  async sendMemberCredentialsMail(email, password) {
    try {
      const __dirname = path.resolve();
      const filePath = path.join(
        __dirname,
        'src/trustee/member-credentials-template.html',
      );
      const source = fs.readFileSync(filePath, 'utf-8').toString();
      const template = handlebars.compile(source);

      const replacements = {
        email: email,
        password: password,
        url: 'https://partner.edviron.com/login',
      };

      const htmlToSend = template(replacements);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Login Credentials',
        html: htmlToSend,
      };

      await this.sendMails(email, mailOptions);
      return true;
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error.message);
    }
  }

  async resetPassword(email, password) {
    try {
      const trustee = await this.trusteeModel.findOne({ email_id: email });
      if (trustee) {
        trustee.password_hash = password;
        await trustee.save();
        return true;
      }
      const member = await this.trusteeMemberModel.findOne({ email });
      if (member) {
        member.password_hash = password;
        await member.save();
      }
      return false;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async verifyresetToken(token) {
    try {
      const data = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });
      return true;
    } catch (err) {
      // console.log(err);
      return false;
    }
  }

  async updatePartnerDetails(user_id, name, email, phone_number, password) {
    const trustee = await this.trusteeModel.findById(user_id);
    const passwordMatch = await bcrypt.compare(password, trustee.password_hash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Incorrect Password');
    }
    trustee.name = name;
    trustee.email_id = email;
    trustee.phone_number = phone_number;

    try {
      await trustee.save();
      return { message: `${name} details updated successfully` };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async updateMemberDetails(user_id, name, email, phone_number) {
    try {
      const member = await this.trusteeMemberModel.findOne({ _id: user_id });
      if (member) {
        member.name = name;
        member.email = email;
        member.phone_number = phone_number;
        await member.save();
        return { message: 'Member details updated successfully' };
      } else {
        throw new Error('Member not found');
      }
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async sentPasswordOtpMail(email) {
    if (otps[email]) {
      throw new Error('you cannot send another OTP before 3 Min');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    otps[email] = otp;
    setTimeout(() => {
      delete otps[email];
      console.log(`passsword otpotp deleted`, { email });
    }, 180000); //3 mins

    const mail = await this.emailService.sendOTPMail(
      email,
      'OTP for Changing Password',
      `${otp}`,
    );
    if (mail) {
      return true;
    }
  }

  async sendWebhookKeyMail(email: string) {
    try {
      if (otps[email]) {
        throw new Error('you cannot send another OTP before 3 Min');
      }
      const otp = Math.floor(100000 + Math.random() * 900000);
      otps[email] = otp;
      setTimeout(() => {
        delete otps[email];
      }, 180000);
      const mail = await this.emailService.sendOTPMail(
        email,
        'OTP for Generate Webhook Key',
        `${otp}`,
      );
      if (mail) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      throw new BadRequestException(error.message || 'Something went wrong');
    }
  }

  async validatePasswordOtp(otp: string, email: string) {
    if (otps[email] == otp) {
      delete otps[email];
      const trustee = await this.trusteeModel.findOne({
        email_id: email,
      });
      if (trustee) {
        return true;
      }
    }
    return false;
  }

  async sentApiOtpMail(email) {
    if (apiOtps[email]) {
      throw new Error('you cannot send another OTP before 3 Min');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    apiOtps[email] = otp;
    setTimeout(() => {
      delete apiOtps[email];
      console.log(`API KEY otp deleted`, { email });
    }, 180000); //3 mins

    const mail = await this.emailService.sendOTPMail(
      email,
      'OTP for genrating API KEY',
      `${otp}`,
    );
    if (mail) {
      return true;
    }
  }

  async validateApidOtp(otp: string, email: string) {
    if (apiOtps[email] == otp) {
      delete apiOtps[email];
      const trustee = await this.trusteeModel.findOne({
        email_id: email,
      });
      if (trustee) {
        return true;
      }
    }
    return false;
  }

  // update email
  async sentUpdateOtpMail(email) {
    if (editOtps[email]) {
      throw new Error('you cannot send another OTP before 3 Min');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    editOtps[email] = otp;
    setTimeout(() => {
      delete editOtps[email];
      console.log('reset otp deleted', { email });
    }, 180000); //3 mins

    const mail = await this.emailService.sendOTPMail(
      email,
      'Update email address',
      `${otp}`,
    );
    if (mail) {
      return true;
    }
  }

  async validateUpdateMailOtp(otp, email) {
    if (editOtps[email] == otp) {
      delete editOtps[email];
      const trustee = await this.trusteeModel.findOne({
        email_id: email,
      });
      if (trustee) {
        return true;
      }
    }
    return false;
  }

  async sentUpdateNumberOtp(email) {
    if (editNumOtps[email]) {
      throw new Error('you cannot send another OTP before 3 Min');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    editNumOtps[email] = otp;
    setTimeout(() => {
      delete editNumOtps[email];
      console.log('reset otp deleted', { email });
    }, 180000); //3 mins

    const mail = await this.emailService.sendOTPMail(
      email,
      'Update Phone Number OTP',
      `${otp}`,
    );
    if (mail) {
      return true;
    }
  }

  async validatePhoneNumberOtp(otp, email) {
    if (editNumOtps[email] == otp) {
      delete editNumOtps[email];
      const trustee = await this.trusteeModel.findOne({
        email_id: email,
      });
      if (trustee) {
        return true;
      }
    }
    return false;
  }

  async sentDeleteOtp(email) {
    if (deletOtps[email]) {
      throw new Error('you cannot send another OTP before 3 Min');
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    deletOtps[email] = otp;
    setTimeout(() => {
      delete deletOtps[email];
      console.log('reset otp deleted', { email });
    }, 180000); //3 mins

    const mail = await this.emailService.sendOTPMail(
      email,
      'Update Delete Member',
      `${otp}`,
    );
    if (mail) {
      return true;
    }
  }

  async validateDeleteOtp(otp: string, email: string) {
    if (deletOtps[email] == otp) {
      delete deletOtps[email];
      const trustee = await this.trusteeModel.findOne({
        email_id: email,
      });
      if (trustee) {
        return true;
      }
    }
    return false;
  }

  async validateOtp(otp: string, email: string) {
    if (otps[email] == otp) {
      delete otps[email];
      const trustee = await this.trusteeModel.findOne({
        email_id: email,
      });
      if (trustee) {
        return true;
      }
    }
    return false;
  }

  async trusteeRefunds(trustee_id: string) {
    const response = await axios.get(
      `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/partner-refunds?trustee_id=${trustee_id}`,
    );
    return response.data;
  }

  async merchantsRefunds(school_id: string) {
    const response = await axios.get(
      `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/merchant-refunds?school_id=${school_id}`,
    );
    return response.data;
  }

  async orderRefunds(order_id: string) {
    const response = await axios.get(
      `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/order-refunds?order_id=${order_id}`,
    );
    return response.data;
  }
  async createRemark(collect_id: string, remark: string, trustee_id: ObjectId) {
    const collectIdObj = new Types.ObjectId(collect_id);
    const updatedDocument = await this.transactionInfoModel.findOneAndUpdate(
      { collect_id: collectIdObj },
      { remarks: remark, trustee_id },
      { upsert: true, new: true },
    );
    console.log(updatedDocument);

    return updatedDocument;
  }

  async getRemarks(collect_id: string) {
    const collectIdObj = new Types.ObjectId(collect_id);
    return await this.transactionInfoModel.findOne({
      collect_id: collectIdObj,
    });
  }

  async deleteRemark(collect_id: string) {
    const collectIdObj = new Types.ObjectId(collect_id);
    const checkRemark = await this.transactionInfoModel.findOne({
      collect_id: collectIdObj,
    });
    if (!checkRemark) {
      throw new NotFoundException('remark not found');
    }
    await this.transactionInfoModel.findOneAndDelete({
      collect_id: collectIdObj,
    });
    return `Remark deleted Successfully`;
  }

  async createMdrRequest(
    trustee_id: ObjectId,
    school_id: string[],
    platform_chargers: PlatformCharge[],
    description: string,
  ) {
    try {
      // Ensure there are no duplicate school IDs in the school_id array
      const uniqueSchoolIds = new Set(school_id);
      if (uniqueSchoolIds.size !== school_id.length) {
        throw new Error('Duplicate school IDs found in school_id array');
      }

      const trusteeSchools = await this.trusteeSchoolModel.find(
        { trustee_id },
        { school_id: 1 },
      );

      const trusteeSchoolIds = trusteeSchools.map((school) =>
        school.school_id.toString(),
      );

      // Ensure all school IDs in school_id array are associated with the trustee
      const invalidSchools = school_id.filter(
        (id) => !trusteeSchoolIds.includes(id),
      );
      if (invalidSchools.length > 0) {
        // throw new NotFoundException('School not found');
        throw new Error(`Invalid school IDs: ${invalidSchools.join(', ')}`);
      }

      //find latest request of trustee
      let mdr = await this.requestMDRModel
        .findOne({ trustee_id })
        .sort({ createdAt: -1 });

      // case : if request is alredy present then trustee can rise a new request for other school
      const commonSchoolIds = [];
      for (const id of school_id) {
        const result = await this.requestMDRModel
          .findOne({
            school_id: { $in: [id] },
          })
          .sort({ createdAt: -1 });
        if (
          result !== null &&
          (result.status === mdr_status.INITIATED ||
            result.status === mdr_status.PROCESSING)
        )
          commonSchoolIds.push(result);
      }
      if (commonSchoolIds.length > 0) {
        throw new Error('Request already raised for some selected schools');
      }

      const baseMdr = await this.baseMdrModel.findOne({
        trustee_id: trustee_id,
      });
      if (!baseMdr)
        throw new NotFoundException('Base rate not set for trustee');

      const base_platform_charges = baseMdr?.platform_charges;

      // case: if range is not correct as per base rates
      const verify = this.verifyRanges(
        base_platform_charges,
        platform_chargers,
      );

      if (
        !mdr &&
        ![mdr_status.REJECTED, mdr_status.APPROVED].includes(mdr?.status)
      ) {
        console.log('not found old');

        mdr = await this.requestMDRModel.create({
          trustee_id,
          school_id,
          platform_charges: platform_chargers,
          status: mdr_status.INITIATED,
          description,
        });

        return 'New MDR created';
      }

      mdr = await this.requestMDRModel.create({
        trustee_id,
        school_id,
        platform_charges: platform_chargers,
        status: mdr_status.INITIATED,
        description,
      });

      return 'New MDR request created';
    } catch (error) {
      console.log(error);

      if (error?.response) throw new Error(error?.response.message);
      throw new Error(error.message);
    }
  }

  async updateMdrRequest(
    request_id: ObjectId,
    platform_chargers: PlatformCharge[],
    comment: string,
    trustee_id: ObjectId,
  ) {
    try {
      const mdr = await this.requestMDRModel.findById(request_id);
      if (mdr.status == mdr_status.CANCELLED) {
        throw new ConflictException('You cannot edit request after cancelling');
      }
      if (mdr.status !== mdr_status.INITIATED) {
        throw new ConflictException('You cannot edit request after review');
      }

      const baseMdr = await this.baseMdrModel.findOne({
        trustee_id: trustee_id,
      });
      this.verifyRanges(baseMdr.platform_charges, platform_chargers);

      await this.requestMDRModel.findOneAndUpdate(
        { _id: request_id },
        {
          $set: { platform_charges: platform_chargers, comment: comment },
        },
      );
      return `MDR Request Updated`;
    } catch (error) {
      if (error?.response) throw new Error(error?.response.message);
      throw new Error(error.message);
    }
  }

  async saveBulkMdr(trustee_id: string, platform_charges: PlatformCharge[]) {
    console.log('update req received', { trustee_id, platform_charges });
    const trusteeId = new Types.ObjectId(trustee_id);
    let existingCharges = (
      (await this.baseMdrModel.findOne({
        trustee_id: trusteeId,
      })) as BaseMdr
    )?.platform_charges;
    if (!existingCharges) existingCharges = [];
    console.log({ fromdb: existingCharges });
    existingCharges = existingCharges.filter((charge) => {
      for (var newCharge of platform_charges) {
        if (
          charge.platform_type === newCharge.platform_type &&
          charge.payment_mode === newCharge.payment_mode
        ) {
          return false;
        }
      }
      return true;
    });
    console.log({ filtered: existingCharges });
    existingCharges.push(...platform_charges);
    console.log('final charges', existingCharges);
    await this.baseMdrModel.findOneAndUpdate(
      {
        trustee_id: trusteeId,
      },
      {
        trustee_id: trusteeId,
        platform_charges: existingCharges,
      },
      { upsert: true, new: true },
    );

    const trusteeSchools = await this.trusteeSchoolModel.find({
      trustee_id: trusteeId,
    });
    for (const school of trusteeSchools) {
      const schoolMdr = await this.trusteeSchoolModel.findOneAndUpdate(
        { school_id: school.school_id },
        { platform_charges: existingCharges, school_id: school.school_id },
        { new: true, upsert: true },
      );
    }

    return 'mdr updated';
  }

  async rejectMdr(id: string, comment: string) {
    const mdr = await this.requestMDRModel.findById(id);
    mdr.status = mdr_status.REJECTED;
    mdr.comment = comment;
    await mdr.save();
    return 'status updated';
  }

  async getTrusteeMdrRequest(trustee_id: string) {
    const trusteeId = new Types.ObjectId(trustee_id);
    const baseMdr = await this.baseMdrModel.findOne({ trustee_id: trusteeId });
    if (!baseMdr) throw new NotFoundException('Base MDR not set for Trustee');
    const mdrReqs = await this.requestMDRModel.find({ trustee_id: trusteeId });
    console.log(mdrReqs.length);

    // return await this.requestMDRModel.find({ trustee_id: trusteeId });
    const mappedData = (
      await Promise.all(
        mdrReqs.map(async (mdrReq) => {
          return await this.mapMdrReqData(baseMdr, mdrReq);
        }),
      )
    ).flat();

    return mappedData;
  }

  async getTrusteeBaseMdr(trustee_id: string) {
    const trusteeId = new Types.ObjectId(trustee_id);
    return await this.baseMdrModel.findOne({ trustee_id: trusteeId });
  }

  async getTrusteeBaseMdrData(trustee_id: string) {
    const trusteeId = new Types.ObjectId(trustee_id);
    const baseMdr = await this.baseMdrModel.findOne({ trustee_id: trusteeId });
    if (!baseMdr) throw new NotFoundException('Base MDR not set for Trustee');
    return baseMdr.platform_charges;
  }

  async toogleDisable(mode: DisabledModes, school_id: string) {
    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    let status = '';
    if (!school) {
      throw new Error(`Schoolnot found.`);
    }
    const { disabled_modes } = school;

    const checkIndex = disabled_modes.indexOf(mode);
    const isModeDisabled = checkIndex !== -1;
    if (isModeDisabled) {
      status = 'enabled';
      disabled_modes.splice(checkIndex, 1);
    } else {
      status = 'disabled';
      disabled_modes.push(mode);
    }

    await this.trusteeSchoolModel.findOneAndUpdate(
      { school_id: new Types.ObjectId(school_id) },
      { disabled_modes },
      { new: true },
    );

    return `${mode} ${status}`;
  }

  async getSchoolMdr(school_id: string): Promise<SchoolMdr> {
    try {
      const schoolId = new Types.ObjectId(school_id);
      let school = await this.trusteeSchoolModel.findOne({
        school_id: schoolId,
      });
      if (!school) {
        school = await this.trusteeSchoolModel.findOne({
          school_id: school_id,
        });
        if (!school) throw new NotFoundException('School not found');
      }
      console.log(schoolId);
      return {
        school_id: school.school_id,
        mdr2: school.platform_charges,
        updatedAt: school.updatedAt,
      };

      let schoolMdr = await this.schoolMdrModel.findOne({
        school_id: schoolId,
      });
      if (!schoolMdr) {
        schoolMdr = await this.schoolMdrModel.findOne({
          school_id: school_id,
        });
      }
      return schoolMdr;
    } catch (err) {
      if (err.response?.statusCode === 400) {
        throw new BadRequestException(err.message);
      } else if (err.response?.statusCode === 404) {
        throw new NotFoundException(err.message);
      }
      throw new Error(err.message);
    }
  }

  async getTransactionCommision(school_id) {
    let transactionReport = [];

    if (!school_id) return transactionReport;

    let token = this.jwtService.sign(
      { school_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );

    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/transactions-report?limit=50000`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: { school_id: school_id, token },
    };

    const response = await axios.request(config);

    if (
      response.data.length == 0 &&
      response.data == 'No orders found for clientId'
    ) {
      console.log('No transactions for merchant');

      return transactionReport;
    }

    transactionReport = [...response.data.transactions];

    transactionReport.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return transactionReport;
  }

  async getSchoolMdrInfo(school_id: string, trustee_id: ObjectId) {
    const baseMdr = await this.getTrusteeBaseMdr(trustee_id.toString());
    const schoolMdr: any = await this.getSchoolMdr(school_id);

    const info: any = await this.mapMdrData(baseMdr, schoolMdr);
    let updated_at = null;
    if (schoolMdr) {
      updated_at = schoolMdr?.updatedAt;
    }

    return { info, updated_at };
  }

  async mapMdrData(baseMdr: any, schoolMdr: any) {
    const mappedData = [];
    // Iterate over each platform type in baseMdr
    for (const basePlatform of baseMdr.platform_charges) {
      const schoolPlatform = schoolMdr?.mdr2.find(
        (schoolPlatform) =>
          schoolPlatform.platform_type === basePlatform.platform_type &&
          schoolPlatform.payment_mode === basePlatform.payment_mode,
      );

      if (schoolPlatform) {
        // Create a new mapped object combining data from baseMdr and schoolMdr
        const mappedObject = {
          platform_type: basePlatform.platform_type,
          payment_mode: basePlatform.payment_mode,
          range_charge: [],
        };

        // Iterate over each range charge in the baseMdr platform
        basePlatform.range_charge.forEach((baseCharge) => {
          const schoolCharge = schoolPlatform.range_charge.find(
            (schoolCharge) => schoolCharge.upto === baseCharge.upto,
          );

          if (schoolCharge) {
            // Create a combined charge object
            const commission = schoolCharge.charge - baseCharge.charge;
            const combinedCharge = {
              upto: baseCharge.upto,
              charge_type: schoolCharge.charge_type,
              base_charge: baseCharge.charge,
              base_charge_type: baseCharge.charge_type,
              charge: schoolCharge.charge,
              commission: commission,
            };

            // Push the combined charge object to range_charge array in mappedObject
            mappedObject.range_charge.push(combinedCharge);
          }
        });

        // Push the mappedObject to the final mappedData array
        mappedData.push(mappedObject);
      }
    }

    return mappedData;
  }

  async mapMdrReqData(baseMdr: any, reqMdr: any) {
    const mappedData = {
      platform_charges: [],
      school_id: [],
      trustee_id: reqMdr.trustee_id,
      status: reqMdr.status,
      comment: reqMdr?.comment,
      description: reqMdr?.description,
      createdAt: reqMdr.createdAt,
      updatedAt: reqMdr.updatedAt,
      _id: reqMdr._id,
    };

    // Iterate over each platform type in baseMdr
    for (const basePlatform of baseMdr.platform_charges) {
      const schoolMdrReq = reqMdr?.platform_charges.find(
        (schoolMdrReq) =>
          schoolMdrReq.platform_type === basePlatform.platform_type &&
          schoolMdrReq.payment_mode === basePlatform.payment_mode,
      );

      if (schoolMdrReq) {
        const platformCharge = {
          platform_type: basePlatform.platform_type,
          payment_mode: basePlatform.payment_mode,
          range_charge: [],
        };

        // Iterate over each range charge in the baseMdr platform
        basePlatform.range_charge.forEach((baseCharge) => {
          const schoolCharge = schoolMdrReq.range_charge.find(
            (schoolCharge) => schoolCharge.upto === baseCharge.upto,
          );

          if (schoolCharge) {
            // Create a combined charge object
            let commission;

            if (schoolCharge.charge_type === baseCharge.charge_type) {
              commission =
                schoolCharge.charge_type === 'PERCENT'
                  ? `${(schoolCharge.charge - baseCharge.charge).toFixed(2)}%`
                  : `₹${(schoolCharge.charge - baseCharge.charge).toFixed(2)}`;
            } else {
              const schoolValue = schoolCharge.charge.toFixed(2);
              const baseValue = baseCharge.charge.toFixed(2);

              const schoolPart =
                schoolCharge.charge_type === 'PERCENT'
                  ? `${schoolValue}%`
                  : `₹${schoolValue}`;
              const basePart =
                baseCharge.charge_type === 'PERCENT'
                  ? `${baseValue}%`
                  : `₹${baseValue}`;

              commission = `${schoolPart} - ${basePart}`;
            }

            // const commission = schoolCharge.charge - baseCharge.charge;
            const combinedCharge = {
              upto: baseCharge.upto,
              charge_type: schoolCharge.charge_type,
              base_charge: baseCharge?.charge.toFixed(2),
              base_charge_type: baseCharge.charge_type,
              charge: schoolCharge?.charge.toFixed(2),
              commission: commission,
            };

            // Push the combined charge object to the range_charge array in platformCharge
            platformCharge.range_charge.push(combinedCharge);
          }
        });

        // Push the platformCharge object to platform_charges array in mappedData
        mappedData.platform_charges.push(platformCharge);
      }
    }

    // Aggregate school_ids
    mappedData.school_id.push(...reqMdr.school_id);

    return mappedData;
  }

  verifyRanges(
    basePlatformCharges: PlatformCharge[],
    newPlatformCharges: PlatformCharge[],
  ): boolean {
    const getUpperBound = (range: rangeCharge): number =>
      range.upto === null ? Infinity : range.upto;

    const newMap: { [key: string]: rangeCharge[] } = {};
    for (const newPlatformCharge of newPlatformCharges) {
      const key = `${newPlatformCharge.platform_type}-${newPlatformCharge.payment_mode}`;
      newMap[key] = newPlatformCharge.range_charge;
      // Track 'upto' values to check for duplicates
      const seenUptoValues: Set<number> = new Set();
      for (const range of newPlatformCharge.range_charge) {
        const upperBound = getUpperBound(range);
        if (seenUptoValues.has(upperBound)) {
          throw new ConflictException(
            `Duplicate 'upto' value (${upperBound}) found in new ranges for : ${key}`,
          );
        }
        seenUptoValues.add(upperBound);
      }
    }

    for (const basePlatformCharge of basePlatformCharges) {
      const key = `${basePlatformCharge.platform_type}-${basePlatformCharge.payment_mode}`;
      const newRanges = newMap[key];

      // If no corresponding new ranges are found, throws error
      if (!newRanges) {
        throw new NotFoundException(`No new ranges found for : ${key}`);
      }

      // Check if every 'upto' value in base ranges is covered by the new ranges
      const newUptoValues = new Set(
        newRanges.map((range) => getUpperBound(range)),
      );
      for (const baseRange of basePlatformCharge.range_charge) {
        if (!newUptoValues.has(getUpperBound(baseRange))) {
          throw new ConflictException(
            `Upto value ${getUpperBound(
              baseRange,
            )} in base range not covered by new ranges for : ${key}`,
          );
        }
      }

      // Check for overlaps within the new ranges themselves
      // const sortedNewRanges = newRanges.sort((a, b) => (getUpperBound(a) - getUpperBound(b)));
      // for (let i = 1; i < sortedNewRanges.length; i++) {
      //   const prevRange = sortedNewRanges[i - 1];
      //   const currRange = sortedNewRanges[i];
      //   const prevUpper = getUpperBound(prevRange);
      //   const currLower = currRange.upto === null ? Infinity : currRange.upto;

      //   if (prevUpper > currLower) {
      //     throw new ConflictException(`Overlap found: ${prevUpper} (previous upper) > ${currLower} (current lower) for key: ${key}`);
      //   }
      // }
    }

    return true;
  }

  async cancelMdrRequest(trustee: ObjectId, req_id: ObjectId) {
    const mdrReq = await this.requestMDRModel.findById(req_id);
    if (mdrReq.trustee_id! == trustee)
      throw new NotFoundException('Request not found for trustee');
    const updated = await this.requestMDRModel.findByIdAndUpdate(req_id, {
      status: mdr_status.CANCELLED,
    });
    return 'MDR Request cancelled';
  }

  async createWebhooks(trustee, webhookUrl) {
    try {
      const urlRegex = /^https:\/\/([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

      if (!urlRegex.test(webhookUrl)) {
        throw new BadRequestException(
          'Please provide a valid https webhook url',
        );
      }

      if (webhookUrl.endsWith('/')) {
        webhookUrl = webhookUrl.slice(0, -1);
      }

      const oldWebhooks = trustee.webhook_urls;
      const oldWebhookUrls = oldWebhooks.map((webhook) => webhook.url);
      const oldWebhookIds = oldWebhooks
        .map((webhook) => webhook.id)
        .sort((a, b) => b - a);
      if (oldWebhookUrls.includes(webhookUrl)) {
        throw new BadRequestException(` ${webhookUrl} already exists`);
      }

      const newWebhook = {
        id: oldWebhookUrls.length ? oldWebhookIds[0] + 1 : 1,
        url: webhookUrl,
      };

      const updatedWebhooks = await this.trusteeModel.findByIdAndUpdate(
        trustee._id,
        {
          $push: {
            webhook_urls: newWebhook,
          },
        },
        {
          new: true,
        },
      );

      if (!updatedWebhooks) {
        throw new Error('Error updating webhook urls');
      }

      return `Webhook created successfully`;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async testWebhook(webhookUrl): Promise<boolean> {
    const dummyData = {
      collect_id: '66099e5f11a775b1834564f9',
      amount: 10,
      status: 'SUCCESS',
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0X2lkIjoiNjYwOTllNWYxMWE3NzViMTgzNDU2NGY5IiwiYW1vdW50IjoxMCwic3RhdHVzIjoiU1VDQ0VTUyJ9.QCUkDrDU7_Jy4JDa_Ch5WbJT6b5TfeOJJSJLLo63vB0',
    };
    try {
      const response = await axios.post(webhookUrl, {
        data: dummyData,
      });
      return true;
    } catch (error) {
      console.log(error.code);
      if (error.code == 'ERR_BAD_REQUEST') return false;
    }
  }

  async deleteWebhook(trustee, webhook_id) {
    {
      try {
        const webHooks = trustee.webhook_urls;
        const webHookIds = webHooks.map((webhook) => webhook.id);

        if (!webHookIds.includes(webhook_id)) {
          throw new BadRequestException('Webhook not found');
        }

        const updatedWebhooks = await this.trusteeModel.findByIdAndUpdate(
          trustee._id,
          {
            $pull: {
              webhook_urls: { id: webhook_id },
            },
          },
          {
            new: true,
          },
        );

        return `Webhook deleted successfully`;
      } catch (error) {
        throw new Error(error.message);
      }
    }
  }

  async generateToken(id: Types.ObjectId) {
    const payload = { id };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET_FOR_MERCHANT_AUTH,
    });
  }

  async onboardVendor(
    client_id: string,
    trustee_id: string,
    school_id: string,
    school_name: string,
    vendor_info: {
      status: string;
      name: string;
      email: string;
      phone: string;
      verify_account: boolean;
      dashboard_access: boolean;
      schedule_option: number;
      bank: { account_number: string; account_holder: string; ifsc: string };
      kyc_details: {
        account_type: string;
        business_type: string;
        uidai?: string;
        gst?: string;
        cin?: string;
        pan?: string;
        passport_number?: string;
      };
    },
    chequeBase64: string,
    chequeExtension: string,
  ) {
    // const checkVendors = await this.vendorsModel.findOne({
    //   email: vendor_info.email,
    // });
    // if (checkVendors) {
    //   throw new BadRequestException('Vendor already exists with this email');
    // }
    // const checkVendorNumber = await this.vendorsModel.findOne({
    //   phone: vendor_info.phone,
    // });
    // if (checkVendorNumber) {
    //   throw new BadRequestException(
    //     'Vendor already exists with this phone number',
    //   );
    // }
    try {
      const newVendor = await new this.vendorsModel({
        school_id: new Types.ObjectId(school_id),
        trustee_id: new Types.ObjectId(trustee_id),
        name: vendor_info.name,
        email: vendor_info.email,
        phone: vendor_info.phone,
        client_id,
        status: 'INITIATED',
        schedule_option: vendor_info.schedule_option,
        bank_details: vendor_info.bank,
        kyc_info: vendor_info.kyc_details,
      }).save();
      const url = await this.uploadCheque(
        newVendor._id.toString(),
        chequeBase64,
        chequeExtension,
      );
      newVendor.cheque = url;

      // return url
      // const token = this.jwtService.sign(
      //   { client_id },
      //   {
      //     secret: process.env.PAYMENTS_SERVICE_SECRET,
      //   },
      // );

      // const data = {
      //   token,
      //   client_id,
      //   vendor_info: { vendor_id: newVendor._id.toString(), ...vendor_info },
      // };

      // let config = {
      //   method: 'post',
      //   maxBodyLength: Infinity,
      //   url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/create-vendor`,
      //   headers: {
      //     accept: 'application/json',
      //     'content-type': 'application/json',
      //   },
      //   data,
      // };
      // const response = await axios.request(config);
      // const updatedStatus = response.data.status;
      // newVendor.status = updatedStatus;
      // newVendor.email = vendor_info.email;
      // newVendor.phone = vendor_info.phone;

      newVendor.vendor_id = newVendor._id.toString();
      await newVendor.save();

      const mailTemplate = generateVendorRequestEmailTemplate({
        trustee_id,
        school_id,
        school_name,
        vendor_info: {
          name: newVendor.name,
          email: newVendor.email,
          phone: newVendor.phone,
          status: newVendor.status,
        },
      });

      const emailSubject = `Vendor Request Initiated from ${school_name}`;

      this.emailService.sendMailToTrustee(
        emailSubject,
        mailTemplate,
        VENDOR_CREATE_ALERT_EMAIL,
      );

      return 'Vendor Created Successfully';
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async getAllVendors(trustee_id: string, page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;

      const vendors = await this.vendorsModel
        .find({ trustee_id: new Types.ObjectId(trustee_id) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

      const totalVendors = await this.vendorsModel.countDocuments({
        trustee_id: new Types.ObjectId(trustee_id),
      });

      return {
        vendors,
        totalPages: Math.ceil(totalVendors / pageSize),
        currentPage: page,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getSchoolVendors(
    school_id: string,
    page: number,
    limit: number,
    query: any,
  ) {
    try {
      // Calculate the number of documents to skip based on the current page and limit
      const skip = (page - 1) * limit;
      // Fetch vendors with pagination applied
      const vendors = await this.vendorsModel.aggregate([
        {
          $match: query,
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);
      // console.log(vendors, "vendors")
      // .find({ school_id: new Types.ObjectId(school_id) })
      // .sort({ createdAt: -1 }) // Sort by createdAt in descending order
      // .skip(skip)
      // .limit(limit);
      // Optional: Get the total count of vendors for the specified school to provide additional pagination info
      const totalVendors = await this.vendorsModel.countDocuments(query);
      return {
        vendors,
        totalPages: Math.ceil(totalVendors / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async uploadCheque(
    vendor_id: string,
    base64: string,
    chequeExtension: string,
  ) {
    try {
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      const buffer = Buffer.from(base64Data, 'base64');

      let mimeType = 'application/octet-stream'; // Default if type is unknown
      if (chequeExtension === 'pdf') {
        mimeType = 'application/pdf';
      } else if (['jpg', 'jpeg', 'png'].includes(chequeExtension)) {
        mimeType = `image/${chequeExtension === 'jpg' ? 'jpeg' : chequeExtension
          }`;
      } else {
        throw new Error('Unsupported file type file type.');
      }

      const chequeUrl = await new Promise<string>(async (resolve, reject) => {
        try {
          // Upload the PDF buffer to AWS S3
          const url = await this.awsS3Service.uploadToS3(
            buffer,
            `cheque_${vendor_id}.${chequeExtension}`,
            mimeType,
            'edviron-backend-dev',
          );

          resolve(url);
        } catch (error) {
          reject(error);
        }
      });

      return chequeUrl;
    } catch (e) {
      throw new Error(e.message);
    }
  }

  async approveVendor(
    vendor_info: {
      vendor_id: string;
      status: string;
      name: string;
      email: string;
      phone: string;
      verify_account: boolean;
      dashboard_access: boolean;
      schedule_option: number;
      bank: { account_number: string; account_holder: string; ifsc: string };
      kyc_details: {
        account_type: string;
        business_type: string;
        uidai?: string;
        gst?: string;
        cin?: string;
        pan?: string;
        passport_number?: string;
      };
    },
    trustee_id: string,
    school_id: string,
  ) {
    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) throw new NotFoundException('School not found for Trustee');
    const vendor = await this.vendorsModel.findById(vendor_info.vendor_id);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const token = this.jwtService.sign(
      { client_id: school.client_id },
      {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      },
    );
    const data = {
      token,
      client_id: school.client_id,
      vendor_info: vendor_info,
    };

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/create-vendor`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data,
    };
    try {
      const response = await axios.request(config);
      const updatedStatus = response.data.status;
      vendor.status = updatedStatus;
      await vendor.save();
      this.automatedVendoStatusCheck(school.client_id, {
        vendor_id: vendor.vendor_id,
        vendor_name: vendor_info.name,
        vendor_email: vendor_info.email,
        school_name: school.school_name,
        school_id: school.school_id.toString(),
        trustee_id: trustee_id,
      });
      return 'Vendor updated successfully to Vendor status: ' + updatedStatus;
    } catch (e) {
      if (e.response.data.message) {
        // console.log(e.response.data.message,'error');
        throw new BadRequestException(e.response.data.message);
      }

      throw new BadRequestException(e.message);
    }
  }

  async automatedVendoStatusCheck(
    client_id: string,
    vendor: {
      vendor_id: string;
      vendor_name: string;
      vendor_email: string;
      school_name: string;
      school_id: string;
      trustee_id: string;
    },
  ) {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 30 * 60 * 1000;
    let retryCount = 0;
    const intervalId = setInterval(async () => {
      try {
        const data: any = this.checkVendorStatus(vendor.vendor_id, client_id);
        if (data.status && data.status?.toUpperCase() === 'ACTIVE') {
          clearInterval(intervalId);
        } else {
          retryCount++;
          if (retryCount >= MAX_RETRIES) {
            clearInterval(intervalId);
            const emailSubject =
              'Urgent: Vendor Status Still Pending After 1 Hour – Attention Required';
            const template = generateVendorStatusEmailTemplate(vendor);
            this.emailService.sendMailToTrustee(
              template,
              emailSubject,
              VENDOR_STATUS_EMAIL,
            );
          }
        }
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }, RETRY_DELAY);
  }
  async checkVendorStatus(vendor_id: string, client_id: string) {
    try {
      const token = this.jwtService.sign(
        { vendor_id, client_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-vendor-status?token=${token}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
      };
      const { data } = await axios.request(config);
      return data;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getVenodrInfo(vendor_id: string, school_id: string) {
    const vendor = await this.vendorsModel.findById(vendor_id);

    if (vendor.school_id.toString() !== school_id) {
      console.log(vendor.school_id);

      throw new BadRequestException(`Invalid vendor Id`);
    }
    if (!vendor)
      throw new NotFoundException(
        'Vendor not found for vendor_id: ' + vendor_id,
      );
    return vendor;
  }

  async getVendonrSingleTransactions(order_id: string, trustee_id: string) {
    if (!order_id) throw new NotFoundException('Order id not found ');

    const token = this.jwtService.sign(
      {
        order_id,
      },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-vendor-single-transaction`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: { order_id, trustee_id, token },
    };

    const { data: transactions } = await axios.request(config);
    // console.log(transactions);

    return transactions;
  }

  async getVendonrMerchantSingleTransactions(order_id: string) {
    if (!order_id) throw new NotFoundException('Order id not found ');

    const token = this.jwtService.sign(
      {
        order_id,
      },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-Merchantvendor-single-transaction`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: { order_id, token },
    };

    const { data: transactions } = await axios.request(config);

    return transactions;
  }

  async getVendorTransactions(
    vendor_id: string,
    trustee_id: string,
    page: number,
    limit: number,
  ) {
    const vendor = await this.vendorsModel.findOne({ vendor_id });
    if (!vendor) throw new NotFoundException('Vendor not found for');
    const token = this.jwtService.sign(
      { validate_trustee: trustee_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-vendor-transaction?token=${token}&vendor_id=${vendor_id}&page=${page}&limit=${limit}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };

    const { data: transactions } = await axios.request(config);
    console.log(transactions, 'transactions');

    return transactions;
  }

  async getAllVendorTransactions(
    trustee_id: string,
    page: number,
    limit: number,
    status?: string,
    vendor_id?: string,
    school_id?: string[],
    start_date?: string,
    end_date?: string,
    custom_id?: string,
    order_id?: string,
    payment_modes?: string[],
    gateway?: string[],
  ) {
    try {
      const token = this.jwtService.sign(
        { validate_trustee: trustee_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const data = {
        trustee_id: trustee_id,
        token: token,
        page: page,
        limit: limit,
        status: status,
        vendor_id: vendor_id,
        school_id: school_id,
        start_date: start_date,
        end_date: end_date,
        custom_id: custom_id,
        collect_id: order_id,
        payment_modes: payment_modes,
        gateway: gateway,
      };
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-vendor-transaction?token=${token}&trustee_id=${trustee_id}&page=${page}&limit=${limit}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: data,
      };
      const { data: transactions } = await axios.request(config);
      // console.log(transactions, "transactions");

      const updatedTransactions = await Promise.all(
        transactions.vendorsTransaction.map(async (transaction) => {
          if (!transaction.school_id)
            return { ...transaction, schoolName: 'Unknown School' }; // Agar schoolId nahi hai

          const school = await this.trusteeSchoolModel.findOne({
            school_id: new Types.ObjectId(transaction.school_id),
          });
          return {
            ...transaction,
            schoolName: school ? school.school_name : 'N/A',
          };
        }),
      );
      transactions.vendorsTransaction = updatedTransactions;
      return transactions;
    } catch (error) {
      if (error.response) {
        // Received error from downstream service
        throw new BadRequestException(
          error.response.data.message || error.response.data,
        );
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  async getMerchantVendorTransactions(
    trustee_id: string,
    school_id: string,
    page: number,
    limit: number,
    status?: string,
    vendor_id?: string,
    start_date?: string,
    end_date?: string,
    custom_id?: string,
    order_id?: string,
    payment_modes?: string[],
    gateway?: string[],
  ) {
    try {
      const token = this.jwtService.sign(
        { validate_trustee: trustee_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );

      const data = {
        trustee_id: trustee_id,
        token: token,
        page: page,
        limit: limit,
        status: status,
        vendor_id: vendor_id,
        school_id: [school_id],
        start_date: start_date,
        end_date: end_date,
        custom_id: custom_id,
        collect_id: order_id,
        payment_modes: payment_modes,
        gateway: gateway,
      };
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-vendor-transaction?token=${token}&school_id=${school_id}&page=${page}&limit=${limit}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: data,
      };

      const { data: transactions } = await axios.request(config);
      // console.log(transactions);
      const updatedTransactions = await Promise.all(
        transactions.vendorsTransaction.map(async (transaction) => {
          if (!transaction.school_id)
            return { ...transaction, schoolName: 'Unknown School' };

          const school = await this.trusteeSchoolModel.findOne({
            school_id: new Types.ObjectId(transaction.school_id),
          });
          return {
            ...transaction,
            schoolName: school ? school.school_name : 'N/A',
          };
        }),
      );
      transactions.vendorsTransaction = updatedTransactions;
      return transactions;
    } catch (error) {
      if (error.response) {
        // Received error from downstream service
        throw new BadRequestException(
          error.response.data.message || error.response.data,
        );
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  async getTransactionsForSettlements(
    utr: string,
    client_id: string,
    limit: number,
    cursor?: string | null,
  ) {
    // console.log(utr);

    const token = this.jwtService.sign(
      { utr, client_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    const paginationData = {
      cursor: cursor,
      limit: limit,
    };
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/settlements-transactions?token=${token}&utr=${utr}&client_id=${client_id}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: paginationData,
    };
    try {
      const { data: transactions } = await axios.request(config);

      const settlements_transactions = transactions.settlements_transactions;
      let newClientId = client_id;
      if (newClientId === 'CF_3b48ae82-b5c9-4ccd-8003-0a9928f98966') {
        newClientId = '67e39bfcd0b12c853ab2dd4f';
      }

      const school = await this.trusteeSchoolModel.findOne({
        client_id: newClientId,
      });
      let settlementTransactions = [];
      if (!school) throw new BadRequestException(`Could not find school `);
      settlements_transactions.forEach((transaction: any) => {
        if (transaction?.order_id) {
          transaction.school_name = school.school_name;
        }
      });
      // console.log(transactions, 'datadagsjdgajk');

      // console.log(settlements_transactions, 'settlements_transactions');

      return {
        limit: transactions.limit,
        cursor: transactions.cursor,
        settlements_transactions,
      };
    } catch (e) {
      // console.log(e);
    }
  }

  async getBatchTransactions(trustee_id: string, year: string) {
    const token = this.jwtService.sign(
      { trustee_id: trustee_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-batch-transactions?trustee_id=${trustee_id}&year=${year}&token=${token}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };
    try {
      const { data: batchTransactions } = await axios.request(config);
      console.log(batchTransactions, "batchTransactions")
      return batchTransactions;
    } catch (e) {
      console.log(e);

      throw new BadRequestException(e.message);
    }
  }

  async fetchSettlementInfo(
    settlement_date: string,
    school_id: string,
    trustee_id: string,
  ) {
    // Convert the input date to the start and end of the day in UTC
    const targetDate = new Date(settlement_date);

    const startOfDayIST = new Date(targetDate.setHours(0, 0, 0, 0));
    // Convert to UTC
    console.log(targetDate, 'date');
    console.log(startOfDayIST, 'startOfDayIST');

    const startOfDayUTC = new Date(
      startOfDayIST.getTime() - 5.5 * 60 * 60 * 1000,
    );

    // End of day in IST
    const endOfDayIST = new Date(targetDate.setHours(23, 59, 59, 999));
    // Convert to UTC
    // const endOfDayUTC = new Date(endOfDayIST.getTime() - 5.5 * 60 * 60 * 1000);
    console.log({
      $gte: startOfDayIST,
      $lt: endOfDayIST,
    });
    console.log(school_id);

    // Query to find settlements for the specific day
    const settlements = await this.settlementReportModel.find({
      schoolId: new Types.ObjectId(school_id), // Match the school_id
      settlementDate: {
        $gte: startOfDayIST,
        $lt: endOfDayIST,
      },
    });

    //  console.log(settlements);
    return settlements;
  }

  async fetchTransactionsInfo(
    start_date: String,
    end_date: String,
    school_id: string,
    trustee_id: string,
  ) {
    let token = this.jwtService.sign(
      { trustee_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report/?startDate=${start_date}&endDate=${end_date}&&status=SUCCESS&school_id=${school_id}&limit=10000`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: {
        trustee_id,
        token,
      },
    };

    const transactions = await axios.request(config);
    return transactions.data;
  }

  async getSingleTransaction(
    trustee_id: string,
    collect_id: string,
    token: string,
  ) {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/single-transaction-report`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: {
        collect_id,
        trustee_id,
        token,
      },
    };
    const { data: transaction } = await axios.request(config);
    return transaction;
  }

  async reconSettlementAndTransaction(
    trustee_id: string,
    school_id: string,
    settlement_date: string,
    transaction_start_date: string,
    transaction_end_date: string,
    isoTransactionFrom?: string,
    isoTransactionTill?: string,
    isoSettlementDate?: number,
  ) {
    const settlements = await this.fetchSettlementInfo(
      settlement_date,
      school_id,
      trustee_id,
    );

    // if (settlements.length <= 0) {
    //   throw new BadRequestException(`Settlement Not found`);
    // }
    let payment_service_tax = 0;
    let payment_service_charge = 0;
    let allTransactions = [];
    let refunds = [];
    let settlementTransactions = 0;
    let sumSettlement = 0;
    let otherAdjustments: any = [];
    let sumOtherAdjustments = 0;
    let chargeBacks: any = [];

    await Promise.all(
      settlements.map(async (settlement: any) => {
        sumSettlement += settlement.netSettlementAmount;
        const transactions = await this.getTransactionsForSettlements(
          settlement.utrNumber,
          settlement.clientId,
          1000,
          null,
        );

        let settlements_transactions = transactions.settlements_transactions;

        if (Array.isArray(settlements_transactions)) {
          settlements_transactions = await Promise.all(
            settlements_transactions.map(async (transaction: any) => {
              const formattedTransaction = {
                collect_id: transaction.order_id,
                order_amount: transaction.order_amount,
                event_type: transaction.event_type,
                custom_order_id: transaction.custom_order_id,
                student_name: transaction.student_name,
                student_email: transaction.student_email,
                student_phone_no: transaction.student_phone_no,
                payment_group: transaction.payment_group,
                payment_time: transaction.event_time || 'na',
              };

              payment_service_charge += transaction.payment_service_charge;
              payment_service_tax += transaction.payment_service_tax;

              if (transaction.event_type !== 'REFUND') {
                settlementTransactions += transaction.order_amount;
              }

              // Fetch refund UTR if event_type is 'REFUND'
              if (transaction.order_id && transaction.event_type === 'REFUND') {
                console.log(transaction, 'REFUND REPORT');
                const config = {
                  method: 'get',
                  maxBodyLength: Infinity,
                  url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/settlement-status?collect_id=${transaction.order_id}`,
                  headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                };
                const { data: refundData } = await axios.request(config);
                refunds.push({
                  ...formattedTransaction,
                  utr: refundData.transfer_utr,
                });
              }

              // Handle DISPUTE transactions
              if (
                transaction.order_id &&
                transaction.event_type === 'DISPUTE'
              ) {
                const config = {
                  method: 'get',
                  maxBodyLength: Infinity,
                  url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/settlement-status?collect_id=${transaction.order_id}`,
                  headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                };
                const { data: refundData } = await axios.request(config);
                chargeBacks.push({
                  ...formattedTransaction,
                  utr: refundData.transfer_utr,
                });
              }

              // Handle OTHER_ADJUSTMENT transactions
              if (
                transaction.order_id &&
                transaction.event_type === 'OTHER_ADJUSTMENT'
              ) {
                sumOtherAdjustments += transaction.event_amount;
                const config = {
                  method: 'get',
                  maxBodyLength: Infinity,
                  url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/settlement-status?collect_id=${transaction.order_id}`,
                  headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                };
                const { data: refundData } = await axios.request(config);
                otherAdjustments.push({
                  ...formattedTransaction,
                  utr: refundData.transfer_utr,
                });
              }

              return formattedTransaction;
            }),
          );

          allTransactions.push(...settlements_transactions);
        }
      }),
    );

    let transactionData = await this.fetchTransactionsInfo(
      transaction_start_date,
      transaction_end_date,
      school_id,
      trustee_id,
    );
    let durationTransactions = transactionData.transactions;

    // let refundDetails: any = [];
    let refundSum = 0;
    const refundDetails = await Promise.all(
      refunds.map(async (refund: any) => {
        console.log(refund, 'test refund');

        const refundInfo: any = await this.refundRequestModel.findOne({
          order_id: new Types.ObjectId(refund.collect_id),
        });
        console.log(refundInfo, 'refundinfo2423');

        if (!refundInfo) {
          console.log('Refund information not found for:', refund.collect_id);
          return null; // Or handle it as per your business logic
        }

        if (refundInfo.refund_amount) {
          refundSum += refundInfo.refund_amount;
        }

        const transactionData = await this.fetchTransactionInfo(
          refund.collect_id,
        );
        // console.log(transactionData, 'transactionData');

        const inSettlements = durationTransactions.some(
          (transaction) =>
            transaction.collect_id === transactionData.collect_id,
        );

        return {
          custom_order_id: refundInfo.custom_id,
          collect_id: transactionData.collect_id,
          createdAt: refundInfo.createdAt,
          updatedAt: refundInfo.updatedAt,
          payment_time: transactionData.transaction_time,
          order_amount: refund.order_amount,
          refund_amount: refundInfo.refund_amount,
          isSplitRefund: refundInfo.isSplitRefund || false,
          inSettlements,
          utr: refund.utr,
        };
      }),
    );

    // console.log(refunds, 'refunds array');

    // console.log(durationTransactions, 'durationTransactions');
    let toalDurationTransaction = 0;
    let vendorTransactions: any[] = [];
    let venodrSum = 0;
    let earliestDate: string | null = null;
    let latestDate: string | null = null;
    let vendorSettlementsInfo: any = [];
    await Promise.all(
      durationTransactions.map(async (transactions: any) => {
        toalDurationTransaction += transactions.order_amount;
        transactions.inSettlements = true;
        if (transactions.vendors_info && transactions.vendors_info.length > 0) {
          // Batch vendor settlement info calls
          const settlementDate = await this.vendorSettlementInfo(
            transactions.collect_id,
          );

          // Calculate earliest and latest dates inline
          const currDate = new Date(settlementDate.vendorSettlementDate);
          if (!earliestDate || currDate < new Date(earliestDate)) {
            earliestDate = settlementDate.vendorSettlementDate;
          }
          if (!latestDate || currDate > new Date(latestDate)) {
            latestDate = settlementDate.vendorSettlementDate;
          }
          // Process vendor splits
          for (const vendor of transactions.vendors_info) {
            let splitAmount = 0;
            const transactionTime =
              transactions.payment_time || transactions.transaction_time;
            if (vendor.percentage) {
              splitAmount =
                (transactions.order_amount * vendor.percentage) / 100;
            } else if (vendor.amount) {
              splitAmount = vendor.amount;
            }
            venodrSum += splitAmount;

            vendorTransactions.push({
              splitAmount,
              vendorName: vendor.name,
              vendorId: vendor.vendor_id,
              order_amount: transactions.order_amount,
              collect_id: transactions.collect_id,
              transactionTime,
            });
          }
        }
      }),
    );

    const schoolInfo = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });

    // console.log('Duration Transactions:', durationTransactions);
    const extraInSettlementTransactions = allTransactions.filter(
      (transaction) =>
        transaction.event_type !== 'REFUND' && // Exclude refund transactions
        !durationTransactions.some(
          (durationTransaction) =>
            durationTransaction.collect_id === transaction.collect_id,
        ),
    );

    const extraInDurationTransactions = durationTransactions.filter(
      (durationTransaction) =>
        !allTransactions.some(
          (transaction) =>
            transaction.collect_id === durationTransaction.collect_id,
        ),
    );

    // Set `inSettlement` to false for matching objects
    extraInDurationTransactions.forEach((transaction) => {
      transaction.inSettlement = false;
    });
    let vendorRefunds: any = [];
    let VendorRefundSum = 0;
    let venodrSettlementSum = 0;
    if (earliestDate) {
      const formatStartDate = earliestDate.split(' ')[0];
      const formatEndDate = latestDate.split(' ')[0];
      const vendorSttlementStartDate = new Date(`${formatStartDate}T00:00:00Z`);

      vendorSttlementStartDate.setHours(0, 0, 0, 0);
      const vendorSttlementEndDate = new Date(`${formatEndDate}T23:59:59Z`);

      let vendorSettlementUtr: any = [];
      vendorSettlementsInfo = await this.vendorsSettlementModel.find({
        school_id: new Types.ObjectId(school_id),
        // trustee_id: new Types.ObjectId(trustee_id),
        settled_on: {
          $gte: vendorSttlementStartDate,
          $lte: vendorSttlementEndDate,
        },
      });

      vendorSettlementsInfo.forEach((info) => {
        venodrSettlementSum += info.net_settlement_amount;
        vendorSettlementUtr.push(info.utr);
      });

      if (vendorSettlementUtr.length > 0) {
        const vendorToken = this.jwtService.sign(
          { trustee_id },
          { secret: process.env.PAYMENTS_SERVICE_SECRET },
        );
        const vendorReconPayload = {
          trustee_id: trustee_id,
          token: vendorToken,
          client_id: schoolInfo.client_id,
          start_date: vendorSttlementStartDate.toISOString().split('T')[0],
          end_date: vendorSttlementEndDate.toISOString().split('T')[0],
          utrNumber: vendorSettlementUtr,
          cursor: null,
        };

        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/vendors-settlement-recon`,
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
          },
          data: vendorReconPayload,
        };

        const vendorReconInfo = await axios.request(config);

        const vendorSettlementsRecons = vendorReconInfo.data.data;
        // vendorRefunds=vendorSettlementsRecons

        await Promise.all(
          vendorSettlementsRecons.map(async (data) => {
            if (data.type === 'REFUND') {
              const vendorData = await this.vendorsModel.findOne({
                vendor_id: data.merchant_vendor_id,
              });
              if (vendorData) {
                const refundAmt = Number(data.debit) || data.amount;
                const venRefundInfo = {
                  vendor_id: vendorData.vendor_id,
                  vendor_name: vendorData.name,
                  split_amount: data.amount,
                  collect_id: data.merchant_order_id,
                  refund_amount: refundAmt,
                };
                vendorRefunds.push(venRefundInfo);
                VendorRefundSum += refundAmt;
              }
            }
          }),
        );
      }

      // console.log(refundDetails,'ven');
      // console.log({  duration_transactions: durationTransactions,});
    }
    const discrepancies = {
      result: { earliestDate, latestDate },
      VendorRefundSum,
      vendorRefunds,
      utr: settlements[0].utrNumber,
      duration_transactions: durationTransactions,
      settlements_transactions: allTransactions,
      vendorSettlementsInfo,
      vendorTransactions,
      venodrSum,
      venodrSettlementSum,
      settlementAmount: sumSettlement,
      toalDurationTransaction,
      diffrenceAmount: sumSettlement - toalDurationTransaction,
      extraInSettlementTransactions,
      extraInDurationTransactions,
      refundDetails,
      payment_service_tax,
      payment_service_charge,
      chargeBacks,
    };

    try {
      try {
        if (
          extraInDurationTransactions.length > 0 ||
          extraInSettlementTransactions.length > 0
        ) {
          await this.emailService.reconMissmatched(
            settlements[0].utrNumber,
            schoolInfo.school_name,
          );
        }
      } catch (e) {
        console.log(e.message);
      }
      const records = await new this.ReconciliationModel({
        fromDate:
          new Date(isoTransactionFrom) || new Date(transaction_start_date),
        tillDate:
          new Date(isoTransactionTill) || new Date(transaction_end_date),
        settlementDate:
          new Date(isoSettlementDate) || new Date(settlement_date),
        settlementAmount: sumSettlement,
        totaltransactionAmount: toalDurationTransaction,
        merchantAdjustment: sumSettlement - toalDurationTransaction,
        splitTransactionAmount: venodrSum,
        splitSettlementAmount: venodrSettlementSum,
        vendors_transactions: vendorTransactions,
        refundSum: refundSum,
        extraInSettlement: extraInSettlementTransactions,
        extraInTransaction: extraInDurationTransactions,
        refunds: refundDetails,
        trustee: new Types.ObjectId(trustee_id),
        schoolId: new Types.ObjectId(school_id),
        school_name: schoolInfo.school_name || 'NA',
        settlements_transactions: allTransactions,
        utrNumber: settlements[0].utrNumber,
        remarks: settlements[0].remarks || 'NA',
        other_adjustments: otherAdjustments,
        merchantOtherAdjustment: sumOtherAdjustments,
        duration_transactions: durationTransactions,
        vendors_refunds: vendorRefunds,
        vendor_refund_sum: VendorRefundSum,
        payment_service_tax,
        payment_service_charge,
      }).save();
    } catch (e) {
      console.log(e);
    }

    return discrepancies;
  }

  async vendorSettlementInfo(order_id: string) {
    const token = this.jwtService.sign(
      { collect_id: order_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    // console.log(order_id);

    const config = {
      method: 'post',
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/vendor-transactions-settlement`,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      data: {
        collect_id: order_id,
        token,
      },
    };
    try {
      const response = await axios.request(config);
      // return data
      const data = response.data;
      console.log(data, 'vdata');

      if (
        data.data.length > 1
        // data.data[0].vendor_settlement_eligibility_time
      ) {
        const vendorData = await Promise.all(
          data.data.map(async (info) => {
            if (info.vendor_settlement_eligibility_time) {
              return {
                vendorSettlementDate: info.vendor_settlement_eligibility_time,
                vendorSettlementUtr: info.vendor_settlement_utr,
              };
            }
            // Explicitly return null or skip undefined values
            return null;
          }),
        );

        // Filter out null values if needed
        const filteredVendorData = vendorData.filter((item) => item !== null);
        console.log(filteredVendorData);

        return filteredVendorData[0];
      }
    } catch (e) {
      console.log(e);

      throw new BadRequestException(e.response.data.message);
    }
  }

  async getDisputes(
    trustee_id: string,
    page: number,
    limit: number,
    school_id?: string,
    order_id?: string,
    custom_id?: string,
    dispute_id?: string,
    start_date?: string,
    end_date?: string,
    status?: string,
  ) {
    try {
      const query: any = {
        trustee_id: new Types.ObjectId(trustee_id),
        ...(school_id && { school_id: new Types.ObjectId(school_id) }),
        ...(order_id && { collect_id: order_id }),
        ...(custom_id && { custom_order_id: custom_id }),
        ...(dispute_id && { dispute_id: dispute_id }),
        ...(status && { dispute_status: status }),
        ...(start_date || end_date
          ? {
            dispute_created_date: {
              ...(start_date && { $gte: new Date(start_date) }),
              ...(end_date && {
                $lte: new Date(new Date(end_date).setHours(23, 59, 59, 999)),
              }),
            },
          }
          : {}),
      };
      const skip = (page - 1) * limit;

      const [disputes, totalCount] = await Promise.all([
        this.DisputesModel.find(query)
          .sort({ dispute_created_date: -1 })
          .skip(skip)
          .limit(limit),
        this.DisputesModel.countDocuments(query),
      ]);
      const totalPages = Math.ceil(totalCount / limit);

      return {
        disputes,
        totalCount,
        totalPages,
      };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async getReconciliation(
    trustee_id: string,
    page: number,
    limit: number,
    start_date?: string,
    end_date?: string,
    school_id?: string,
  ) {
    try {
      let query: any = {
        trustee: new Types.ObjectId(trustee_id),
        ...(school_id && { schoolId: new Types.ObjectId(school_id) }),
        ...(start_date || end_date
          ? {
            settlementDate: {
              ...(start_date && { $gte: new Date(start_date) }),
              ...(end_date && {
                $lte: new Date(new Date(end_date).setHours(23, 59, 59, 999)),
              }),
            },
          }
          : {}),
      };

      const [reconciliation, totalCount] = await Promise.all([
        this.ReconciliationModel.find(query)
          .sort({ settlementDate: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        this.ReconciliationModel.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / limit);
      return {
        reconciliation,
        totalCount,
        totalPages,
      };
    } catch (e) { }
  }

  async fetchTransactionInfo(collect_id: string) {
    let token = this.jwtService.sign(
      { collect_request_id: collect_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    const transactionDetailsConfig = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/erp-transaction-info?collect_request_id=${collect_id}&token=${token}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };
    try {
      const transactionInfo = await axios.request(transactionDetailsConfig);
      console.log(transactionInfo.data, 'refundinfo');
      return transactionInfo.data[0];
    } catch (e) {
      console.log(e);
    }
  }

  async schoolMdrInforData(school_id: string, trustee_id: string) {
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }
      const baseMdr = await this.getTrusteeBaseMdrData(trustee_id);
      const schoolMdr = school.platform_charges;
      console.log(baseMdr);

      return {
        school_id,
        school_name: school.school_name,
        requestUpdatedAt: school.updatedAt,
        merchantStatus: school.merchantStatus,
        baseMdr,
        schoolMdr,
      };
    } catch (e) {
      console.log(e);
    }
  }

  async handleEasebuzzDispute({
    case_id,
    action,
    reason,
    documents,
  }: {
    case_id: string;
    action: string;
    reason: string;
    documents: Array<{ document_type: string; file_url: string }>;
  }) {
    try {
      const sign = this.jwtService.sign(
        { case_id, action },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/update-dispute`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          case_id,
          action,
          reason,
          documents,
          sign,
        },
      };
      const { data: response } = await axios.request(config);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Something went wrong',
      );
    }
  }

  async handleCashfreeDispute({
    dispute_id,
    action,
    documents,
    client_id,
  }: {
    dispute_id: string;
    action: string;
    documents: Array<{
      file: string;
      doc_type: string;
      note: string;
    }>;
    client_id: string;
  }) {
    try {
      const sign = this.jwtService.sign(
        { dispute_id, action, client_id },
        {
          secret: process.env.PAYMENTS_SERVICE_SECRET,
        },
      );
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/update-dispute`,
        headers: {
          accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        },
        data: {
          dispute_id,
          action,
          documents,
          client_id,
          sign,
        },
      };
      const { data: response } = await axios.request(config);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Something went wrong',
      );
    }
  }

  async testUrl(trustee_id: any, token: string, url: string) {
    try {
      const data = {
        trustee_id,
        token,
        url,
      };
      const testWebhookconfig = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/test-webhook`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: data,
      };
      const testwebhook = await axios.request(testWebhookconfig);
      return testwebhook;
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Something went wrong',
      );
    }
  }

  async getMails(school_id: string, event_name: string) {
    try {
      const event = await this.EmailEventModel.findOne({
        event_name: event_name,
      });
      if (!event) {
        throw new BadRequestException('Event Not found');
      }
      const emailGroups = await this.EmailGroupModel.findOne({
        school_id: new Types.ObjectId(school_id),
        event_id: event._id,
      });

      return {
        email: emailGroups.emails || [],
        cc: emailGroups.cc || ['tarun.k@edviron.com'],
      };
    } catch (e) {
      throw new BadRequestException('Error in getting mail');
    }
  }

  async generateDisputePDF(dispute: Disputes, isClosed = false) {
    const html = getAdminEmailTemplate(dispute, isClosed);
    return html;
    // Use a library to convert HTML to PDF Buffer (example: puppeteer)
  }

  async getRazorpayTransactionForSettlement(
    utr: string,
    razorpay_id: string,
    razropay_secret: string,
    limit: number,
    cursor: string,
    skip: number,
    fromDate: Date,
    page?: number,
  ) {
    let verifyPage = null;

    if (cursor && cursor !== '') {
      verifyPage = this.jwtService.verify(cursor, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
    }
    page = verifyPage?.page || 0;
    const token = this.jwtService.sign(
      { utr, razorpay_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    skip = limit * page;
    const paginationData = {
      cursor: cursor,
      limit: limit,
      skip: skip,
      fromDate,
    };
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/razorpay-nonseamless/settlements-transactions?token=${token}&utr=${utr}&razorpay_id=${razorpay_id}&razropay_secret=${razropay_secret}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: paginationData,
    };
    try {
      const { data: transactions } = await axios.request(config);
      console.log({ transactions });

      const settlements_transactions = transactions.settlements_transactions;
      if (!settlements_transactions && settlements_transactions.length === 0) {
        throw new BadRequestException('no more transaction found');
      }
      const school = await this.trusteeSchoolModel.findOne({
        'razorpay.razorpay_id': razorpay_id,
      });
      let settlementTransactions = [];
      if (!school) throw new BadRequestException(`Could not find school `);
      settlements_transactions?.forEach((transaction: any) => {
        if (transaction?.order_id) {
          transaction.school_name = school.school_name;
        }
      });

      const payload = { page: Number(page + 1) };
      let cursorToken = this.jwtService.sign(payload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      let updateCursor =
        limit > settlements_transactions.length ? null : cursorToken;
      return {
        limit: transactions.limit,
        cursor: updateCursor,
        settlements_transactions,
      };
    } catch (e) {
      console.log(e.message);
      throw new BadRequestException(e.message);
    }
  }


  async getRazorpayTransactionForSettlementV2(
    utr: string,
    razorpay_id: string,
    razropay_secret: string,
    limit: number,
    cursor: string,
    skip: number,
    fromDate: Date,
    page?: number,
  ) {
    let verifyPage = null;

    if (cursor && cursor !== '') {
      verifyPage = this.jwtService.verify(cursor, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
    }
    page = verifyPage?.page || 0;
    const token = this.jwtService.sign(
      { utr, razorpay_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    skip = limit * page;
    const paginationData = {
      cursor: cursor,
      limit: limit,
      skip: skip,
      fromDate,
    };
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/razorpay-nonseamless/settlements-transactions?token=${token}&utr=${utr}&razorpay_id=${razorpay_id}&razropay_secret=${razropay_secret}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: paginationData,
    };
    try {
      const { data: transactions } = await axios.request(config);
      console.log({ transactions });

      const settlements_transactions = transactions.settlements_transactions;
      if (!settlements_transactions && settlements_transactions.length === 0) {
        throw new BadRequestException('no more transaction found');
      }
      const school = await this.trusteeSchoolModel.findOne({
        'razorpay.razorpay_id': razorpay_id,
      });
      let settlementTransactions = [];
      if (!school) throw new BadRequestException(`Could not find school `);
      settlements_transactions?.forEach((transaction: any) => {
        if (transaction?.order_id) {
          transaction.school_name = school.school_name;
        }
      });

      const payload = { page: Number(page + 1) };
      let cursorToken = this.jwtService.sign(payload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      let updateCursor =
        limit > settlements_transactions.length ? null : cursorToken;
      return {
        limit: transactions.limit,
        cursor: updateCursor,
        settlements_transactions,
      };
    } catch (e) {
      console.log(e.message);
      throw new BadRequestException(e.message);
    }
  }

  async scheduleRefundNotificationEmail(
    merchant: any,
    refundRequest: any,
    status: string,
    collect_id: string,
    trustee_id: string,
  ) {
    try {
      const token = this.jwtService.sign(
        { trustee_id, collect_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const data = await this.getSingleTransaction(
        trustee_id,
        collect_id,
        token,
      );

      const splitDetail = [];

      if (
        refundRequest?.split_refund_details &&
        refundRequest?.split_refund_details?.length > 0
      ) {
        for (const vendorDetail of refundRequest.split_refund_details) {
          const vendor = await this.vendorsModel.findById(
            vendorDetail.vendor_id,
          );
          const data = {
            id: vendorDetail.vendor_id,
            amount: vendorDetail.amount,
            vendor_name: vendor.name,
          };
          splitDetail.push(data);
        }
      }

      const htmlBody = await generateRefundMailReciept(
        data[0],
        merchant.school_name,
        refundRequest.refund_amount,
        refundRequest.order_id.toString(),
        status.toUpperCase(),
        refundRequest._id,
        refundRequest.createdAt,
        refundRequest.additonalInfo,
        splitDetail,
        refundRequest.reason,
      );

      const eventName = 'REFUND_ALERT';
      const emails = await this.businessServices.getMails(
        eventName,
        merchant.school_id.toString(),
      );
      const ccMails = await this.businessServices.getMailsCC(
        eventName,
        merchant.school_id.toString(),
      );

      await this.emailService.sendSRefundMail(
        htmlBody,
        `Edviron | Refund Status of ${merchant.school_name}`,
        emails,
        ccMails,
      );
    } catch (error) {
      await this.ErrorLogsModel.create({
        source: 'sendMailAfterRefund',
        collect_id: merchant.school_id?.toString(),
        error: error.message || error.toString(),
      });
    }
  }

  async generateSettlementReport(
    trustee_id: string,
    start_date: string,
    end_date: string,
    school_id?: string,
    report_id?: string,
    name?: string,
  ) {
    try {
      if (!trustee_id || !start_date || !end_date) {
        throw new BadRequestException('Missing required parameters');
      }
      let query: any = {
        trustee: new Types.ObjectId(trustee_id),
        settlementDate: {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        },
      };

      if (school_id) {
        query.schoolId = new Types.ObjectId(school_id);
      }

      const settlements = await this.settlementReportModel
        .find(query)
        .sort({ settlementDate: -1 })
        .lean(); // Add `.lean()` to get plain objects

      // Format dates
      const formattedData = settlements.map((item) => ({
        ...item,
        settlementDate: item.settlementDate
          ? format(new Date(item.settlementDate), 'd/M/yyyy, h:mm:ss a')
          : '',
        createdAt: item.createdAt
          ? format(new Date(item.createdAt), 'd/M/yyyy, h:mm:ss a')
          : '',
        settlementInitiatedOn: item.settlementInitiatedOn
          ? format(new Date(item.settlementInitiatedOn), 'd/M/yyyy, h:mm:ss a')
          : '',
        fromDate: item.fromDate
          ? format(new Date(item.fromDate), 'd/M/yyyy, h:mm:ss a')
          : '',
        tillDate: item.tillDate
          ? format(new Date(item.tillDate), 'd/M/yyyy, h:mm:ss a')
          : '',
      }));

      const requiredFields = [
        '_id',
        'utrNumber',
        'adjustment',
        'createdAt',
        'fromDate',
        'netSettlementAmount',
        'remarks',
        'schoolId',
        'settlementAmount',
        'settlementDate',
        'settlementInitiatedOn',
        'status',
        'tillDate',
      ];
      const parser = new Parser({ fields: requiredFields });
      const csv = parser.parse(formattedData);
      const fileBuffer = Buffer.from(csv, 'utf-8');
      let fileKey = `reports/settlements-report-${Date.now()}.csv`;
      if (name && report_id) {
        fileKey = `${name}-${Date.now()}-${report_id}.csv`;
      }

      const s3Url = await this.awsS3Service.uploadToS3(
        fileBuffer,
        fileKey,
        'text/csv',
        process.env.REPORT_BUCKET || 'edviron-reports',
      );
      await this.ReportsLogsModel.updateOne(
        { _id: report_id },
        { status: 'COMPLETED', url: s3Url },
      );
      return s3Url;
    } catch (e) {
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async generateSettlementVendor(
    trustee_id: string,
    start_date: string,
    end_date: string,
    school_id?: string,
    report_id?: string,
    name?: string,
    status?: string,
    gateway?: string,
  ) {
    try {
      console.log(name);
      console.log(report_id);
      console.log(status);
      console.log(gateway);

      if (!trustee_id || !start_date || !end_date) {
        throw new BadRequestException('Missing required parameters');
      }

      let query: any = {
        trustee_id: new Types.ObjectId(trustee_id),
        settled_on: {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        },
      };

      if (school_id) {
        query.schoolId = new Types.ObjectId(school_id);
      }

      const settlements = await this.vendorsSettlementModel
        .find(query)
        .sort({ settled_on: -1 })
        .lean(); // Add `.lean()` to get plain objects

      // Format dates
      const formattedData = settlements.map((item) => ({
        ...item,
        settled_on: item.settled_on
          ? format(new Date(item.settled_on), 'd/M/yyyy, h:mm:ss a')
          : '',
        settlement_initiated_on: item.settlement_initiated_on
          ? format(
            new Date(item.settlement_initiated_on),
            'd/M/yyyy, h:mm:ss a',
          )
          : '',
        payment_from: item.payment_from
          ? format(new Date(item.payment_from), 'd/M/yyyy, h:mm:ss a')
          : '',
        payment_till: item.payment_till
          ? format(new Date(item.payment_till), 'd/M/yyyy, h:mm:ss a')
          : '',
      }));

      const requiredFields = [
        '_id',
        'utrNumber',
        'adjustment',
        'createdAt',
        'payment_from',
        'netSettlementAmount',
        'remarks',
        'schoolId',
        'settlementAmount',
        'settled_on',
        'settlement_initiated_on',
        'status',
        'payment_till',
      ];
      const parser = new Parser({ fields: requiredFields });
      const csv = parser.parse(formattedData);
      const fileBuffer = Buffer.from(csv, 'utf-8');
      let fileKey = `reports/settlements-report-${Date.now()}.csv`;
      if (name && report_id) {
        console.log('report_id', report_id);

        fileKey = `${name}-${Date.now()}-${report_id}.csv`;
      }

      const s3Url = await this.awsS3Service.uploadToS3(
        fileBuffer,
        fileKey,
        'text/csv',
        process.env.REPORT_BUCKET || 'edviron-reports',
      );

      await this.ReportsLogsModel.updateOne(
        { _id: report_id },
        { status: 'COMPLETED', url: s3Url },
      );
      return s3Url;
    } catch (e) {
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async generateReport(
    type: string,
    start_date: string,
    end_date: string,
    trustee_id: string,
    school_id?: string,
    name?: string,
  ) {
    try {
      console.log({ trustee_id });

      const report = await this.ReportsLogsModel.create({
        type,
        start_date,
        end_date,
        trustee_id: new Types.ObjectId(trustee_id),
        school_id: school_id ? new Types.ObjectId(school_id) : null,
        status: 'PENDING',
      });
      setImmediate(async () => {
        console.log('tets');

        try {
          if (type === 'SETTLEMENT_REPORT') {
            const data = await this.generateSettlementReport(
              trustee_id,
              start_date,
              end_date,
              school_id,
              report._id.toString(),
              name,
            );
          } else if (type === 'SETTLEMENT_VENDOR') {
            await this.generateSettlementVendor(
              trustee_id,
              start_date,
              end_date,
              school_id,
              report._id.toString(),
              name,
            );
          } else if (type === 'SETTLEMENT_RECON') {
            console.log('recon');

            await this.generateSettlementRecon(
              trustee_id,
              start_date,
              end_date,
              report._id.toString(),
              school_id,
              name,
            );
          }
        } catch (err) {
          await this.ReportsLogsModel.updateOne(
            { _id: report._id },
            { status: 'FAILED', error: err.message },
          );
        }
      });
    } catch (e) {
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async generateCSVBuffer(data: any[]): Promise<Buffer> {
    const createCsvWriter = csvWriter.createObjectCsvStringifier;
    const header = Object.keys(data[0] || {}).map((key) => ({
      id: key,
      title: key,
    }));

    const csvStringifier = createCsvWriter({ header });

    const csvContent =
      csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data);

    return Buffer.from(csvContent, 'utf-8');
  }

  async getReports(
    trustee_id: string,
    page: number,
    limit: number,
    type?: string,
    school_id?: string,
    start_date?: string,
    end_date?: string,
  ) {
    try {
      const query: any = { trustee_id: new Types.ObjectId(trustee_id) };

      if (type) query.type = type;
      if (school_id) query.school_id = new Types.ObjectId(school_id);
      if (start_date) query.start_date = start_date;
      if (end_date) query.end_date = end_date;

      console.log(query);

      const totalCount = await this.ReportsLogsModel.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);

      const reports = await this.ReportsLogsModel.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

      return {
        reports,

        totalCount,
        totalPages,
        currentPage: page,
        limit,
      };
    } catch (e) {
      console.error(e);
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async generateSettlementRecon(
    trustee_id: string,
    start_date: string,
    end_date: string,
    report_id: string,
    school_id?: string,
    name?: string,
  ) {
    try {
      let query: any = {
        trustee: new Types.ObjectId(trustee_id),
        clientId: { $exists: true },
        settlementDate: {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        },
      };
      if (school_id) {
        query.schoolId = new Types.ObjectId(school_id);
      }

      const settlements = await this.settlementReportModel.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'trusteeschools',
            localField: 'schoolId',
            foreignField: 'school_id',
            as: 'schoolInfo',
          },
        },
        {
          $unwind: {
            path: '$schoolInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            utr: '$utrNumber',
            school_name: '$schoolInfo.school_name',
            client_id: '$schoolInfo.client_id',
          },
        },
      ]);

      const config = {
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/reports/settlements-transactions`,
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        data: { utrs: settlements, report_id },
      };
      await axios.request(config);
      return 'report generated successfully';
    } catch (e) {
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async getPayuSettlementRecon(utr: string, school_id: string) {
    try {
      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/pay-u/get-settlements-recon`,
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        data: { utr, school_id, page: 1, limit: 1000 },
      };
      const { data } = await axios.request(config);
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School not found');
      }
      const settlements_transactions = data.transactions;
      settlements_transactions.forEach((transaction: any) => {
        if (transaction?.order_id) {
          transaction.school_name = school.school_name;
        }
      });
      return {
        limit: settlements_transactions.limit,
        cursor: settlements_transactions.cursor || null,
        settlements_transactions,
      };
    } catch (e) {
      log(e);
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async createSubTrustee(
    trustee_id: string,
    name: string,
    email: string,
    phone: string,
    password: string,
    school_id?: string[],
  ) {
    try {
      const existingUser = await this.SubTrusteeModel.findOne({ email });
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
      const subtrustee = await new this.SubTrusteeModel({
        trustee_id: new Types.ObjectId(trustee_id),
        name,
        email,
        phone,
        password_hash: password,
      }).save();
      if (school_id && school_id.length > 0) {
        await Promise.all(
          school_id.map(async (school: any) => {
            await this.assingSubTrustee(
              school,
              subtrustee._id.toString(),
              trustee_id.toString(),
            );
          }),
        );
      }
      return {
        message: `Sub Trustee created successfully ${subtrustee._id}`,
        status: 'success',
      };
    } catch (e) {
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async assingSubTrustee(
    school_id: string,
    subTrustee: string,
    trustee_id: string,
  ) {
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) {
        throw new BadRequestException('School not found');
      }

      const checkSubTrustee = await this.SubTrusteeModel.findById(subTrustee);
      if (!checkSubTrustee) {
        throw new BadRequestException('Sub trustee');
      }

      if (school.trustee_id.toString() !== trustee_id) {
        throw new UnauthorizedException('UnAuthorize User');
      }

      if (checkSubTrustee.trustee_id.toString() !== trustee_id) {
        throw new UnauthorizedException('Unauthorized User');
      }

      if (
        checkSubTrustee.trustee_id.toString() !== school.trustee_id.toString()
      ) {
        console.log('invalid something');

        throw new BadRequestException('Unauthorized User');
      }
      console.log('test');

      const result = await this.trusteeSchoolModel.updateOne(
        { school_id: new Types.ObjectId(school_id) },
        { $addToSet: { sub_trustee_id: new Types.ObjectId(subTrustee) } },
      );
      const check = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      console.log(check.sub_trustee_id);

      if (result.matchedCount === 0) {
        throw new BadRequestException('School not found');
      }

      return { message: 'Sub trustee assigned successfully' };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async easebuzzSettlementRecon(
    submerchant_id: string,
    start_date: string,
    end_date: string,
    easebuzz_key: string,
    easebuzz_salt: string,
    utr: string,
    limit: number,
    skip: number,
    school_id: string,
    page?: number,
    cursor?: string,
  ) {
    try {
      const tokenPayload = {
        submerchant_id,
      };
      let verifyPage = null;

      if (cursor && cursor !== '') {
        verifyPage = this.jwtService.verify(cursor, {
          secret: process.env.PAYMENTS_SERVICE_SECRET,
        });
      }
      page = verifyPage?.page || page;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      const token = await this.jwtService.sign(tokenPayload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      const data = {
        submerchant_id,
        easebuzz_key,
        easebuzz_salt,
        start_date,
        end_date,
        page_size: 1000,
        token,
        utr,
      };

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/settlement-recon/v2`,
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        data,
      };

      // console.log(config);

      const response = await axios.request(config);
      // console.log(response.data.transactions.length, 'pp');

      const settlements_transactions = response.data?.transactions;
      // console.log(response.data, 'check');
      if (!school) throw new BadRequestException(`Could not find school `);


      const startIndex = (page - 1) * limit;
      // console.log(page);

      console.log(page - 1, 'page');
      console.log(startIndex, 'nin');


      const endIndex = page * limit;

      const paginatedTransactions = settlements_transactions.slice(
        startIndex,
        endIndex,
      );

      // add school_name in the paginated result
      paginatedTransactions.forEach((transaction: any) => {
        if (transaction?.order_id) {
          transaction.school_name = school.school_name;
        }
      });
      let totalPages = Math.ceil(settlements_transactions.length / limit) || 0;
      const payload = { page: Number(page + 1), totalPages: totalPages };
      let cursorToken = this.jwtService.sign(payload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      let updateCursor = page == totalPages ? null : cursorToken;

      return {
        limit: limit || 0,
        cursor: updateCursor,
        page: page || 0,
        totalCount: settlements_transactions.length || 0,
        totalPages: Math.ceil(settlements_transactions.length / limit) || 0,
        settlements_transactions: paginatedTransactions,
      };
    } catch (e) {
      console.log(e);
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async easebuzzSettlementReconV2(
    submerchant_id: string,
    start_date: string,
    end_date: string,
    easebuzz_key: string,
    easebuzz_salt: string,
    utr: string,
    limit: number,
    skip: number,
    school_id: string,
    page?: number,
    cursor?: string,
  ) {
    try {
      const tokenPayload = {
        submerchant_id,
      };
      let verifyPage = null;

      if (cursor && cursor !== '') {
        verifyPage = this.jwtService.verify(cursor, {
          secret: process.env.PAYMENTS_SERVICE_SECRET,
        });
      }
      page = verifyPage?.page || page;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      const token = await this.jwtService.sign(tokenPayload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      const data = {
        submerchant_id,
        easebuzz_key,
        easebuzz_salt,
        start_date,
        end_date,
        page_size: 1000,
        token,
        utr,
      };

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/settlement-recon/v2`,
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        data,
      };

      console.log(config);
      return config

      const response = await axios.request(config);
      return response.data
      console.log(response.data.transactions.length, 'pp');

      const settlements_transactions = response.data?.transactions;
      // console.log(response.data, 'check');
      if (!school) throw new BadRequestException(`Could not find school `);


      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const paginatedTransactions = settlements_transactions.slice(
        startIndex,
        endIndex,
      );

      // add school_name in the paginated result
      paginatedTransactions.forEach((transaction: any) => {
        if (transaction?.order_id) {
          transaction.school_name = school.school_name;
        }
      });
      let totalPages = Math.ceil(settlements_transactions.length / limit) || 0;
      const payload = { page: Number(page + 1), totalPages: totalPages };
      let cursorToken = this.jwtService.sign(payload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      let updateCursor = page == totalPages ? null : cursorToken;

      return {
        limit: limit || 0,
        cursor: updateCursor,
        page: page || 0,
        totalCount: settlements_transactions.length || 0,
        totalPages: Math.ceil(settlements_transactions.length / limit) || 0,
        settlements_transactions: paginatedTransactions,
      };
    } catch (e) {
      console.log(e);
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  async formatDateToDDMMYYYY(date: Date) {
    try {
      return date.toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY
    } catch (e) {

    }
  }

  async getRefundInfo(collect_id: string, school_id: string) {
    try {
      console.log({collect_id,school_id});
      
      const refunds = await this.refundRequestModel.find({ 
        order_id: new Types.ObjectId(collect_id),
        // school_id: new Types.ObjectId(school_id)
         })
        console.log(refunds);
        
      if (refunds.length === 0) {
        return false
      }
      return refunds
    } catch (e) {
      throw new BadRequestException(e.message)
    }
  }
}
