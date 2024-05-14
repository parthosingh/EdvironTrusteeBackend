import { JwtService } from '@nestjs/jwt';
import mongoose, { ObjectId, Types } from 'mongoose';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Trustee } from '../schema/trustee.schema';
import {
  PlatformCharge,
  TrusteeSchool,
  rangeCharge,
} from '../schema/school.schema';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { TrusteeMember } from '../schema/partner.member.schema';
import { EmailService } from '../email/email.service';
import { RequestMDR, mdr_status } from 'src/schema/mdr.request.schema';
import { BaseMdr } from 'src/schema/base.mdr.schema';
import { SchoolMdr } from 'src/schema/school_mdr.schema';
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
    @InjectModel(TrusteeMember.name)
    private trusteeMemberModel: mongoose.Model<TrusteeMember>,
    @InjectModel(RequestMDR.name)
    private requestMDRModel: mongoose.Model<RequestMDR>,
    @InjectModel(BaseMdr.name)
    private baseMdrModel: mongoose.Model<BaseMdr>,
    @InjectModel(SchoolMdr.name)
    private schoolMdrModel: mongoose.Model<SchoolMdr>,
  ) {}

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
        const userTrustee = {
          id: trustee._id,
          name: trustee.name,
          email: trustee.email_id,
          apiKey: trustee.apiKey || null,
          phone_number: trustee.phone_number,
          role: 'owner' || null,
          trustee_id: trustee._id,
          brand_name: trustee.brand_name || null,
        };
        return userTrustee;
      }
      const member = await this.trusteeMemberModel.findById(decodedPayload.id);
      if (member) {
        const trustee = await this.trusteeModel.findById(member.trustee_id);
        const userTrustee = {
          id: member._id,
          name: member.name,
          email: member.email,
          apiKey: trustee.apiKey || null,
          role: member.access || null,
          phone_number: member.phone_number,
          trustee_id: member.trustee_id || null,
          brand_name: trustee.brand_name || null,
        };
        return userTrustee;
      }
      throw new NotFoundException('User not found');
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getSchools(trusteeId: string) {
    try {
      if (!Types.ObjectId.isValid(trusteeId)) {
        throw new BadRequestException('Invalid trusteeID format');
      }
      const trusteeObjectId = new mongoose.Types.ObjectId(trusteeId);

      const trustee = await this.trusteeModel.findById(trusteeId);

      if (!trustee) {
        throw new ConflictException(`no trustee found`);
      }
      const schools = await this.trusteeSchoolModel
        .find(
          { trustee_id: trusteeObjectId },
          {
            school_id: 1,
            school_name: 1,
            merchantStatus: 1,
            _id: 0,
            email: 1,
            pg_key: 1,
            disabled_modes: 1,
            platform_charges: 1,
          },
        )
        .sort({ createdAt: -1 })
        .exec();

      return { schoolData: schools };
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

  async requestMDR(
    trustee_id: ObjectId,
    school_id: string[],
    platform_type: string,
    payment_mode: string,
    range_charge: rangeCharge[],
  ) {
    let mdr = await this.requestMDRModel
      .findOne({ trustee_id })
      .sort({ createdAt: -1 });

    if (!mdr) {
      mdr = await this.requestMDRModel.create({
        trustee_id,
        school_id,
        platform_charges: [
          {
            platform_type,
            payment_mode,
            range_charge,
          },
        ],
        status: mdr_status.INITIATED,
      });

      return 'New MDR created';
    }
    if (mdr.status === mdr_status.PROCESSING) {
      throw new Error(
        'Your MDR is under Processing, You cannot requst for update',
      );
    }
    if (![mdr_status.REJECTED, mdr_status.APPROVED].includes(mdr.status)) {
      // If status is not PROCESSING, REJECTED, or APPROVED, update the existing MDR
      const existingPlatformChargeIndex = mdr.platform_charges.findIndex(
        (pc) =>
          pc.platform_type.toLowerCase() === platform_type.toLowerCase() &&
          pc.payment_mode.toLowerCase() === payment_mode.toLowerCase(),
      );

      if (existingPlatformChargeIndex !== -1) {
        // console.log(mdr.platform_charges[existingPlatformChargeIndex].range_charge);
        console.log(mdr._id);

        range_charge.forEach(async (item) => {
          console.log(item, 'items');
          await this.requestMDRModel.findOneAndUpdate(
            {
              _id: mdr._id,
              platform_charges: { $elemMatch: { platform_type, payment_mode } },
            },
            {
              // $set: { 'platform_charges.$.range_charge': range_charge }, use this if relace whole arrray instead of pushing
              $push: {
                'platform_charges.$.range_charge': {
                  upto: item.upto,
                  charge_type: item.charge_type,
                  charge: item.charge,
                },
              },
            },
            { returnDocument: 'after' },
          );
        });

        console.log(
          'Updated MDR after range_charge modification:',
          mdr.platform_charges[existingPlatformChargeIndex].range_charge,
        );
        try {
          await mdr.save();
          console.log('MDR saved successfully');
        } catch (error) {
          console.error('Error saving MDR:', error);
          throw error; // Propagate the error for further investigation
        }
      } else {
        // Add new platform_charge

        mdr.platform_charges.push({
          platform_type,
          payment_mode,
          range_charge,
        });
      }
      mdr.school_id = school_id;
      await mdr.save();

      return 'MDR updated';
    } else {
      // If status is PROCESSING, REJECTED, or APPROVED, create a new MDR
      const newMDR = await this.requestMDRModel.create({
        trustee_id,
        school_id,
        platform_charges: [
          {
            platform_type,
            payment_mode,
            range_charge,
          },
        ],
        status: mdr_status.INITIATED,
      });

      return 'New MDR created (previous MDR status is not eligible for update)';
    }
  }

  async bulkEequestMDR(
    trustee_id: ObjectId,
    school_id: string[],
    platform_chargers: PlatformCharge[],
  ) {
    let mdr = await this.requestMDRModel
      .findOne({ trustee_id })
      .sort({ createdAt: -1 });

    if (!mdr) {
      mdr = await this.requestMDRModel.create({
        trustee_id,
        school_id,
        platform_charges: platform_chargers,
        status: mdr_status.INITIATED,
      });

      return 'New MDR created';
    }
    if (mdr.status === mdr_status.PROCESSING) {
      throw new Error(
        'Your MDR is under Processing, You cannot requst for update',
      );
    }
    if (![mdr_status.REJECTED, mdr_status.APPROVED].includes(mdr.status)) {
      let schoolArr=[]
      await this.requestMDRModel.findOneAndUpdate(
        { _id: mdr._id },
        {
          $set: { platform_charges: platform_chargers },
        },
      );
      mdr.school_id = school_id;
      await mdr.save();

      return 'MDR updated';
    } else {
      // If status is REJECTED, or APPROVED, create a new MDR
      const newMDR = await this.requestMDRModel.create({
        trustee_id,
        school_id,
        platform_chargers,
        status: mdr_status.INITIATED,
      });

      return 'New MDR created (previous MDR status is not eligible for update)';
    }
  }

  async saveBaseMdr(
    trustee_id: ObjectId,
    school_id: string,
    platform_type: String,
    payment_mode: String,
    range_charge: rangeCharge[],
  ) {
    const res = await this.baseMdrModel.findOneAndUpdate(
      { trustee_id: trustee_id },
      {
        status: mdr_status.PROCESSING,
        $push: {
          platform_charges: {
            platform_type,
            payment_mode,
            range_charge,
          },
        },
      },
      { upsert: true, new: true },
    );
  }

  async saveBulkMdr(trustee_id: string, platform_charges: PlatformCharge[]) {
    const trusteeId = new Types.ObjectId(trustee_id);
    await this.baseMdrModel.findOneAndUpdate(
      {
        trustee_id: trusteeId,
      },
      {
        platform_charges,
      },
      { upsert: true, new: true },
    );

    return 'mdr updated';
  }

  async rejectMdr(id: string, comment: string) {
    const mdr = await this.requestMDRModel.findById(id);
    mdr.status = mdr_status.REJECTED;
    mdr.comment = comment;
    await mdr.save();
    return 'status updated';
  }

  async getTrusteeMdr(trustee_id: string) {
    const trusteeId = new Types.ObjectId(trustee_id);
    return await this.requestMDRModel.find({ trustee_id: trusteeId });
  }

  async getTrusteeBaseMdr(trustee_id: string) {
    const trusteeId = new Types.ObjectId(trustee_id);
    return await this.baseMdrModel.findOne({ trustee_id: trusteeId });
  }

  async toogleDisable(mode: string, school_id: string) {
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

  async getSchoolMdr(school_id: string) {
    try {
      let schoolId = new mongoose.Types.ObjectId(school_id);
      const school = await this.trusteeSchoolModel.findOne({
        school_id: schoolId,
      });
      //if (!school) throw new NotFoundException('School not found');
      if (!school) return;

      const schoolMdr = await this.schoolMdrModel.findOne({
        school_id: schoolId,
      });
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
}
