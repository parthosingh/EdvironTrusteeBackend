/* eslint-disable @typescript-eslint/ban-types */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  Args,
  Context,
  Field,
  Mutation,
  ObjectType,
  Query,
  Int,
  Resolver,
  InputType,
} from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import { SettlementReport } from '../schema/settlement.schema';
import { MerchantGuard } from './merchant.guard';
import axios from 'axios';
import { MerchantService } from './merchant.service';
import jwt from 'jsonwebtoken';
import {
  AuthResponse,
  batchTransactionsReport,
  Dispute_Actions,
  DisputeResponse,
  DisputesRes,
  PosMachineQuery,
  resetPassResponse,
  SettlementsTransactionsPaginatedResponse,
  TransactionReport,
  TransactionReportResponsePaginated,
  UploadedFile,
  VendorInfoInput,
  VendorSingleTransaction,
  VendorsPaginationResponse,
  VendorsSettlementReportPaginatedResponse,
  VendorsTransactionPaginatedResponse,
  verifyRes,
} from '../trustee/trustee.resolver';
import { MerchantMember } from '../schema/merchant.member.schema';
import { Access } from '../schema/merchant.member.schema';
import { Trustee } from '../schema/trustee.schema';
import { TransactionInfo } from '../schema/transaction.info.schema';
import { TrusteeService } from '../trustee/trustee.service';
import {
  refund_status,
  RefundRequest,
  SplitRefundsDetails,
} from '../schema/refund.schema';
import { VendorsSettlement } from '../schema/vendor.settlements.schema';
import { EmailService } from '../email/email.service';
import { DisputeGateways, Disputes } from '../schema/disputes.schema';
import { AwsS3Service } from '../aws.s3/aws.s3.service';
import { getDisputeReceivedEmailForTeam } from 'src/email/templates/dipute.template';
import { PosMachine } from 'src/schema/pos.machine.schema';
import { BusinessAlarmService } from 'src/business-alarm/business-alarm.service';
import { ErrorLogs } from 'src/schema/error.log.schema';

@InputType()
export class SplitRefundDetails {
  @Field()
  vendor_id: string;

  @Field()
  amount: number;
}

@Resolver('Merchant')
export class MerchantResolver {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>,
    private merchantService: MerchantService,
    @InjectModel(MerchantMember.name)
    private merchantMemberModel: mongoose.Model<MerchantMember>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
    private readonly trusteeService: TrusteeService,
    @InjectModel(VendorsSettlement.name)
    private vendorsSettlementModel: mongoose.Model<VendorsSettlement>,
    @InjectModel(Disputes.name)
    private DisputesModel: mongoose.Model<Disputes>,
    private emailService: EmailService,
    private readonly awsS3Service: AwsS3Service,
    @InjectModel(PosMachine.name)
    private posMachineModel: mongoose.Model<PosMachine>,
    private readonly businessServices: BusinessAlarmService,
    @InjectModel(ErrorLogs.name)
    private ErrorLogsModel: mongoose.Model<ErrorLogs>,
  ) { }
  // private emailService: EmailService,
  // ) { }

  @Mutation(() => Boolean)
  async merchantLogin(
    @Args('email') email_id: string,
    @Args('password') password_hash: string,
  ): Promise<Boolean> {
    try {
      return await this.merchantService.loginAndGenerateToken(
        email_id,
        password_hash,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new Error('Invalid email or password');
      } else {
        throw new Error('An error occurred during login');
      }
    }
  }

  @Mutation(() => String)
  async loginMerchant(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<string> {
    try {
      return await this.merchantService.loginNonOtpMerchant(email, password);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @Mutation(() => String)
  async validateMerchantLoginOtp(
    @Args('otp') otp: string,
    @Args('email') email: string,
  ): Promise<string> {
    try {
      return await this.merchantService.validateLoginOtp(otp, email);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @Query(() => MerchantUser)
  async getMerchantQuery(@Context() context): Promise<MerchantUser> {
    try {
      const token = context.req.headers.authorization.split(' ')[1]; // Extract the token from the authorization header
      const userMerchant = await this.merchantService.validateMerchant(token);
      console.log(userMerchant, 'merchant');
      const school_id = userMerchant.school_id.toString();
      const tokenAuth = this.jwtService.sign(
        { school_id },
        { secret: process.env.JWT_SECRET_FOR_INTRANET! },
      );

      let bankDetails = {
        account_holder_name:
          userMerchant?.bank_details?.account_holder_name || null,
        account_number: userMerchant?.bank_details?.account_number || null,
        ifsc_code: userMerchant?.bank_details?.ifsc_code || null,
      };
      if (
        bankDetails.account_holder_name === null &&
        bankDetails.account_number === null
      ) {
        try {
          const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `${process.env.MAIN_BACKEND_URL}/api/trustee/get-school-kyc?school_id=${school_id}&token=${tokenAuth}`,
            headers: {
              accept: 'application/json',
            },
          };
          const response = await axios.request(config);
          bankDetails = {
            account_holder_name:
              response?.data?.bankDetails?.account_holder_name || null,
            account_number: response?.data?.bankDetails?.account_number || null,
            ifsc_code: response?.data?.bankDetails?.ifsc_code || null,
          };
        } catch (error) {
          bankDetails = {
            account_holder_name: null,
            account_number: null,
            ifsc_code: null,
          };
        }
      }

      // Map the trustee data to the User type
      const user: MerchantUser = {
        _id: userMerchant.id,
        name: userMerchant.name,
        email_id: userMerchant.email,
        apiKey: userMerchant.apiKey,
        role: userMerchant.role,
        phone_number: userMerchant.phone_number,
        user: userMerchant.user,
        trustee_id: userMerchant.trustee_id,
        trustee_logo: userMerchant.trustee_logo,
        school_id: userMerchant.school_id,
        school_logo: userMerchant.school_logo,
        bank_details: bankDetails,
      };
      console.log(user, 'userrr');

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  @Mutation(() => verifyRes)
  async sendResetPassLinkMerchant(@Args('email') email: string) {
    const merchant = await this.trusteeSchoolModel.findOne({ email: email });
    if (!merchant) {
      const member = await this.merchantMemberModel.findOne({ email });
      if (!member) {
        throw new Error('User not found');
      }
    }
    await this.merchantService.sendResetPassMail(email);
    return { active: true };
  }

  @Mutation(() => resetPassResponse)
  async resetMerchantPass(
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    await this.merchantService.resetPassword(email, password);
    return { msg: `Password Change` };
  }

  @Query(() => verifyRes)
  async verifyMerchantResetPassToken(@Args('token') token: string) {
    const res = await this.merchantService.verifyresetToken(token);
    return { active: res };
  }

  @Query(() => [SettlementReport])
  @UseGuards(MerchantGuard)
  async getMerchantSettlementReports(@Context() context) {
    const merchant = await this.trusteeSchoolModel.findById(
      context.req.merchant,
    );

    if (!merchant) throw new NotFoundException('User not found');
    let settlementReports = [];

    settlementReports = await this.settlementReportModel
      .find({ schoolId: merchant.school_id })
      .sort({ settlementDate: -1 });
    return settlementReports;
  }

  @Query(() => TransactionReportResponsePaginated)
  @UseGuards(MerchantGuard)
  async getMerchantTransactionReport(
    @Context() context,
    @Args('startDate', { nullable: true }) startDate?: string,
    @Args('endDate', { nullable: true }) endDate?: string,
    @Args('status', { nullable: true, defaultValue: null }) status?: string,
    @Args('page', { nullable: true, defaultValue: '1' }) page?: string,
    @Args('limit', { nullable: true, defaultValue: '500' }) limit?: string,
    @Args('isCustomSearch', { nullable: true, defaultValue: null })
    isCustomSearch?: boolean,
    @Args('isQRCode', { nullable: true, defaultValue: null })
    isQRCode?: boolean,
    @Args('searchFilter', { nullable: true, defaultValue: null })
    searchFilter?: string,
    @Args('searchParams', { nullable: true, defaultValue: null })
    searchParams?: string,
    @Args('payment_modes', {
      type: () => [String],
      nullable: true,
      defaultValue: null,
    })
    payment_modes?: string[],
    @Args('gateway', {
      type: () => [String],
      nullable: true,
      defaultValue: null,
    })
    gateway?: string[],
  ) {
    try {
      const merchant = await this.trusteeSchoolModel.findById(
        context.req.merchant,
      );

      if (!merchant) throw new NotFoundException('User not found');
      const school_id = merchant.school_id.toString();
      console.log(school_id);
      if (searchFilter === 'order_id') {
        const checkId = mongoose.Types.ObjectId.isValid(searchParams);
        if (!checkId) throw new BadRequestException('Invalid order id');
      }
      let id = context.req.trustee;
      console.time('mapping merchant transaction');
      const merchants = await this.trusteeSchoolModel.find({
        trustee_id: id,
      });
      let transactionReport = [];

      const now = new Date();

      // First day of the month
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstLocalDate = firstDay.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
      });
      const firstLocalDateObject = new Date(firstLocalDate);
      const firstYear = firstLocalDateObject.getFullYear();
      const firstMonth = String(firstLocalDateObject.getMonth() + 1).padStart(
        2,
        '0',
      ); // Month is zero-based
      const firstDayOfMonth = String(firstLocalDateObject.getDate()).padStart(
        2,
        '0',
      ); // Add leading zero if needed
      const formattedFirstDay = `${firstYear}-${firstMonth}-${firstDayOfMonth}`;
      console.log(formattedFirstDay, 'First Day');

      // Last day of the month
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day is 0th of next month
      const lastLocalDate = lastDay.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
      });
      const lastLocalDateObject = new Date(lastLocalDate);
      const lastYear = lastLocalDateObject.getFullYear();
      const lastMonth = String(lastLocalDateObject.getMonth() + 1).padStart(
        2,
        '0',
      ); // Month is zero-based
      const lastDayOfMonth = String(lastLocalDateObject.getDate()).padStart(
        2,
        '0',
      ); // Add leading zero if needed
      const formattedLastDay = `${lastYear}-${lastMonth}-${lastDayOfMonth}`;

      const first = startDate || formattedFirstDay;
      const last = endDate || formattedLastDay;

      if (!endDate) {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate = lastDay.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
      }

      // const merchant_ids_to_merchant_map = {};
      // merchants.map((merchant: any) => {
      //   merchant_ids_to_merchant_map[merchant.school_id] = merchant;
      // });
      console.timeEnd('mapping merchant transaction');
      let token = this.jwtService.sign(
        { trustee_id: merchant.trustee_id.toString() },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report/?limit=${limit}&startDate=${first}&endDate=${last}&page=${page}&status=${status}&school_id=${school_id}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: merchant.trustee_id.toString(),
          token,
          searchParams,
          isCustomSearch,
          seachFilter: searchFilter,
          payment_modes,
          isQRCode,
          gateway,
        },
      };

      console.time('fetching all transaction');
      console.log(config, 'opopo');

      const response = await axios.request(config);

      let transactionLimit = Number(limit) || 100;
      let transactionPage = Number(page) || 1;
      let total_pages = response.data.totalTransactions / transactionLimit;

      console.timeEnd('fetching all transaction');

      console.time('mapping');

      transactionReport = await Promise.all(
        response.data.transactions.map(async (item: any) => {
          let remark = null;

          return {
            ...item,
            merchant_name: merchant.school_name,
            student_id:
              JSON.parse(item?.additional_data).student_details?.student_id ||
              '',
            student_name:
              JSON.parse(item?.additional_data).student_details?.student_name ||
              '',
            student_email:
              JSON.parse(item?.additional_data).student_details
                ?.student_email || '',
            student_phone:
              JSON.parse(item?.additional_data).student_details
                ?.student_phone_no || '',
            receipt:
              JSON.parse(item?.additional_data).student_details?.receipt || '',
            additional_data:
              JSON.parse(item?.additional_data).additional_fields || '',
            currency: 'INR',
            school_id: item.merchant_id,
            school_name: merchant.school_name,
            remarks: remark,
            // commission: commissionAmount,
            custom_order_id: item?.custom_order_id || null,
          };
        }),
      );

      console.timeEnd('mapping');

      console.time('sorting');
      transactionReport.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      console.timeEnd('sorting');
      console.log(response.data.totalTransactions);
      // return transactionReport
      if (isCustomSearch) {
        total_pages = 1;
      }
      return {
        transactionReport: transactionReport,
        total_pages,
        current_page: transactionPage,
      };
    } catch (error) {
      // console.log(error,'response');
      if (error?.response?.data?.message) {
        throw new BadRequestException(error?.response?.data?.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Query(() => [TransactionReport])
  @UseGuards(MerchantGuard)
  async getMerchantSingleTransactionReport(
    @Context() context,
    @Args('collect_id') collect_id: string,
  ) {
    try {
      const school_id_context = context.req.merchant;
      const school = await this.trusteeSchoolModel.findById(school_id_context);
      if (!school) throw new NotFoundException('School not found.');
      const school_id = school.school_id;
      const trustee_id = school.trustee_id;
      const token = this.jwtService.sign(
        {
          trustee_id: trustee_id.toString(),
          collect_id,
          school_id: school_id.toString(),
        },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );

      const data = await this.trusteeService.getSingleTransaction(
        trustee_id.toString(),
        collect_id,
        token,
      );

      return data.map((item: any) => {
        const remark = null;
        const parsedData = item?.additional_data
          ? JSON.parse(item?.additional_data)
          : {};
        return {
          ...item,
          student_id: parsedData.student_details?.student_id || '',
          student_name: parsedData.student_details?.student_name || '',
          student_email: parsedData.student_details?.student_email || '',
          student_phone: parsedData.student_details?.student_phone_no || '',
          receipt: parsedData.student_details?.receipt || '',
          additional_data: parsedData.additional_fields || '',
          currency: 'INR',
          school_id: item?.school_id,
          school_name: school?.school_name,
          remarks: remark,
          custom_order_id: item?.custom_order_id || null,
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Something went wrong',
      );
    }
  }

  @UseGuards(MerchantGuard)
  @Query(() => [MerchantMemberesResponse])
  async getAllMerchantMembers(@Context() context) {
    let merchant = await this.trusteeSchoolModel.findById(context.req.merchant);

    const allMembers = await this.merchantMemberModel
      .find({ merchant_id: merchant._id })
      .select('-password_hash')
      .sort({ createdAt: -1 });
    return allMembers;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async updateMerchantAccessLevel(
    @Args('user_id') user_id: string,
    @Args('access') access: string,
    @Context() context,
  ) {
    const id = context.req.merchant;

    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const merchant = await this.trusteeSchoolModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('User Not Found');
    }
    const member = await this.merchantMemberModel.findById(user_id);
    //if another merchant try update member of anothers one
    if (!member) {
      throw new NotFoundException('Member Not Found');
    }
    if (member.merchant_id != id.toString()) {
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

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async createMerchantMember(
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

    // const trustee = await this.trusteeModel.findOne({
    //   $or: [{ email_id: email }, { phone_number: phone_number }]
    // });
    const merchant = await this.trusteeSchoolModel.findOne({ email: email });
    const member = await this.merchantMemberModel.findOne({
      $or: [{ email }
        // , { phone_number }
      ],
    });
    // if (trustee) {
    //   throw new ConflictException('This email or phone number is already registered for a partner account. Please use a different email or phone number.')
    // }
    if (member || merchant) {
      throw new ConflictException('Email is Taken');
    }

    await new this.merchantMemberModel({
      merchant_id: context.req.merchant,
      name,
      email,
      phone_number,
      access,
      password_hash: password,
    }).save();

    return `Member created Successfully`;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async deleteMerchantMember(
    @Args('user_id') user_id: string,
    @Context() context,
  ) {
    const id = context.req.merchant;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const merchant = await this.trusteeSchoolModel.findById(id);
    const member = await this.merchantMemberModel.findById(user_id);
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (merchant._id.toString() !== member.merchant_id.toString()) {
      throw new NotFoundException('Member not found for Merchant');
    }
    await this.merchantMemberModel.findByIdAndDelete(user_id);
    return `${member.name} deleted Successfully`;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => Boolean)
  async sendMerchantResetPassOtp(@Context() context) {
    const id = context.req.merchant;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const merchant = await this.trusteeSchoolModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant Not Found');
    }
    const email = merchant.email;
    const mail = await this.merchantService.sendResetPassOtp(email);

    if (mail) return true;
    else return false;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async verifyMerchantPasswordOtp(
    @Args('otp') otp: string,
    @Args('password') password: string,
    @Context() context,
  ) {
    const id = context.req.merchant;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const merchant = await this.trusteeSchoolModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('merchant Not Found');
    }
    const email = merchant.email;
    const verify = await this.merchantService.validatePasswordOtp(otp, email);
    if (!verify) {
      throw new Error('Invalid OTP ');
    }
    merchant.password_hash = password;
    await merchant.save();
    return 'Password reset Successfully';
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async updateMerchantMemberDetails(
    @Args('name') name: string,
    @Args('user_id') user_id: string,
    @Args('email') email: string,
    @Args('phone_number') phone_number: string,
    @Context() context,
  ) {
    const id = context.req.merchant;

    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const merchant = await this.trusteeSchoolModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('User Not Found');
    }
    if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\+[0-9]+)?$/.test(email)
    )
      throw new Error('Invalid Email!');
    if (!/^\d{10}$/.test(phone_number))
      throw new Error('Invalid phone number!');
    const member = await this.merchantMemberModel.findById(user_id);
    //if another merchant try update member of anothers one
    if (!member) {
      throw new NotFoundException('Member Not Found');
    }
    if (member.merchant_id != id.toString()) {
      throw new UnauthorizedException(
        'You are not Authorized to update this user',
      );
    }
    const response = await this.merchantService.updateMemberDetails(
      member._id,
      name,
      email,
      phone_number,
    );
    return response.message;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async updateMerchantMail(
    @Args('email') email: string,
    @Args('otp') otp: string,
    @Context() context,
  ) {
    let id = context.req.merchant;

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

    const existingSchool = await this.trusteeSchoolModel.findOne({ email });
    if (existingSchool) throw new ConflictException('Email already in use');

    const merchant = await this.trusteeSchoolModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('User Not found');
    }
    const oldEmail = merchant.email;
    const verify = await this.merchantService.validateUpdateMailOtp(
      otp,
      oldEmail,
    );
    if (!verify) {
      throw new Error('Invalid OTP ');
    }

    merchant.email = email;
    await merchant.save();

    return `Email  updated successfully`;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async updateMerchantPhoneNumber(
    @Args('phone_number') phone_number: string,
    @Args('otp') otp: string,
    @Context() context,
  ) {
    let id = context.req.merchant;

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

    const merchant = await this.trusteeSchoolModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('User Not found');
    }
    const email = merchant?.email;
    if (!email) throw new NotFoundException('Set Email First to Send OTP');
    const verify = await this.merchantService.validateUpdateMailOtp(otp, email);
    if (!verify) {
      throw new Error('Invalid OTP ');
    }

    merchant.phone_number = phone_number;
    await merchant.save();

    return `Contact info updated successfully`;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => Boolean)
  async sendMerchantEditOtp(@Context() context) {
    const id = context.req.merchant;
    const role = context.req.role;
    if (role !== 'owner') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    const merchant = await this.trusteeSchoolModel.findById(id);
    if (!merchant) {
      throw new NotFoundException('Merchant Not Found');
    }
    const email = merchant.email;
    const mail = await this.merchantService.sendEditOtp(email);

    if (mail) return true;
    else return false;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async initiateRefund(
    @Args('order_id') order_id: string,
    @Args('refund_amount') refund_amount: number,
    @Args('refund_note') refund_note: string,
    @Context() context,
  ) {
    let merchant = await this.trusteeSchoolModel.findById(context.req.merchant);
    if (!merchant) throw new NotFoundException('Merchant not found');
    let client_id = merchant.client_id;

    const data = {
      client_id,
      order_id,
      refund_amount,
      refund_note,
    };
    try {
      const response = await axios.post(
        `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/initiate-refund`,
        data,
      );
      return `Refund Initiated`;
    } catch (error) {
      console.error('Error:', error.response.data);
      throw error;
    }
  }

  @UseGuards(MerchantGuard)
  @Query(() => [MerchantRefundResponse])
  async merchantRefunds(@Context() context) {
    let merchant = await this.trusteeSchoolModel.findById(context.req.merchant);
    if (!merchant) throw new NotFoundException('Merchant not found');
    let school_id = merchant.school_id.toString();
    return await this.trusteeService.merchantsRefunds(school_id);
  }

  @UseGuards(MerchantGuard)
  @Query(() => [MerchantRefundResponse])
  async merchantOrderRefunds(@Args('order_id') order_id: string) {
    return await this.trusteeService.orderRefunds(order_id);
  }

  @UseGuards(MerchantGuard)
  @Query(() => [SettlementReport])
  async merchantTransactionUtr(
    @Args('order_id') order_id: string,
    @Context() context: any,
  ) {
    const schoolId = context.req.merchant;
    const merchant = await this.trusteeSchoolModel.findOne({
      school_id: schoolId,
    });
    if (!merchant) {
      throw Error('invalid merchant id');
    }
    try {
      const config = {
        method: 'GET',
        url: `https://api.cashfree.com/pg/orders/${order_id}/settlements`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-partner-apikey': process.env.CASHFREE_API_KEY,
          'x-partner-merchantid': merchant.client_id,
        },
      };
      const response = await axios.request(config);

      if (response.data) {
        const settlementData = {
          settlement_date: response?.data?.transfer_time || null,
          utr_number: response?.data?.transfer_utr || 'NA',
          status: 'Settled',
        };
        return settlementData;
      }
    } catch (error) {
      console.log(error.response.data);
      return {
        settlement_date: null,
        utr_number: 'NA',
        status: 'NA',
      };

      // throw new Error('Failed to fetch settlement data');
    }
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => TransactionInfo)
  async addMerchantRemarks(
    @Args('collect_id') collect_id: string,
    @Args('remark') remark: string,
    @Context() context,
  ) {
    let merchant = await this.trusteeSchoolModel.findById(context.req.merchant);

    if (!merchant) throw new NotFoundException('Merchant not found');
    const newRemark = await this.trusteeService.createRemark(
      collect_id,
      remark,
      merchant.trustee_id,
    );
    return newRemark;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async deleteMerchantRemark(@Args('collect_id') collect_id: string) {
    return await this.trusteeService.deleteRemark(collect_id);
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async initiateRefundRequest(
    @Args('order_id') order_id: string,
    @Args('refund_amount') refund_amount: number,
    @Args('order_amount') order_amount: number,
    @Args('transaction_amount') transaction_amount: number,
    @Context() context: any,
    @Args('reason', { nullable: true }) reason?: string,
  ) {
    const school_id = context.req.merchant;
    const school = await this.trusteeSchoolModel.findById(school_id);
    const checkRefundRequest = await this.refundRequestModel
      .findOne({
        order_id: new Types.ObjectId(order_id),
        isSplitRedund: { $ne: true },
      })
      .sort({ createdAt: -1 });

    if (refund_amount > order_amount) {
      throw new Error('Refund amount cannot be more than order amount');
    }

    if (checkRefundRequest?.status === refund_status.INITIATED) {
      throw new Error('Refund request already initiated for this order');
    }

    let pgConfig = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-custom-id?collect_id=${order_id}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };
    const refundRequests = await this.refundRequestModel.findOne({
      order_id: order_id,
    });
    const response = await axios.request(pgConfig);
    const custom_id = response.data;

    if (checkRefundRequest?.status === refund_status.APPROVED) {
      const totalRefunds = await this.refundRequestModel.find({
        order_id: new Types.ObjectId(order_id),
        status: refund_status.APPROVED,
      });
      let totalRefundAmount = 0;
      totalRefunds.map((refund: any) => {
        totalRefundAmount += refund.refund_amount;
      });
      console.log(totalRefundAmount, 'amount refunded');
      const refundableAmount =
        checkRefundRequest.transaction_amount - totalRefundAmount;
      console.log(refundableAmount, 'amount can be refunded');

      if (refund_amount > refundableAmount) {
        throw new Error(
          'Refund amount cannot be more than remaining refundable amount ' +
          refundableAmount +
          'Rs',
        );
      }
    }

    const token = this.jwtService.sign(
      { order_id },
      { secret: process.env.JWT_SECRET_FOR_TRUSTEE },
    );
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/gatewat-name?token=${token}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };

    const res = await axios.request(config);
    let gateway = res.data;
    if (gateway === 'EDVIRON_PG') {
      gateway = 'EDVIRON_CASHFREE';
    }

    const refund = await new this.refundRequestModel({
      trustee_id: school.trustee_id,
      school_id: school_id,
      order_id: new Types.ObjectId(order_id),
      status: refund_status.INITIATED,
      refund_amount,
      order_amount,
      transaction_amount,
      gateway: gateway || null,
      custom_id: custom_id,
      reason: reason || 'NA',
    }).save();

    await this.emailService.sendRefundInitiatedAlert(
      school.school_name,
      refund._id.toString(),
      refund_amount,
    );
    if (school.isNotificationOn && school.isNotificationOn.for_refund) {
      this.trusteeService.scheduleRefundNotificationEmail(
        school,
        refund,
        refund.status,
        refund.order_id.toString(),
        refund.trustee_id.toString(),
      );
    }
    return `Refund Request Created`;
  }
  @UseGuards(MerchantGuard)
  @Query(() => PaginatedRefundRequestResponse)
  async getRefundRequests(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
    @Context() context: any,
    @Args('startDate', { nullable: true }) startDate?: string,
    @Args('endDate', { nullable: true }) endDate?: string,
    @Args('status', { nullable: true, defaultValue: null }) status?: string,
    @Args('isCustomSearch', { nullable: true, defaultValue: null })
    isCustomSearch?: boolean,
  ) {
    const skip = (page - 1) * limit;

    const match: any = {
      school_id: context.req.merchant,
    };

    if (isCustomSearch) {
      if (status) match.status = status;
      if (startDate || endDate) {
        const createdAt: any = {};
        if (startDate) createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
        if (endDate) createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
        match.createdAt = createdAt;
      }
    }

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 as -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const countPipeline = [{ $match: match }, { $count: 'total' }];

    const [refundRequests, totalCountResult] = await Promise.all([
      this.refundRequestModel.aggregate(pipeline as mongoose.PipelineStage[]),
      this.refundRequestModel.aggregate(
        countPipeline as mongoose.PipelineStage[],
      ),
    ]);

    const totalCount = totalCountResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      refundRequests,
      totalPages,
      page,
      totalCountResult: totalCount,
    };
  }

  @UseGuards(MerchantGuard)
  @Query(() => [MerchantRefundRequestRes])
  async getRefundRequestMerchant(@Args('order_id') order_id: string) {
    const refundRequests =
      await this.merchantService.getRefundRequest(order_id);
    console.log(refundRequests);

    if (!refundRequests) {
      return {
        trustee_id: null,
        school_id: null,
        order_id: null,
        status: null,
      };
    }
    return refundRequests;
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => RefundRequest)
  async deleteRefundRequest(@Args('refund_id') refund_id: string) {
    const refundRequests = await this.refundRequestModel
      .findById(refund_id)
      .sort({ createdAt: -1 });
    if (!refundRequests) {
      throw new NotFoundException(`No Active Not Found`);
    }
    if (refundRequests.status === refund_status.APPROVED) {
      throw new Error(`Refund request already approved for this order`);
    }

    refundRequests.status = refund_status.DELETED;
    await refundRequests.save();
    return refundRequests;
  }

  @Mutation(() => String)
  async getCustomId(@Args('trustee_id') trustee_id: string) {
    return this.merchantService.updateRefundRequest(trustee_id);
  }

  @UseGuards(MerchantGuard)
  @Query(() => VendorsPaginationResponse)
  async getMerchantVendor(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
    @Args('startDate', { type: () => String, nullable: true })
    startDate?: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
    @Args('vendor_id', { type: () => String, nullable: true })
    vendor_id?: string,
    @Args('custom_id', { type: () => String, nullable: true })
    custom_id?: string,
  ) {
    const school_id = context.req.merchant;
    const school = await this.trusteeSchoolModel.findById(school_id);

    const query = {
      school_id: school.school_id,
      ...(vendor_id && { vendor_id }),
      ...(startDate &&
        endDate && {
        updatedAt: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        },
      }),
    };

    console.log(query, ':query');

    return this.trusteeService.getSchoolVendors(
      school.school_id.toString(),
      page,
      limit,
      query,
    );
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async createMerchantVendor(
    @Args('vendor_info', { type: () => VendorInfoInput })
    vendor_info: VendorInfoInput,
    @Context() context: any,
    @Args('chequeBase64') chequeBase64?: string,
    @Args('chequeExtension') chequeExtension?: string,
  ): Promise<string> {
    const school_id = context.req.merchant;
    const school = await this.trusteeSchoolModel.findById(school_id);
    if (!school) throw new NotFoundException('School not found');

    const emailRegex = /^[\w-+.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const phoneRegex = /^\d{10}$/;
    const gstRegex =
      /^([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1})$/;
    const accountNumberRegex = /^\d{9,18}$/;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    if (!emailRegex.test(vendor_info.email)) {
      throw new BadRequestException('Invalid email format');
    }

    if (!phoneRegex.test(vendor_info.phone)) {
      throw new BadRequestException('Phone number must be exactly 10 digits');
    }

    if (
      vendor_info.kyc_details.gst &&
      !gstRegex.test(vendor_info.kyc_details.gst)
    ) {
      throw new BadRequestException('Invalid GST format');
    }

    if (!chequeBase64) {
      throw new BadRequestException('Cheque image is required');
    }

    if (!accountNumberRegex.test(vendor_info.bank.account_number)) {
      throw new BadRequestException(
        'Account number must be between 9 and 18 digits',
      );
    }

    if (!ifscRegex.test(vendor_info.bank.ifsc)) {
      throw new BadRequestException('Invalid IFSC code format');
    }

    const client_id = school.client_id || null;
    if (!client_id) {
      throw new BadRequestException(
        'Payment gateway is not enabled for this school yet, Kindly contact us at tarun.k@edviron.com',
      );
    }
    return await this.trusteeService.onboardVendor(
      client_id,
      school.trustee_id.toString(),
      school.school_id.toString(),
      school.school_name,
      vendor_info,
      chequeBase64,
      chequeExtension,
    );
  }

  @UseGuards(MerchantGuard)
  @Query(() => VendorsTransactionPaginatedResponse)
  async getMerchantVendorTransaction(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
    @Args('startDate', { type: () => String, nullable: true })
    startDate?: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('vendor_id', { type: () => String, nullable: true })
    vendor_id?: string,
    @Args('custom_id', { type: () => String, nullable: true })
    custom_id?: string,
    @Args('order_id', { type: () => String, nullable: true })
    order_id?: string,
    @Args('payment_modes', {
      type: () => [String],
      nullable: true,
      defaultValue: null,
    })
    payment_modes?: string[],
    @Args('gateway', {
      type: () => [String],
      nullable: true,
      defaultValue: null,
    })
    gateway?: string[],
  ) {
    try {
      const school_id = context.req.merchant;
      console.log(school_id, 'school_id');
      const school = await this.trusteeSchoolModel.findById(school_id);
      const transactions = this.trusteeService.getMerchantVendorTransactions(
        school.trustee_id.toString(),
        school.school_id.toString(),
        page,
        limit,
        status,
        vendor_id,
        startDate,
        endDate,
        custom_id,
        order_id,
        payment_modes,
        gateway,
      );
      return transactions;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(MerchantGuard)
  @Query(() => VendorsSettlementReportPaginatedResponse)
  async getMerchantVendorSettlementReport(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
    @Args('start_date', { type: () => String, nullable: true })
    start_date?: string,
    @Args('end_date', { type: () => String, nullable: true }) end_date?: string,
    @Args('utr', { type: () => String, nullable: true })
    utr?: string,
    @Args('vendor_id', { type: () => String, nullable: true })
    vendor_id?: string,
  ) {
    const schoolId = context.req.merchant;

    const school = await this.trusteeSchoolModel.findById(schoolId);
    const school_id = school.school_id;

    const query = {
      school_id,
      ...(vendor_id && { vendor_id: new Types.ObjectId(vendor_id) }),
      ...(utr && { utr: utr }),
      ...(start_date &&
        end_date && {
        settled_on: {
          $gte: new Date(start_date),
          $lte: new Date(new Date(end_date).setHours(23, 59, 59, 999)),
        },
      }),
    };

    const totalCount = await this.vendorsSettlementModel.countDocuments(query);
    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch paginated data
    const vendor_settlements = await this.vendorsSettlementModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      vendor_settlements,
      totalCount,
      totalPages,
      page,
      limit,
    };
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => String)
  async initiateSplitRefund(
    @Args('order_id') order_id: string,
    @Args('refund_amount') refund_amount: number,
    @Args('order_amount') order_amount: number,
    @Args('transaction_amount') transaction_amount: number,
    @Args('reason') reason: string,
    @Args('split_refund_details', { type: () => [SplitRefundDetails] })
    split_refund_details: SplitRefundDetails[],
    @Context() context: any,
  ) {
    const school_id = context.req.merchant;
    const school = await this.trusteeSchoolModel.findById(school_id);
    const checkRefundRequest = await this.refundRequestModel
      .findOne({
        order_id: new Types.ObjectId(order_id),
      })
      .sort({ createdAt: -1 });

    if (refund_amount > order_amount) {
      throw new Error('Refund amount cannot be more than order amount');
    }

    if (
      checkRefundRequest &&
      checkRefundRequest.split_refund_details[0]?.vendor_id ===
      split_refund_details[0].vendor_id &&
      checkRefundRequest.status === refund_status.INITIATED
    ) {
      throw new ConflictException(
        'Refund request already initiated for this vendor',
      );
    }

    let pgConfig = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-custom-id?collect_id=${order_id}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };
    const refundRequests = await this.refundRequestModel.findOne({
      order_id: order_id,
    });
    const response = await axios.request(pgConfig);
    const custom_id = response.data;

    if (checkRefundRequest?.status === refund_status.APPROVED) {
      const totalRefunds = await this.refundRequestModel.find({
        order_id: new Types.ObjectId(order_id),
        status: refund_status.APPROVED,
      });
      let totalRefundAmount = 0;
      totalRefunds.map((refund: any) => {
        totalRefundAmount += refund.refund_amount;
      });
      console.log(totalRefundAmount, 'amount refunded');
      const refundableAmount =
        checkRefundRequest.transaction_amount - totalRefundAmount;
      console.log(refundableAmount, 'amount can be refunded');

      if (refund_amount > refundableAmount) {
        throw new Error(
          'Refund amount cannot be more than remaining refundable amount ' +
          refundableAmount +
          'Rs',
        );
      }
    }

    const token = this.jwtService.sign(
      { order_id },
      { secret: process.env.JWT_SECRET_FOR_TRUSTEE },
    );
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/gatewat-name?token=${token}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };

    const res = await axios.request(config);
    let gateway = res.data;

    if (gateway === 'EDVIRON_PG') {
      gateway = 'EDVIRON_CASHFREE';
    }

    await new this.refundRequestModel({
      trustee_id: school.trustee_id,
      school_id: school_id,
      order_id: new Types.ObjectId(order_id),
      status: refund_status.INITIATED,
      refund_amount,
      order_amount,
      transaction_amount,
      gateway: gateway || null,
      custom_id: custom_id,
      isSplitRedund: true,
      split_refund_details,
      reason,
    }).save();

    return `Refund Request Created`;
  }

  @UseGuards(MerchantGuard)
  @Query(() => VendorSingleTransaction)
  async getSingleMerchantVendorTransaction(
    @Args('order_id') order_id: string,
    @Context() context: any,
  ) {
    const transactions =
      this.trusteeService.getVendonrMerchantSingleTransactions(order_id);

    return transactions;
  }

  @UseGuards(MerchantGuard)
  @Query(() => DisputesRes)
  async getMerchantDisputes(
    @Context() context: any,
    @Args('page', { type: () => Int, defaultValue: 0 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
    @Args('collect_id', { type: () => String, nullable: true })
    collect_id: string,
    @Args('custom_id', { type: () => String, nullable: true })
    custom_id: string,
    @Args('dispute_id', { type: () => String, nullable: true })
    dispute_id: string,
    @Args('startDate', { type: () => String, nullable: true })
    startDate: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string,
    @Args('dispute_status', { type: () => String, nullable: true })
    dispute_status: string,
  ) {
    try {
      const schoolId = context.req.merchant;
      const school = await this.trusteeSchoolModel.findById(schoolId);
      if (!school) throw new BadRequestException('School Not Found');

      return this.trusteeService.getDisputes(
        school.trustee_id.toString(),
        page,
        limit,
        school.school_id.toString(),
        collect_id,
        custom_id,
        dispute_id,
        startDate,
        endDate,
        dispute_status,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(MerchantGuard)
  @Mutation(() => DisputeResponse)
  async handleAndUploadMerchantDisputeDocs(
    @Args('collect_id', { type: () => String }) collect_id: string,
    @Args('action', { type: () => String }) action: Dispute_Actions,
    @Context() context: any,
    @Args('files', { type: () => [UploadedFile] })
    files: UploadedFile[],
    @Args('reason', { type: () => String, nullable: true })
    reason?: string | null,
  ) {
    let uploadedFiles: Array<{ document_type: string; file_url: string }> = [];
    try {
      const schoolId = context.req.merchant;
      const school = await this.trusteeSchoolModel.findById(schoolId);
      if (!school) throw new BadRequestException('School Not Found');
      const collectObjectId = new Types.ObjectId(collect_id);
      const disputDetails = await this.DisputesModel.findOne({
        collect_id: collectObjectId,
      });
      if (!disputDetails) {
        throw new BadRequestException('Dispute not found');
      }
      uploadedFiles =
        files && files.length > 0
          ? await Promise.all(
            files
              .map(async (data) => {
                try {
                  const matches = data.file.match(/^data:(.*);base64,(.*)$/);
                  if (!matches || matches.length !== 3) {
                    throw new Error('Invalid base64 file format.');
                  }

                  const contentType = matches[1];
                  const base64Data = matches[2];
                  const fileBuffer = Buffer.from(base64Data, 'base64');

                  const sanitizedFileName = data.name.replace(/\s+/g, '_');
                  const last4DigitsOfMs = Date.now().toString().slice(-4);
                  const key = `merchant/${last4DigitsOfMs}_${disputDetails._id.toString()}_${sanitizedFileName}`;

                  const file_url = await this.awsS3Service.uploadToS3(
                    fileBuffer,
                    key,
                    contentType,
                    'edviron-backend-dev',
                  );

                  return {
                    document_type: data.extension,
                    file_url,
                    name: data.name,
                  };
                } catch (error) {
                  throw new InternalServerErrorException(
                    error.message || 'File upload failed',
                  );
                }
              })
              .filter((file) => file !== null),
          )
          : [];
      const dusputeUpdate = await this.DisputesModel.findOneAndUpdate(
        { collect_id: collect_id },
        {
          $push: { documents: { $each: uploadedFiles } },
          dispute_status: 'REQUEST_INITIATED',
        },
        { new: true },
      );
      // console.log(dusputeUpdate, "dusputeUpdate")
      if (disputDetails.gateway === DisputeGateways.EASEBUZZ) {
        await this.trusteeService.handleEasebuzzDispute({
          case_id: disputDetails.case_id,
          action,
          reason,
          documents: uploadedFiles,
        });
      } else {
        const school_details = await this.trusteeSchoolModel.findOne({
          school_id: disputDetails.school_id,
        });
        // await this.trusteeService.handleCashfreeDispute({
        //   dispute_id: disputDetails.dispute_id,
        //   action,
        //   documents:
        //     files.length > 0
        //       ? [
        //         {
        //           file: files[0].file,
        //           doc_type: uploadedFiles[0].document_type,
        //           note: files[0]?.description || '',
        //         },
        //       ]
        //       : [],
        //   client_id: school_details.client_id,
        // });

        const { email, cc } = await this.trusteeService.getMails(
          disputDetails.school_id.toString(),
          'DISPUTE',
        );

        const htmlBody =
          await this.trusteeService.generateDisputePDF(disputDetails);

        const subject = `A dispute has been raised against ${school_details.school_name} : (${school_details.kyc_mail})`;

        await this.emailService.sendAlertMail2(
          subject,
          htmlBody,
          email,
          cc,
          dusputeUpdate.documents,
        );
      }

      const teamMailSubject = `Dispute documents received for dispute id: ${disputDetails.dispute_id}`;

      const teamMailTemplate = getDisputeReceivedEmailForTeam(
        disputDetails.dispute_id,
        disputDetails.collect_id,
        action,
        reason,
        disputDetails.gateway,
        uploadedFiles,
      );
      // Mail Service need to implement
      return { success: true, message: 'Files uploaded successfully' };
    } catch (error) {
      // const disputDetails = await this.DisputesModel.findOne({
      //   collect_id: new Types.ObjectId(collect_id),
      // });
      // if (disputDetails) {
      //   if (uploadedFiles.length > 0) {
      //     await Promise.all([
      //       ...uploadedFiles.map(async (file) => {
      //         const bucketName = file.file_url.split('//')[1].split('.')[0];
      //         const key = file.file_url.split('.com/')[1];
      //         await this.awsS3Service.deleteFromS3(key, bucketName);
      //       }),
      //       this.DisputesModel.updateOne(
      //         { collect_id: new Types.ObjectId(collect_id) },
      //         {
      //           $pull: {
      //             documents: {
      //               file_url: { $in: uploadedFiles.map((f) => f.file_url) },
      //             },
      //           },
      //         },
      //       ),
      //     ]);
      //   }
      // }
      console.log(error);
      throw new InternalServerErrorException(error.message);
    }
  }

  @UseGuards(MerchantGuard)
  @Query(() => String)
  async updateMerchantTransactionNotification(
    @Context() context: any,
    @Args('for_transaction', { type: () => Boolean, nullable: true })
    for_transaction?: boolean,
    @Args('for_refund', { type: () => Boolean, nullable: true })
    for_refund?: boolean,
    @Args('for_settlement', { type: () => Boolean, nullable: true })
    for_settlement?: boolean,
  ) {
    const schoolId = context.req.merchant;
    const school = await this.trusteeSchoolModel.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }
    if (!school.isNotificationOn) {
      school.isNotificationOn = {
        for_transaction: false,
        for_refund: false,
        for_settlement: false,
      };
    }
    if (for_transaction !== undefined) {
      school.isNotificationOn.for_transaction = for_transaction;
    }
    if (for_refund !== undefined) {
      school.isNotificationOn.for_refund = for_refund;
    }
    if (for_settlement !== undefined) {
      school.isNotificationOn.for_settlement = for_settlement;
    }

    school.markModified('isNotificationOn');
    await school.save();
    return `Transaction notification setting updated to ${school.school_name}`;
  }

  @UseGuards(MerchantGuard)
  @Query(() => [PosMachineQuery])
  async getMerchantSchoolPOS(@Context() context: any) {
    try {
      const schoolId = context.req.merchant;
      const school = await this.trusteeSchoolModel.findById(schoolId);
      if (!school) throw new BadRequestException('School Not Found');
      const schoolsPosMachine = await this.posMachineModel.find({
        school_id: school?.school_id,
      });
      // if(!schoolsPosMachine || schoolsPosMachine.length === 0) {
      //   throw new NotFoundException('No POS machines found for this school');
      // }
      return schoolsPosMachine;
    } catch (error) {
      console.error(error);
      throw new BadRequestException(error.message || 'Something went wrong');
    }
  }

  @UseGuards(MerchantGuard)
  @Query(() => SettlementsTransactionsPaginatedResponse)
  async getmerchnatSettlementsTransacions(
    @Args('utr', { type: () => String }) utr: string,
    @Args('limit', { type: () => Int }) limit: number,
    @Args('cursor', { type: () => String, nullable: true })
    cursor: string | null,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ) {
    try {
      const settlement = await this.settlementReportModel.findOne({
        utrNumber: utr,
      });
      if (!settlement) {
        throw new Error('Settlement not found');
      }
      const client_id = settlement.clientId;
      const razorpay_id = settlement.razorpay_id;
      if (client_id) {
        return await this.trusteeService.getTransactionsForSettlements(
          utr,
          client_id,
          limit,
          cursor,
        );
      }
      if (razorpay_id) {
        console.log('inside razorpay');
        const school = await this.trusteeSchoolModel.findOne({
          'razorpay.razorpay_id': razorpay_id,
        });
        const razropay_secret = school?.razorpay?.razorpay_secret;
        return await this.trusteeService.getRazorpayTransactionForSettlement(
          utr,
          razorpay_id,
          razropay_secret,
          limit,
          cursor,
          skip,
          settlement.fromDate,
        );
      }


      const school = await this.trusteeSchoolModel.findOne({ school_id: settlement.schoolId });
      if (!school) {
        throw new NotFoundException('School not found');
      }
      if (
        school.isEasebuzzNonPartner &&
        school.easebuzz_non_partner.easebuzz_key &&
        school.easebuzz_non_partner.easebuzz_salt &&
        school.easebuzz_non_partner.easebuzz_submerchant_id

      ) {
        console.log('settlement from date');
        const settlements = await this.settlementReportModel.find({
          schoolId: settlement.schoolId,
          settlementDate: { $lt: settlement.settlementDate }
        }).sort({ settlementDate: -1 }).select('settlementDate').limit(2);
        const previousSettlementDate = settlements[1]?.settlementDate;
        const formatted_start_date = await this.trusteeService.formatDateToDDMMYYYY(previousSettlementDate);
        console.log({ formatted_start_date }); // e.g. 06-09-2025

        const formatted_end_date = await this.trusteeService.formatDateToDDMMYYYY(settlement.settlementDate);
        console.log({ formatted_end_date }); // e.g. 06-09-2025
        const paginatioNPage = page || 1
        const res = await this.trusteeService.easebuzzSettlementRecon(
          school.easebuzz_non_partner.easebuzz_submerchant_id,
          formatted_start_date,
          formatted_end_date,
          school.easebuzz_non_partner.easebuzz_key,
          school.easebuzz_non_partner.easebuzz_salt,
          utr,
          limit,
          skip,
          settlement.schoolId.toString(),
          paginatioNPage,
        );

        return res;
      }
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(MerchantGuard)
  @Query(() => SettlementsTransactionsPaginatedResponse)
  async getMerchantSettlementsTransactions(
    @Args('utr', { type: () => String }) utr: string,
    @Args('limit', { type: () => Int }) limit: number,
    @Args('cursor', { type: () => String, nullable: true })
    cursor: string | null,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
  ) {
    try {
      const settlement = await this.settlementReportModel.findOne({
        utrNumber: utr,
      });
      if (!settlement) {
        throw new Error('Settlement not found');
      }
      const client_id = settlement.clientId;
      const razorpay_id = settlement.razorpay_id;
      if (client_id) {
        return await this.trusteeService.getTransactionsForSettlements(
          utr,
          client_id,
          limit,
          cursor,
        );
      }
      if (razorpay_id) {
        console.log('inside razorpay');
        const school = await this.trusteeSchoolModel.findOne({
          'razorpay.razorpay_id': razorpay_id,
        });
        const razropay_secret = school?.razorpay?.razorpay_secret;
        return await this.trusteeService.getRazorpayTransactionForSettlement(
          utr,
          razorpay_id,
          razropay_secret,
          limit,
          cursor,
          skip,
          settlement.fromDate,
        );
      }
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }
  @UseGuards(MerchantGuard)
  @Query(() => [batchTransactionsReport])
  async getMerchantBatchTransactionReport(
    @Args('year') year: string,
    @Context() context: any,
  ) {
    const merchant = await this.trusteeSchoolModel.findById(
      context.req.merchant,
    );
    if (!merchant) {
      throw new BadRequestException('Merchant not found');
    }
    const school_id = merchant.school_id;
    try {
      return await this.merchantService.getMerchantBatchTransactions(
        school_id.toString(),
        year,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }
}

@ObjectType()
export class MerchantRefundRequestRes {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  createdAt: Date;

  @Field({ nullable: true })
  updatedAt: Date;

  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  order_id: string;

  @Field({ nullable: true })
  status: refund_status;

  @Field({ nullable: true })
  refund_amount: number;

  @Field({ nullable: true })
  order_amount: number;

  @Field({ nullable: true })
  transaction_amount: number;

  @Field({ nullable: true })
  custom_id: string;

  @Field(() => [SplitRefundsDetails], { nullable: true })
  split_refund_details: SplitRefundsDetails[];

  @Field({ nullable: true })
  reason?: string;
}

@ObjectType()
export class PaginatedRefundRequestResponse {
  @Field(() => [MerchantRefundRequestRes], { nullable: true })
  refundRequests: MerchantRefundRequestRes[];

  @Field({ nullable: true })
  totalCountResult: number;

  @Field({ nullable: true })
  totalPages: number;

  @Field({ nullable: true })
  page: number;
}

@ObjectType()
class VendorInfo {
  @Field({ nullable: true })
  vendor_id: string;

  @Field({ nullable: true })
  percentage: number;

  @Field({ nullable: true })
  amount: number;

  @Field({ nullable: true })
  name: string;
}

@ObjectType()
class MerchantTransactionReport {
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
  @Field({ nullable: true })
  student_id: string;
  @Field({ nullable: true })
  student_name: string;
  @Field({ nullable: true })
  student_email: string;
  @Field({ nullable: true })
  student_phone: string;
  @Field({ nullable: true })
  student_receipt: string;
  @Field({ nullable: true })
  bank_reference: string;
  @Field({ nullable: true })
  remarks: string;
  @Field({ nullable: true })
  details: string;
  @Field({ nullable: true })
  custom_order_id: string;
  @Field({ nullable: true })
  payment_time?: string;
  @Field(() => [VendorInfo], { nullable: true })
  vendors_info?: [VendorInfo];
}

@ObjectType()
class BankDetails {
  @Field({ nullable: true })
  account_holder_name: string;

  @Field({ nullable: true })
  account_number: string;

  @Field({ nullable: true })
  ifsc_code: string;
}

@ObjectType()
class MerchantUser {
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
  user: string;
  @Field({ nullable: true })
  trustee_id?: string;
  @Field({ nullable: true })
  school_id?: string;
  @Field({ nullable: true })
  trustee_logo?: string;
  @Field({ nullable: true })
  school_logo?: string;
  @Field(() => BankDetails, { nullable: true })
  bank_details?: BankDetails;
}

@ObjectType()
class MerchantMemberesResponse {
  @Field(() => String)
  _id: string;

  @Field(() => String)
  merchant_id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  phone_number: string;

  @Field(() => String)
  access: string;
}

@ObjectType()
export class MerchantRefundResponse {
  @Field({ nullable: true })
  order_id: string;
  @Field({ nullable: true })
  refund_amount: number;
  @Field({ nullable: true })
  refund_status: string;
  @Field({ nullable: true })
  refund_id: string;
  @Field({ nullable: true })
  bank_reference: string;
  @Field({ nullable: true })
  created_at: string;
  @Field({ nullable: true })
  order_amount: number;
  @Field({ nullable: true })
  payment_mode: string;
  @Field({ nullable: true })
  pg_refund_id: string;
  @Field({ nullable: true })
  processed_at: string;
  @Field({ nullable: true })
  refund_arn: string;
  @Field({ nullable: true })
  refund_currency: string;
  @Field({ nullable: true })
  refund_note: string;
  @Field({ nullable: true })
  refund_speed: string;
  @Field({ nullable: true })
  refund_type: string;
  @Field({ nullable: true })
  school_id: string;
  @Field({ nullable: true })
  service_charge: string;
  @Field({ nullable: true })
  service_tax: string;
  @Field({ nullable: true })
  trustee_id: string;
}

interface AdditionalData {
  student_details?: {
    student_id?: string;
    student_email?: string;
    student_name?: string;
    z;
    receipt?: string;
    student_phone_no?: string;
  };
  additional_fields?: {
    uid?: string;
    [key: string]: any;
  };
}
