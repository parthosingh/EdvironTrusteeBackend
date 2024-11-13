import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { TrusteeSchool } from 'src/schema/school.schema';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { TrusteeService } from 'src/trustee/trustee.service';
import { MerchantMember } from 'src/schema/merchant.member.schema';
import { error } from 'console';
import { Trustee } from 'src/schema/trustee.schema';
import { refund_status, RefundRequest } from 'src/schema/refund.schema';
import { Types } from 'mongoose';
import axios from 'axios';
var loginOtps: any = {};
var resetOtps: any = {}; //reset password
var editOtps: any = {};
var editOtpTimeouts: any = {};
var loginOtpTimeouts: any = {};
var resetOtpTimeouts: any = {};

@Injectable()
export class MerchantService {
  constructor(
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(MerchantMember.name)
    private merchantMemberModel: mongoose.Model<MerchantMember>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
    private jwtService: JwtService,
    private trusteeService: TrusteeService,
  ) {}

  async loginAndGenerateToken(
    email: string,
    passwordHash: string,
  ): Promise<Boolean> {
    try {
      const lowerCaseEmail = email.toLowerCase();
      var res = false;
      const merchant = await this.trusteeSchoolModel.findOne({ email: lowerCaseEmail });
      var email_id = merchant?.email;
      var passwordMatch;

      if (merchant) {
        passwordMatch = await bcrypt.compare(
          passwordHash,
          merchant.password_hash,
        );
      } else {
        const member = await this.merchantMemberModel.findOne({ email: email });
        email_id = member.email;
        passwordMatch = await bcrypt.compare(
          passwordHash,
          member.password_hash,
        );
      }
      if (!passwordMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if ((await this.sendLoginOtp(email_id)) == true) res = true;

      return res;
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async sendLoginOtp(email: string) {
    if (!email) {
      throw new BadRequestException('Invalid email');
    }
    const merchant = await this.trusteeSchoolModel.findOne({
      email: email,
    });
    var email_id = merchant?.email;

    if (!merchant) {
      const member = await this.merchantMemberModel.findOne({ email: email });
      if (!member) throw new BadRequestException('Email not found');
      email_id = member.email;
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    loginOtps[email_id] = otp;
    // Clear existing timeout if it exists
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
      'src/merchant/otp-template.html',
      merchant,
    );
    return true;
  }

  async validateLoginOtp(otp: string, email: string) {
    if (loginOtps[email] == otp) {
      delete loginOtps[email];
      const merchant = await this.trusteeSchoolModel.findOne({
        email: email,
      });
      let payload;
      if (merchant) {
        payload = {
          id: merchant._id,
        };
      } else {
        const member = await this.merchantMemberModel.findOne({ email });
        payload = {
          id: member._id,
        };
      }
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET_FOR_MERCHANT_AUTH,
      });

      return token;
    } else {
      throw new Error('Invalid OTP');
    }
  }

  async validateMerchant(token: string): Promise<any> {
    try {
      if (!token) return;
      const decodedPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_FOR_MERCHANT_AUTH,
      });
      console.log(decodedPayload,'payload');
      
      const merchant = await this.trusteeSchoolModel.findById(
        decodedPayload.id,
      );
      let trustee: Trustee;

      if (merchant) {
        trustee = await this.trusteeModel.findById(merchant.trustee_id);

        const userMerchant = {
          id: merchant._id,
          name: merchant.school_name,
          email: merchant.email,
          role: 'owner',
          phone_number: merchant.phone_number,
          user: merchant.super_admin_name,
          apiKey: trustee.apiKey,
          merchant: merchant._id,
          trustee_id:trustee._id,
          trustee_logo:trustee.logo || null
        };
        return userMerchant;
      }

      const member = await this.merchantMemberModel.findById(decodedPayload.id);

      if (member) {
        const merchant = await this.trusteeSchoolModel.findById(
          member.merchant_id,
        );
        if (!merchant)
          throw new UnauthorizedException(
            'Member not registered to any trustee',
          );
        trustee = await this.trusteeModel.findById(merchant.trustee_id);
        const userMerchant = {
          id: member._id,
          name: merchant.school_name,
          email: member.email,
          role: member.access || null,
          phone_number: member.phone_number,
          user: member.name,
          apiKey: trustee.apiKey,
          merchant: merchant._id,
          trustee_id:trustee._id,
          trustee_logo:trustee.logo || null
        };
        return userMerchant;
      }
      throw new NotFoundException('User not found');
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async sendResetPassMail(email) {
    try {
      const merchant = await this.trusteeSchoolModel.findOne({ email: email });
      if (!merchant) {
        const member = await this.merchantMemberModel.findOne({ email });
        if (!member) throw new NotFoundException('Email not registered');
      }

      const expirationTime = Math.floor(Date.now() / 1000) + 1 * 60; // 30 minutes
      const data = {
        email: email,
        // exp: expirationTime
      };
      const token = this.jwtService.sign(data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
        expiresIn: expirationTime, //30 mins
      });

      const resetURL = `${process.env.MERCHANT_DASHBOARD_URL}/reset-password?token=${token}`;
      const __dirname = path.resolve();
      const filePath = path.join(
        __dirname,
        'src/merchant/reset-mail-template.html',
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
      // const info = await transporter.sendMail(mailOptions);
      await this.trusteeService.sendMails(email, mailOptions);
      return true;
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error.message);
    }
  }

  async resetPassword(email, password) {
    try {
      const merchant = await this.trusteeSchoolModel.findOne({ email: email });
      if (merchant) {
        merchant.password_hash = password;
        await merchant.save();
      }
      const member = await this.merchantMemberModel.findOne({ email });
      if (member) {
        member.password_hash = password;
        await member.save();
        return true;
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
      console.log(error);

      return false;
    }
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
      // attachments: [
      //   {
      //     filename: 'logo.png',
      //     path: __dirname + '/src/email/asserts/logo.png',
      //     cid: 'unique@cid',
      //   },
      // ],
    };

    await this.trusteeService.sendMails(email_id, mailOptions);
    console.log('mail sent', { email_id, subject, text });
    return true;
  }

  async sendResetPassOtp(email: string) {
    if (!email) {
      throw new BadRequestException('Invalid email');
    }
    const merchant = await this.trusteeSchoolModel.findOne({
      email: email,
    });
    var email_id = merchant.email;

    if (!merchant) {
      const member = await this.merchantMemberModel.findOne({ email: email });
      if (!member) throw new BadRequestException('Email not found');
      email_id = member.email;
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    resetOtps[email_id] = otp;
    // Clear existing timeout if it exists
    if (resetOtpTimeouts[email_id]) {
      clearTimeout(resetOtpTimeouts[email_id]);
    }

    resetOtpTimeouts[email_id] = setTimeout(() => {
      delete editOtps[email_id];
      console.log('Merchant reset password otp deleted for ', { email_id });
    }, 180000);
    this.sendOTPMail(
      email_id,
      'OTP',
      `${otp}`,
      'src/merchant/reset-pass-template.html',
      merchant,
    );
    return true;
  }

  async validatePasswordOtp(otp: string, email: string) {
    if (resetOtps[email] == otp) {
      delete resetOtps[email];
      const merchant = await this.trusteeSchoolModel.findOne({
        email: email,
      });
      if (merchant) {
        return true;
      }
    }
    return false;
  }

  async updateMemberDetails(user_id, name, email, phone_number) {
    try {
      const member = await this.merchantMemberModel.findOne({ _id: user_id });
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

  async validateUpdateMailOtp(otp, email) {
    if (editOtps[email] == otp) {
      delete editOtps[email];
      const merchant = await this.trusteeSchoolModel.findOne({
        email: email,
      });
      if (merchant) {
        return true;
      }
    }
    return false;
  }

  async sendEditOtp(email: string) {
    if (!email) {
      throw new BadRequestException('Invalid email');
    }
    const merchant = await this.trusteeSchoolModel.findOne({
      email: email,
    });
    var email_id = merchant.email;

    if (!merchant) {
      const member = await this.merchantMemberModel.findOne({ email: email });
      if (!member) throw new BadRequestException('Email not found');
      email_id = member.email;
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    editOtps[email_id] = otp;
    // Clear existing timeout if it exists
    if (editOtpTimeouts[email_id]) {
      clearTimeout(editOtpTimeouts[email_id]);
    }

    editOtpTimeouts[email_id] = setTimeout(() => {
      delete editOtps[email_id];
      console.log('Merchant reset password otp deleted for ', { email_id });
    }, 180000);
    this.sendOTPMail(
      email_id,
      'OTP',
      `${otp}`,
      'src/merchant/edit-template.html',
      merchant,
    );
    return true;
  }
  
  async getRefundRequest(order_id:string){
    const refundRequests = await this.refundRequestModel.find({
      order_id: new Types.ObjectId(order_id),
      status:{$ne:refund_status.DELETED}
    }).sort({createdAt:-1});  
    return refundRequests;
  }

  async updateRefundRequest(trustee_id:string){
    const refundRequest = await this.refundRequestModel.find({trustee_id:new Types.ObjectId(trustee_id)})
    if (refundRequest.length > 0) {
      console.log(refundRequest.length);
      
      refundRequest.map(async(info:any)=>{
        try{
          let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-custom-id?collect_id=${info.order_id}`,
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            }
          };
          const refundRequests=await this.refundRequestModel.findOne({order_id:info.order_id})
          const response = await axios.request(config);
          console.log(response.data, 'res');
          refundRequests.custom_id=response.data
          await refundRequests.save()
        }catch(err){
          console.log(`Error in getting custom id: ${err.message}`);
          
        }
        
      })
      return 'found'
    }
    return 'not found';
  }
  
}
