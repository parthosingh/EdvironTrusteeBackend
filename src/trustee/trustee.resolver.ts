import {
  Resolver,
  Mutation,
  Args,
  Query,
  Int,
  Context,
  InputType,
  ID,
} from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';
import {
  PlatformCharge,
  TrusteeSchool,
  rangeCharge,
} from '../schema/school.schema';
import { TrusteeGuard } from './trustee.guard';
import { ErpService } from '../erp/erp.service';
import mongoose, { ObjectId, Types } from 'mongoose';
import { MainBackendService } from '../main-backend/main-backend.service';
import { InjectModel } from '@nestjs/mongoose';
import { SettlementReport } from '../schema/settlement.schema';
import { JwtService } from '@nestjs/jwt';
import axios, { AxiosError } from 'axios';
import { Trustee } from '../schema/trustee.schema';
import { TrusteeMember } from '../schema/partner.member.schema';
import { BaseMdr } from 'src/schema/base.mdr.schema';
import { SchoolMdr } from 'src/schema/school_mdr.schema';

@Resolver('Trustee')
export class TrusteeResolver {
  constructor(
    private readonly trusteeService: TrusteeService,
    private readonly erpService: ErpService,
    private mainBackendService: MainBackendService,
    private readonly jwtService: JwtService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeMember.name)
    private trusteeMemberModel: mongoose.Model<TrusteeMember>,
  ) {}

  @Mutation(() => AuthResponse) // Use the AuthResponse type
  async loginTrustee(
    @Args('email') email_id: string,
    @Args('password') password_hash: string,
  ): Promise<AuthResponse> {
    try {
      const { token } = await this.trusteeService.loginAndGenerateToken(
        email_id,
        password_hash,
      );

      return { token };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new Error('Invalid email or password');
      } else {
        throw new Error('An error occurred during login');
      }
    }
  }

  @Mutation(() => SchoolTokenResponse)
  @UseGuards(TrusteeGuard)
  async generateSchoolToken(
    @Args('schoolId') schoolId: string,
    @Args('password') password: string,
    @Context() context,
  ): Promise<SchoolTokenResponse> {
    try {
      let userId = context.req.trustee;

      const role = context.req.role;
      if (role !== 'owner' && role !== 'admin') {
        throw new UnauthorizedException(
          'You are not Authorized to perform this action',
        );
      }
      const { token, user } = await this.trusteeService.generateSchoolToken(
        schoolId,
        password,
        userId,
      );
      return { token, user };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new Error(error.message);
      } else if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new Error('Error generating school token');
      }
    }
  }

  @Query(() => getSchool)
  @UseGuards(TrusteeGuard)
  async getSchoolQuery(@Context() context): Promise<any> {
    try {
      let id = context.req.trustee;
      const schools = await this.trusteeService.getSchools(id);

      return {
        schools: schools.schoolData,
      };
    } catch (error) {
      const customError = {
        message: error.message,
        statusCode: error.status,
      };
      if (error instanceof ConflictException) {
        throw new ConflictException(customError);
      } else {
        throw new BadRequestException(customError);
      }
    }
  }
  @Mutation(() => ApiKey)
  @UseGuards(TrusteeGuard)
  async createApiKey(
    @Args('otp') otp: string,
    @Context() context,
  ): Promise<ApiKey> {
    try {
      let id = context.req.trustee;

      const trustee = await this.trusteeModel.findById(id);
      const role = context.req.role;
      if (role !== 'owner' && role !== 'admin') {
        throw new UnauthorizedException(
          'You are not Authorized to perform this action',
        );
      }

      const validate = await this.trusteeService.validateApidOtp(
        otp,
        trustee.email_id,
      );
      if (!validate) {
        throw new Error('Invalid OTP');
      }
      const apiKey = await this.erpService.createApiKey(id);
      return { key: apiKey };
    } catch (error) {
      const customError = {
        message: error.message,
        statusCode: error.status,
      };
      if (error instanceof NotFoundException) {
        throw new NotFoundException(customError);
      } else {
        throw new BadRequestException(customError);
      }
    }
  }

  @Query(() => TrusteeUser)
  async getUserQuery(@Context() context): Promise<TrusteeUser> {
    try {
      const token = context.req.headers.authorization.split(' ')[1]; // Extract the token from the authorization header
      const userTrustee = await this.trusteeService.validateTrustee(token);
      // Map the trustee data to the User type
      const user: TrusteeUser = {
        _id: userTrustee.id,
        name: userTrustee.name,
        email_id: userTrustee.email,
        apiKey: userTrustee.apiKey,
        role: userTrustee.role,
        phone_number: userTrustee.phone_number,
        trustee_id: userTrustee.trustee_id,
        brand_name: userTrustee.brand_name,
        base_mdr: userTrustee.base_mdr,
      };
      return user;
    } catch (error) {
      const customError = {
        message: error.message,
        statusCode: error.status,
      };
      if (error instanceof ConflictException) {
        throw new ConflictException(customError);
      } else {
        throw new BadRequestException(customError);
      }
    }
  }

  @Mutation(() => pg_key)
  @UseGuards(TrusteeGuard)
  async resetKey(@Context() context, @Args('school_id') school_id: string) {
    // const trusteeId = context.req.trustee;
    let id = context.req.trustee;

    const role = context.req.role;
    if (role !== 'owner' && role !== 'admin') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const schoolId = new Types.ObjectId(school_id);
    const school = await this.trusteeSchoolModel.findOne({
      trustee_id: id,
      school_id: schoolId,
    });

    const pg_key = await this.mainBackendService.generateKey();

    school.pg_key = pg_key;
    await school.save();
    return { pg_key };
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async sentKycInvite(
    @Args('school_name') school_name: string,
    @Args('school_id') school_id: string,
    @Context() context,
  ) {
    const payload = {
      school_name,
      school_id,
    };
    const role = context.req.role;
    if (role !== 'owner' && role !== 'admin') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const token = await this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET_FOR_INTRANET,
    });
    await axios.post(
      `${process.env.MAIN_BACKEND_URL}/api/trustee/sentkycinvite`,
      {
        token: token,
      },
    );
    return 'kyc invite sent';
  }

  @Query(() => [SettlementReport])
  @UseGuards(TrusteeGuard)
  async getSettlementReports(@Context() context) {
    let id = context.req.trustee;

    let settlementReports = [];
    settlementReports = await this.settlementReportModel
      .find({ trustee: id })
      .sort({ createdAt: -1 });
    return settlementReports;
  }

  @Query(() => [TransactionReport])
  @UseGuards(TrusteeGuard)
  async getTransactionReport(@Context() context) {
    try {
      let id = context.req.trustee;

      const merchants = await this.trusteeSchoolModel.find({
        trustee_id: id,
      });
      let transactionReport = [];

      const merchant_ids_to_merchant_map = {};
      merchants.map((merchant: any) => {
        merchant_ids_to_merchant_map[merchant.school_id] = merchant;
      });

      let token = this.jwtService.sign(
        { trustee_id: id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report/?limit=50000`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: { trustee_id: id, token },
      };

      const response = await axios.request(config);

      transactionReport = response.data.transactions.map((item: any) => {
        return {
          ...item,
          merchant_name:
            merchant_ids_to_merchant_map[item.merchant_id].school_name,
          student_id:
            JSON.parse(item?.additional_data).student_details?.student_id || '',

          student_name:
            JSON.parse(item?.additional_data).student_details?.student_name ||
            '',

          student_email:
            JSON.parse(item?.additional_data).student_details?.student_email ||
            '',
          student_phone:
            JSON.parse(item?.additional_data).student_details
              ?.student_phone_no || '',
          receipt:
            JSON.parse(item?.additional_data).student_details?.receipt || '',
          additional_data:
            JSON.parse(item?.additional_data).additional_fields || '',
          currency: 'INR',
          school_id: item.merchant_id,
          school_name:
            merchant_ids_to_merchant_map[item.merchant_id].school_name,
        };
      });

      transactionReport.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      return transactionReport;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query(() => [School])
  @UseGuards(TrusteeGuard)
  async getAllSchoolQuery(@Context() context): Promise<any> {
    try {
      let id = context.req.trustee;

      return await this.trusteeSchoolModel.find({
        trustee_id: id,
      });
    } catch (error) {
      throw error;
    }
  }

  // reset password mail
  @Mutation(() => verifyRes)
  async resetMails(@Args('email') email: string) {
    const trustee = await this.trusteeModel.findOne({ email_id: email });
    if (!trustee) {
      const member = await this.trusteeMemberModel.findOne({ email });
      if (!member) {
        throw new Error('User not found');
      }
    }
    await this.trusteeService.sentResetMail(email);
    return { active: true };
  }

  // reset password
  @Mutation(() => resetPassResponse)
  async resetPassword(
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    await this.trusteeService.resetPassword(email, password);
    return { msg: `Password Change` };
  }

  //verify reset password token
  @Query(() => verifyRes)
  async verifyToken(@Args('token') token: string) {
    const res = await this.trusteeService.verifyresetToken(token);
    return { active: res };
  }

  @Mutation(() => createSchoolResponse)
  @UseGuards(TrusteeGuard)
  async createSchool(
    @Args('email') email: string,
    @Args('school_name') school_name: string,
    @Args('phone_number') phone_number: string,
    @Args('admin_name') admin_name: string,
    @Context() context,
  ) {
    let id = context.req.trustee;

    const role = context.req.role;
    if (role !== 'owner' && role !== 'admin') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const school = await this.erpService.createSchool(
      phone_number,
      admin_name,
      email,
      school_name,
      id,
    );

    const response: createSchoolResponse = {
      admin_id: school.adminInfo._id,
      school_id: school.adminInfo.school_id,
      school_name: school.updatedSchool.updates.name,
    };
    return response;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async createBulkTrusteeSchool(
    @Args('schools', { type: () => [SchoolInputBulk] })
    schools: SchoolInputBulk[],
    @Context() context,
  ) {
    try {
      let createdCount = 0;
      let existingSchool = 0;
      const errorInSchool = 0;
      const trusteeSchoolsCreated = 0;
      let result = '';
      const role = context.req.role;

      if (role !== 'owner' && role !== 'admin') {
        throw new UnauthorizedException(
          'You are not Authorized to perform this action',
        );
      }
      let id = context.req.trustee;

      const trustee = await this.trusteeModel.findById(id);
      if (!trustee) throw new NotFoundException('Trustee not found');

      const schoolsInfo = {
        schools,
        trustee_id: trustee._id,
        trustee_name: trustee.name,
      };
      const token = this.jwtService.sign(schoolsInfo, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      const response = await axios.post(
        `${process.env.MAIN_BACKEND_URL}/api/trustee/create-bulk-school`,
        {
          token,
        },
      );

      const verifiedInfo = this.jwtService.verify(response.data, {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      });

      createdCount = verifiedInfo.createdCount;
      existingSchool = verifiedInfo.alreadyExists;
      const newSchools = verifiedInfo.schools;

      if (newSchools && newSchools.length !== 0) {
        await Promise.all(
          newSchools.map(async (school) => {
            const newTrusteeSchool = await new this.trusteeSchoolModel({
              school_id: school.school_id,
              school_name: school.school_name,
              email: school.school_email,
              trustee_id: trustee._id,
            }).save();
          }),
        );
      }

      result = `${createdCount} schools created, ${existingSchool} already exist, error in Creating ${errorInSchool} schools`;
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Query(() => TokenResponse)
  async kycLoginToken(
    @Args('school_id') school_id: string,
    @Context() context,
  ) {
    const role = context.req.role;
    if (role !== 'owner' && role !== 'admin') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const token = await this.jwtService.sign(
      { school_id },
      {
        secret: process.env.JWT_SECRET_FOR_INTRANET,
      },
    );
    const res = await axios.get(
      `${process.env.MAIN_BACKEND_URL}/api/trustee/validate-kyc-login?token=${token}`,
    );
    return { token: res.data.token };
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async createMember(
    @Args('name') name: string,
    @Args('email') email: string,
    @Args('phone_number') phone_number: string,
    @Args('access') access: string,
    @Args('password') password: string,
    @Context() context,
  ) {
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    if (!name || !email || !phone_number || !access || !password) {
      throw new Error('One or more required fields are missing.');
    }

    if (!['admin', 'management'].includes(access)) {
      throw new Error('Invalid access level provided.');
    }

    if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\+[0-9]+)?$/.test(email)
    )
      throw new Error('Invalid Email!');
    if (!/^\d{10}$/.test(phone_number))
      throw new Error('Invalid phone number!');

    const trustee = await this.trusteeModel.findOne({
      $or: [{ email_id: email }, { phone_number: phone_number }],
    });
    const member = await this.trusteeMemberModel.findOne({
      $or: [{ email }, { phone_number }],
    });
    if (trustee) {
      throw new ConflictException(
        'This email or phone number is already registered for a partner account. Please use a different email or phone number.',
      );
    }
    if (member) {
      throw new ConflictException('Email or Phone Number is Taken');
    }

    await new this.trusteeMemberModel({
      trustee_id: context.req.trustee,
      name,
      email,
      phone_number,
      access,
      password_hash: password,
    }).save();

    return `Member created Successfully`;
  }
  @UseGuards(TrusteeGuard)
  @Query(() => [MemberesResponse])
  async getAllMembers(@Context() context) {
    let id = context.req.trustee;

    const allMembers = await this.trusteeMemberModel
      .find({ trustee_id: id })
      .select('-password_hash')
      .sort({ createdAt: -1 });
    return allMembers;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => ProfileDataResponse)
  async partnerProfileData(@Context() context) {
    let id = context.req.trustee;

    const [totalSchool, active, inactive, pending] = await Promise.all([
      this.trusteeSchoolModel.countDocuments({ trustee_id: id }),
      this.trusteeSchoolModel.countDocuments({
        trustee_id: id,
        pgMinKYC: 'MIN_KYC_APPROVED',
      }),
      this.trusteeSchoolModel.countDocuments({
        trustee_id: id,
        pgMinKYC: { $in: ['Not Initiated', 'MIN_KYC_REJECTED', null] },
      }),
      this.trusteeSchoolModel.countDocuments({
        trustee_id: id,
        pgMinKYC: 'MIN_KYC_PENDING',
      }),
    ]);

    const response = {
      totalSchool,
      kycDetails: {
        active,
        pending,
        inactive,
      },
    };

    return response;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async updateTrustee(
    @Args('name') name: string,
    @Args('email') email: string,
    @Args('phone_number') phone_number: string,
    @Args('password') password: string,
    @Context() context,
  ) {
    let id = context.req.trustee;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    if (!name || !email || !phone_number || !password) {
      throw new Error('One or more required fields are missing.');
    }
    if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\+[0-9]+)?$/.test(email)
    )
      throw new Error('Invalid Email!');
    if (!/^\d{10}$/.test(phone_number))
      throw new Error('Invalid phone number!');

    const trustee = await this.trusteeModel.findById(context.req.trustee);
    if (!trustee) {
      throw new NotFoundException('User Not found');
    }
    const response = await this.trusteeService.updatePartnerDetails(
      id,
      name,
      email,
      phone_number,
      password,
    );
    return response.message;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async updateProfileDetails(
    @Args('name') name: string,
    @Args('brand_name') brand_name: string,
    @Context() context,
  ) {
    let id = context.req.trustee;
    const role = context.req.role;
    const trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      throw new NotFoundException('User Not found');
    }
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    if (!name || !brand_name) {
      throw new Error('One or more required fields are missing.');
    }
    trustee.name = name;
    trustee.brand_name = brand_name;
    await trustee.save();
    return `User updated successfully`;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async updateTrusteeMail(
    @Args('email') email: string,
    @Args('otp') otp: string,
    @Context() context,
  ) {
    let id = context.req.trustee;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    if (!email) {
      throw new Error('One or more required fields are missing.');
    }
    if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\+[0-9]+)?$/.test(email)
    )
      throw new Error('Invalid Email!');

    const trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      throw new NotFoundException('User Not found');
    }
    const oldEmail = trustee.email_id;
    const verify = await this.trusteeService.validateUpdateMailOtp(
      otp,
      oldEmail,
    );
    if (!verify) {
      throw new Error('Invalid OTP ');
    }

    trustee.email_id = email;
    await trustee.save();

    return `Email  updated successfully`;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async updateTrusteePhoneNumber(
    @Args('phone_number') phone_number: string,
    @Args('otp') otp: string,
    @Context() context,
  ) {
    let id = context.req.trustee;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    if (!phone_number) {
      throw new Error('One or more required fields are missing.');
    }
    if (!/^\d{10}$/.test(phone_number))
      throw new Error('Invalid phone number!');
    const trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      throw new NotFoundException('User Not found');
    }

    const verify = await this.trusteeService.validatePhoneNumberOtp(
      otp,
      trustee.email_id,
    );

    if (!verify) {
      throw new Error('Invalid OTP ');
    }

    trustee.phone_number = phone_number;
    await trustee.save();

    return `Phone Number updated successfully`;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async updateMemberDetails(
    @Args('name') name: string,
    @Args('user_id') user_id: string,
    @Args('email') email: string,
    @Args('phone_number') phone_number: string,
    @Context() context,
  ) {
    const id = context.req.trustee;

    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      throw new NotFoundException('User Not Found');
    }
    if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\+[0-9]+)?$/.test(email)
    )
      throw new Error('Invalid Email!');
    if (!/^\d{10}$/.test(phone_number))
      throw new Error('Invalid phone number!');
    const member = await this.trusteeMemberModel.findById(user_id);
    //if another trustee try update member of anothers one
    if (!member) {
      throw new NotFoundException('Member Not Found');
    }
    if (member.trustee_id != id.toString()) {
      throw new UnauthorizedException(
        'You are not Authorized to update this user',
      );
    }
    const response = await this.trusteeService.updateMemberDetails(
      member._id,
      name,
      email,
      phone_number,
    );
    return response.message;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async updateAccessLevel(
    @Args('user_id') user_id: string,
    @Args('access') access: string,
    @Context() context,
  ) {
    const id = context.req.trustee;

    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      throw new NotFoundException('User Not Found');
    }
    const member = await this.trusteeMemberModel.findById(user_id);
    //if another trustee try update member of anothers one
    if (!member) {
      throw new NotFoundException('Member Not Found');
    }
    if (member.trustee_id != id.toString()) {
      throw new UnauthorizedException(
        'You are not Authorized to update this user',
      );
    }
    if (!['admin', 'management'].includes(access)) {
      throw new Error('Invalid access level provided.');
    }

    member.access = access;
    await member.save();

    return 'Access Level updated';
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async verifyPasswordOtp(
    @Args('otp') otp: string,
    @Args('password') password: string,
    @Context() context,
  ) {
    const id = context.req.trustee;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      throw new NotFoundException('Trustee Not Found');
    }
    const email = trustee.email_id;
    const verify = await this.trusteeService.validatePasswordOtp(otp, email);
    if (!verify) {
      throw new Error('Invalid OTP ');
    }
    trustee.password_hash = password;
    await trustee.save();
    return 'Password reset Successfully';
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async deleteMember(@Args('user_id') user_id: string, @Context() context) {
    const id = context.req.trustee;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const trustee = await this.trusteeModel.findById(id);
    const member = await this.trusteeMemberModel.findById(user_id);
    if (!member) {
      throw new NotFoundException('member not found');
    }
    if (!trustee) {
      throw new NotFoundException('Trustee Not Found');
    }
    await this.trusteeMemberModel.findByIdAndDelete(user_id);
    return `${member.name} deleted Successfully`;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => Boolean)
  async sendOtp(@Args('type') type: string, @Context() context) {
    const id = context.req.trustee;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      throw new NotFoundException('Trustee Not Found');
    }

    const email = trustee.email_id;
    if (type === 'reset') {
      const mail = await this.trusteeService.sentPasswordOtpMail(email);
      return mail;
    } else if (type == 'api') {
      const mail = await this.trusteeService.sentApiOtpMail(email);
      return mail;
    } else if (type == 'email') {
      const mail = await this.trusteeService.sentUpdateOtpMail(email);
      return mail;
    } else if (type == 'phone') {
      const mail = await this.trusteeService.sentUpdateNumberOtp(email);
      return mail;
    } else if (type == 'delete') {
      const mail = await this.trusteeService.sentDeleteOtp(email);
      return mail;
    } else {
      return false;
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async createMdrRequest(
    @Args('school_id', { type: () => [String] }) school_id: string[],
    @Args('platform_charge', { type: () => [PlatformChargesInput] })
    platform_charge: PlatformChargesInput[],
    @Args('description', { nullable: true }) description: string,
    @Context() context,
  ) {
    try {
      const trustee_id = context.req.trustee;
      const role = context.req.role;
      if (role !== 'owner' && role !== 'admin') {
        throw new UnauthorizedException(
          'You are not Authorized to perform this action',
        );
      }

      return await this.trusteeService.createMdrRequest(
        trustee_id,
        school_id,
        platform_charge,
        description,
      );
    } catch (error) {
      throw error;
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async updateMdrRequest(
    @Args('req_id', { type: () => ID }) req_id: ObjectId,
    @Args('platform_charge', { type: () => [PlatformChargesInput] })
    platform_charge: PlatformChargesInput[],
    @Args('description') description: string,
    @Context() context,
  ): Promise<String> {
    const trustee_id = context.req.trustee;
    return await this.trusteeService.updateMdrRequest(
      req_id,
      platform_charge,
      description,
      trustee_id,
    );
  }

  @UseGuards(TrusteeGuard)
  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async tooglePaymentMode(
    @Args('mode') mode: string,
    @Args('school_id') school_id: string,
  ) {
    const validModes = [
      'wallet',
      'cardless',
      'netbanking',
      'pay_later',
      'upi',
      'card',
    ];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid payment mode: ${mode}.`);
    }
    return await this.trusteeService.toogleDisable(mode, school_id);
  }

  @UseGuards(TrusteeGuard)
  @Query(() => BaseMdr)
  async getTrusteeBaseRates(@Context() context) {
    const trustee_id = context.req.trustee;
    const trusteeBaseRates =
      await this.trusteeService.getTrusteeBaseMdr(trustee_id);
    return trusteeBaseRates;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => [SchoolMdr])
  async getSchoolMdr(@Context() context) {
    try {
      const trustee_id = context.req.trustee;

      const trustee = await this.trusteeModel.findById(trustee_id);
      const schools = await this.trusteeSchoolModel.find({
        trustee_id: trustee_id,
      });
      let schoolMdrs = [];

      if (schools) {
        const school_ids = schools.map((school) => school.school_id);
        school_ids.map(async (school) => {
          schoolMdrs.push(
            await this.trusteeService.getSchoolMdr(school.toString()),
          );
        });
      }
      return schoolMdrs;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  //get school info with base rates and final rates
  @UseGuards(TrusteeGuard)
  @Query(() => SchoolMdrInfo)
  async getSchoolMdrInfo(
    @Args('school_id') school_id: string,
    @Context() context,
  ) {
    const trustee_id = context.req.trustee;
    let school: SchoolMdrInfo = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    const mdrInfo = await this.trusteeService.getSchoolMdrInfo(
      school_id,
      trustee_id,
    );
    school.platform_charges = mdrInfo.info;
    const date = new Date(mdrInfo.updated_at);
    school.requestUpdatedAt = date;

    return school;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => [TrusteeMDRResponse])
  async getTrusteeMDRRequest(@Context() context) {
    const trustee_id = context.req.trustee;
    return await this.trusteeService.getTrusteeMdrRequest(trustee_id);
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async cancelRequest(
    @Args('req_id', { type: () => ID }) req_id: ObjectId,
    @Context() context,
  ): Promise<string> {
    const trustee = context.req.trustee;
    const mdrRequest = await this.trusteeService.cancelMdrRequest(
      trustee,
      req_id,
    );
    return mdrRequest;
  }
}

@ObjectType()
class KycDetails {
  @Field()
  active: number;

  @Field()
  pending: number;

  @Field()
  inactive: number;
}

@ObjectType()
class ProfileDataResponse {
  @Field()
  totalSchool: number;
  @Field(() => KycDetails)
  kycDetails: KycDetails;
}
@ObjectType()
class MemberesResponse {
  @Field(() => String)
  _id: string;

  @Field(() => String)
  trustee_id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  phone_number: string;

  @Field(() => String)
  access: string;
}

// Define a type for the AuthResponse
@ObjectType()
class AuthResponse {
  @Field(() => String)
  token: string;
}

@ObjectType()
class resetPassResponse {
  @Field()
  msg: string;
}
@ObjectType()
class verifyRes {
  @Field()
  active: boolean;
}

// Define a type for school token response
@ObjectType()
class User {
  @Field()
  _id: string;
  @Field()
  name: string;
  @Field()
  phone_number: string;
  @Field()
  email_id: string;
  @Field()
  access: string;
  @Field()
  school_id: string;
}

@ObjectType()
class SchoolTokenResponse {
  @Field()
  token: string;

  @Field(() => User)
  user: User;
}

// Define a type for the User
@ObjectType()
class TrusteeUser {
  @Field()
  _id: string;
  @Field()
  name: string;
  @Field()
  email_id: string;
  @Field({ nullable: true })
  apiKey: string;
  @Field({ nullable: true })
  role: string;
  @Field({ nullable: true })
  phone_number: string;
  @Field({ nullable: true })
  trustee_id: string;
  @Field({ nullable: true })
  brand_name: string;
  @Field({ nullable: true })
  base_mdr: BaseMdr;
}

@ObjectType()
class pg_key {
  @Field()
  pg_key: string;
}

@ObjectType()
class ApiKey {
  @Field()
  key: string;
}

@ObjectType()
class School {
  @Field()
  school_name: string;

  @Field()
  school_id: string;

  @Field(() => String, { nullable: true })
  pg_key: string;

  @Field(() => String, { nullable: true })
  email: string;

  @Field(() => String, { nullable: true })
  merchantStatus: string;

  @Field(() => [String], { nullable: true })
  disabled_modes: [string];

  @Field(() => [PlatformCharge], { nullable: true })
  platform_charges: [PlatformCharge];
}

@ObjectType()
export class SchoolMdrInfo {
  @Field()
  school_name: string;

  @Field()
  school_id: string;

  @Field(() => String, { nullable: true })
  pg_key: string;

  @Field(() => String, { nullable: true })
  email: string;

  @Field(() => String, { nullable: true })
  merchantStatus: string;

  @Field(() => [String], { nullable: true })
  disabled_modes: [string];

  @Field(() => [mergeMdrResponse], { nullable: true })
  platform_charges: [mergeMdrResponse];

  @Field(() => Date, { nullable: true })
  requestUpdatedAt: Date;
}

@ObjectType()
class getSchool {
  @Field(() => [School])
  schools: [School];
  @Field({ nullable: true })
  total_pages: number;
  @Field({ nullable: true })
  page: number;
}

@ObjectType()
class TransactionReport {
  @Field({ nullable: true })
  collect_id: string;
  @Field({ nullable: true })
  updatedAt: string;
  @Field({ nullable: true })
  createdAt: string;
  @Field({ nullable: true })
  order_amount: number;
  @Field({ nullable: true })
  transaction_amount: number;
  @Field({ nullable: true })
  payment_method: string;
  @Field({ nullable: true })
  school_name: string;
  @Field({ nullable: true })
  school_id: string;
  @Field({ nullable: true })
  status: string;
}

@ObjectType()
class createSchoolResponse {
  @Field()
  admin_id: string;
  @Field()
  school_id: string;
  @Field()
  school_name: string;
}

@InputType()
export class SchoolInputBulk {
  @Field()
  admin_name: string;
  @Field()
  email: string;
  @Field()
  phone_number: string;
  @Field()
  school_name: string;
}

@ObjectType()
class TokenResponse {
  @Field()
  token: string;
}

enum charge_type {
  FLAT = 'FLAT',
  PERCENT = 'PERCENT',
}

@InputType()
class RangeInput {
  @Field(() => Number, { nullable: true })
  upto: number;

  @Field(() => String)
  charge_type: charge_type;

  @Field(() => Number)
  charge: number;
}

@InputType()
class PlatformChargesInput {
  @Field(() => String)
  platform_type: string;

  @Field(() => String)
  payment_mode: string;

  @Field(() => [RangeInput])
  range_charge: RangeInput[];
}

@ObjectType()
class commisonRange {
  @Field(() => Number, { nullable: true })
  upto: number;

  @Field(() => String, { nullable: true })
  charge_type: charge_type;

  @Field(() => Number, { nullable: true })
  base_charge: number;

  @Field(() => Number, { nullable: true })
  commission: number;

  @Field(() => Number, { nullable: true })
  charge: number;
}

@ObjectType()
class mergeMdrResponse {
  @Field({ nullable: true })
  platform_type: string;
  @Field({ nullable: true })
  payment_mode: string;

  @Field(() => [commisonRange], { nullable: true })
  range_charge: commisonRange[];
}

@ObjectType()
class TrusteeMDRResponse {
  @Field(() => ID)
  _id: ObjectId;
  // @Field({ nullable: true })
  // trustee_id:string
  // @Field({ nullable: true })
  // createdAt:string
  @Field(() => [mergeMdrResponse], { nullable: true })
  platform_charges: mergeMdrResponse[];

  @Field(() => [String], { nullable: true })
  school_id: [string];

  @Field(() => ID)
  trustee_id: ObjectId;

  @Field({ nullable: true })
  status: string;

  @Field({ nullable: true })
  comment: string;

  @Field({ nullable: true })
  description: string;

  @Field({ nullable: true })
  updatedAt: string;

  @Field({ nullable: true })
  createdAt: string;
}
