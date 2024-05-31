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
      const baseMdr = await this.baseMdrModel.findOne({
        trustee_id: trustee._id,
      });
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
          base_mdr: baseMdr,
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
          (result !== null && result.status === mdr_status.INITIATED) ||
          result.status === mdr_status.PROCESSING
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
    console.log("final charges", existingCharges);
    await this.baseMdrModel.findOneAndUpdate(
      {
        trustee_id: trusteeId,
      },
      {
        trustee_id: trusteeId,
        platform_charges,
      },
      { upsert: true, new: true },
    );

    const trusteeSchools = await this.trusteeSchoolModel.find({
      trustee_id: trusteeId,
    });
    for (const school of trusteeSchools) {
      const schoolMdr = await this.schoolMdrModel.findOneAndUpdate(
        { school_id: school.school_id },
        { mdr2: platform_charges, school_id: school.school_id },
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
      const schoolId = new Types.ObjectId(school_id);
      const school = await this.trusteeSchoolModel.findOne({
        school_id: schoolId,
      });
      if (!school) throw new NotFoundException('School not found');
      console.log(schoolId);

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
          schoolPlatform.platform_type === basePlatform.platform_type,
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
              charge_type: baseCharge.charge_type,
              base_charge: baseCharge.charge,
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
          schoolMdrReq.platform_type === basePlatform.platform_type,
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
            const commission = schoolCharge.charge - baseCharge.charge;
            const combinedCharge = {
              upto: baseCharge.upto,
              charge_type: baseCharge.charge_type,
              base_charge: baseCharge.charge,
              charge: schoolCharge.charge,
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
}
