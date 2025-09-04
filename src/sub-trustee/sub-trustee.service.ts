import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import axios from 'axios';
import { Trustee } from 'src/schema/trustee.schema';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { TrusteeService } from 'src/trustee/trustee.service';
import * as nodemailer from 'nodemailer';
import { SubTrustee } from 'src/schema/subTrustee.schema';
import { count } from 'console';
import { Types } from 'mongoose';
import { Disputes } from 'src/schema/disputes.schema';
import { TrusteeSchool } from 'src/schema/school.schema';
import { Vendors } from 'src/schema/vendors.schema';
var loginOtps: any = {};
var resetOtps: any = {}; //reset password
var editOtps: any = {};
var editOtpTimeouts: any = {};
var loginOtpTimeouts: any = {};
var resetOtpTimeouts: any = {};

@Injectable()
export class SubTrusteeService {
  constructor(
    @InjectModel(SubTrustee.name)
    private subTrustee: mongoose.Model<SubTrustee>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    private jwtService: JwtService,
    @InjectModel(Disputes.name)
    private DisputesModel: mongoose.Model<Disputes>,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(Vendors.name)
    private vendorsModel: mongoose.Model<Vendors>,
  ) {}

  async validateMerchant(token: string): Promise<any> {
    try {
      console.log('validating');

      if (!token) return;
      const decodedPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_SUBTRUSTEE_AUTH,
      });
      const subTrustee = await this.subTrustee.findById(decodedPayload.id);
      if (!subTrustee) {
        throw new BadRequestException('sub trustee not found');
      }
      let trustee = await this.trusteeModel.findById(subTrustee.trustee_id);
      const userMerchant = {
        id: subTrustee._id,
        name: subTrustee.name,
        email: subTrustee.email,
        role: subTrustee.role,
        phone: subTrustee.phone,
        apiKey: trustee.apiKey,
        subTrustee: subTrustee._id,
        trustee_id: trustee._id,
        logo: subTrustee.logo || null,
      };
      return userMerchant;
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async loginAndGenerateToken(email: string, passwordHash: string) {
    try {
      const lowerCaseEmail = email.toLowerCase();
      var res = false;
      const subtrustee = await this.subTrustee.findOne({
        email: lowerCaseEmail,
      });
      console.log(subtrustee, 'subtrustee');
      var email_id = subtrustee?.email;
      let passwordMatch = await bcrypt.compare(
        passwordHash,
        subtrustee.password_hash,
      );
      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const payload = {
        id: subtrustee._id,
        role: 'owner',
      };
      return {
        token: await this.jwtService.sign(payload, {
          secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
          expiresIn: '30d',
        }),
      };
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async sendLoginOtp(email: string) {
    if (!email) {
      throw new BadRequestException('Invalid email');
    }
    const subtrustee = await this.subTrustee.findOne({
      email: email,
    });
    if (!subtrustee) {
      throw new NotFoundException('subtrustee not found');
    }
    var email_id = subtrustee?.email;

    const otp = Math.floor(100000 + Math.random() * 900000);
    loginOtps[email_id] = otp;
    if (loginOtpTimeouts[email_id]) {
      clearTimeout(loginOtpTimeouts[email_id]);
    }

    loginOtpTimeouts[email_id] = setTimeout(() => {
      delete editOtps[email_id];
      console.log('Merchant login otp deleted for ', { email_id });
    }, 180000);
    this.sendOTPMail(
      email_id,
      'OTP',
      `${otp}`,
      'src/sub-trustee/otp-template.html',
      subtrustee,
    );
    return true;
  }

  async sendOTPMail(
    email_id: string,
    subject: string,
    text: string,
    template_path: string,
    school?: any,
  ) {
    if (!email_id) throw new Error('Invalid email id');
    const __dirname = path.resolve();
    const filePath = path.join(__dirname, template_path);
    const source = fs.readFileSync(filePath, 'utf-8').toString();
    const template = handlebars.compile(source);
    const replacements = {
      otp: text,
      school: school?.name,
    };
    const htmlToSend = template(replacements);
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email_id,
      subject: subject,
      text: text,
      html: htmlToSend,
    };
    await this.sendMails(email_id, mailOptions);
    console.log('mail sent', { email_id, subject, text });
    return true;
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

  async validateLoginOtp(otp: string, email: string) {
    if (loginOtps[email] == otp) {
      delete loginOtps[email];
      const merchant = await this.subTrustee.findOne({
        email: email,
      });
      let payload = {
        id: merchant._id,
        role: merchant.role,
      };
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_SUBTRUSTEE_AUTH,
      });
      return token;
    } else {
      throw new Error('Invalid OTP');
    }
  }

  async getSubTrusteeSchools(
    subTrusteeId: string,
    page: number,
    limit: number,
    searchQuery?: string,
    kycStatus?: string[],
  ) {
    try {
      const subTrustee = await this.subTrustee.findById(subTrusteeId);
      if (!subTrustee) {
        throw new NotFoundException('Sub-trustee not found');
      }
      const trusteeId = subTrustee.trustee_id;
      let searchFilter: any = {
        trustee_id: trusteeId,
        subtrustee_ids: { $in: [new Types.ObjectId(subTrusteeId)] },
      };
      if (searchQuery) {
        if (searchQuery) {
          searchFilter = {
            ...searchFilter,
            $or: [
              { school_name: { $regex: searchQuery, $options: 'i' } },
              { email: { $regex: searchQuery, $options: 'i' } },
              { pg_key: { $regex: searchQuery, $options: 'i' } },
            ],
          };
        }
      }

      if (kycStatus && kycStatus.length > 0) {
        searchFilter = {
          ...searchFilter,
          merchantStatus: { $in: kycStatus },
        };
      }
      const countDocs = await this.trusteeModel.countDocuments(searchFilter);
      const schools = await this.trusteeModel
        .find(searchFilter)
        .skip((page - 1) * limit)
        .limit(limit);

      const schoolsWithBankDetails = await Promise.all(
        schools.map(async (school: any) => {
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

      const totalPages = Math.ceil(countDocs / limit);

      return {
        schoolData: schoolsWithBankDetails,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: countDocs,
        },
      };
    } catch (error) {
      console.log(error);
      throw new BadRequestException(error.message);
    }
  }

  async getDisputes(
    sub_trustee_id: string,
    trustee_id: string,
    page: number,
    limit: number,
    school_id?: string[],
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
        ...(school_id && {
          school_id: { $in: school_id.map((id) => new Types.ObjectId(id)) },
        }),
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
      if (!school_id || school_id.length <= 0) {
        let schoolFilter: any = {
          trustee_id: trustee_id,
          sub_trustee_id: { $in: [new Types.ObjectId(sub_trustee_id)] },
        };

        const schools = await this.trusteeSchoolModel
          .find(schoolFilter)
          .select('school_id -_id');
        const school_id = schools.map((school) => school.school_id.toString());
        query.school_id = {
          $in: school_id.map((id) => new Types.ObjectId(id)),
        };
      }
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
      console.log(school_id, 'school_id');
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
      console.log(transactions, 'transactions');

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

      const resetURL = `${process.env.SUB_TRUSTEE_DASHBOARD_URL}/reset-password?token=${token}`;
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

  async resetPassword(email, password) {
    try {
      const subTrustee = await this.subTrustee.findOne({ email_id: email });
      if (subTrustee) {
        subTrustee.password_hash = password;
        await subTrustee.save();
        return true;
      }
      throw new BadRequestException('Error in saving passsword');
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
