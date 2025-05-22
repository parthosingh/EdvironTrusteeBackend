import {
  Resolver,
  Mutation,
  Args,
  Query,
  Int,
  Context,
  InputType,
  ID,
  registerEnumType,
} from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';
import {
  DisabledModes,
  PlatformCharge,
  TrusteeSchool,
  bank_Details,
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
import { bankDetails, Trustee, WebhookUrlType } from '../schema/trustee.schema';
import { TrusteeMember } from '../schema/partner.member.schema';
import { BaseMdr } from '../schema/base.mdr.schema';
import { SchoolMdr } from '../schema/school_mdr.schema';
import { Commission } from '../schema/commission.schema';
import { MerchantMember } from '../schema/merchant.member.schema';
import * as moment from 'moment';
import { Invoice, invoice_status, InvoiceData } from '../schema/invoice.schema';

import * as path from 'path';
import * as ejs from 'ejs';
import puppeteer from 'puppeteer';
import { AwsS3Service } from '../aws.s3/aws.s3.service';
import { MerchantService } from '../merchant/merchant.service';
import { refund_status, RefundRequest } from '../schema/refund.schema';
import { TransactionInfo } from '../schema/transaction.info.schema';
import { kyc_details, Vendors } from '../schema/vendors.schema';
import { VendorsSettlement } from '../schema/vendor.settlements.schema';
import { MerchantRefundRequestRes } from '../merchant/merchant.resolver';
import { DisputeGateways, Disputes } from '../schema/disputes.schema';
import { Reconciliation } from '../schema/Reconciliation.schema';
import { TempSettlementReport } from '../schema/tempSettlements.schema';
import { PdfService } from '../pdf-service/pdf-service.service';
import * as crypto from 'crypto';
import {
  getDisputeReceivedEmailForTeam,
  getDisputeReceivedEmailForUser,
} from '../email/templates/dipute.template';
import { EmailService } from '../email/email.service';
import { VirtualAccount } from 'src/schema/virtual.account.schema';

export enum webhookType {
  PAYMENTS = 'PAYMENTS',
  REFUNDS = 'REFUNDS',
  SETTLEMENTS = 'SETTLEMENTS',
}

@InputType()
export class invoiceDetails {
  @Field({ nullable: true })
  amount_without_gst: number;
  @Field({ nullable: true })
  tax: number;
  @Field({ nullable: true })
  total: number;
}

@InputType()
class BankInfoInput {
  @Field()
  account_number: string;

  @Field()
  account_holder_name: string;

  @Field()
  ifsc: string;
}

@InputType()
class KycDetailsInput {
  @Field()
  account_type: string;

  @Field()
  business_type: string;

  @Field({ nullable: true })
  uidai?: string;

  @Field({ nullable: true })
  gst?: string;

  @Field({ nullable: true })
  cin?: string;

  @Field({ nullable: true })
  pan?: string;

  @Field({ nullable: true })
  passport_number?: string;
}

@InputType()
export class vendorBanksInfo {
  @Field({ nullable: true })
  account_holder: string;

  @Field({ nullable: true })
  account_number: string;

  @Field({ nullable: true })
  ifsc: string;
}

@InputType()
export class VendorInfoInput {
  @Field()
  status: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  phone: string;

  @Field()
  verify_account: boolean;

  @Field()
  dashboard_access: boolean;

  @Field(() => Int)
  schedule_option: number;

  @Field(() => vendorBanksInfo)
  bank: vendorBanksInfo;

  @Field(() => KycDetailsInput)
  kyc_details: KycDetailsInput;
}

export enum Dispute_Actions {
  ACCEPT = 'accept',
  DENY = 'deny',
}

@InputType()
export class UploadedFile {
  @Field({ nullable: true })
  file?: string;

  @Field({ nullable: true })
  extension?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  preview?: string;
}

@Resolver('Trustee')
export class TrusteeResolver {
  constructor(
    private readonly trusteeService: TrusteeService,
    private readonly erpService: ErpService,
    private mainBackendService: MainBackendService,
    private readonly merchnatService: MerchantService,
    private readonly jwtService: JwtService,
    private readonly awsS3Service: AwsS3Service,
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(TrusteeMember.name)
    private trusteeMemberModel: mongoose.Model<TrusteeMember>,
    @InjectModel(Commission.name)
    private commissionModel: mongoose.Model<Commission>,
    @InjectModel(MerchantMember.name)
    private merchantMemberModel: mongoose.Model<MerchantMember>,
    @InjectModel(Invoice.name)
    private invoiceModel: mongoose.Model<Invoice>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
    @InjectModel(VendorsSettlement.name)
    private vendorsSettlementModel: mongoose.Model<VendorsSettlement>,
    @InjectModel(TempSettlementReport.name)
    private TempSettlementReportModel: mongoose.Model<TempSettlementReport>,
    @InjectModel(Disputes.name)
    private DisputesModel: mongoose.Model<Disputes>,
    @InjectModel(VirtualAccount.name)
    private virtualAccSchema: mongoose.Model<VirtualAccount>,
  ) { }

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
      if (role !== 'owner' && role !== 'admin' && role !== 'finance_team') {
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

      const trustee = await this.trusteeModel.findById(userTrustee.trustee_id);

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
        gstIn: trustee.gstIn,
        residence_state: trustee.residence_state,
        bank_details: trustee.bank_details,
        webhook_key: trustee.webhook_key,
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
        console.log(error);

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

  @Query(() => [TempSettlementReport])
  @UseGuards(TrusteeGuard)
  async getSettlementReportsQa(@Context() context) {
    let id = context.req.trustee;

    let settlementReports = [];
    settlementReports = await this.TempSettlementReportModel.find({
      trustee: id,
    }).sort({ createdAt: -1 });
    return settlementReports;
  }

  @Query(() => TransactionReportResponsePaginated)
  @UseGuards(TrusteeGuard)
  async getTransactionReport(
    @Context() context,
    @Args('startDate', { nullable: true }) startDate?: string,
    @Args('endDate', { nullable: true }) endDate?: string,
    @Args('status', { nullable: true, defaultValue: null }) status?: string,
    @Args('school_id', { nullable: true, defaultValue: null })
    school_id?: string,
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
      console.log(school_id);
      // if (searchFilter === 'order_id') {
      //   const checkId = mongoose.Types.ObjectId.isValid(searchFilter);
      //   if (!checkId) throw new BadRequestException('Invalid order id');
      // }
      // checking for debouncing
      // if(true){
      //   throw new Error("debounceKey check")
      // }
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

      const merchant_ids_to_merchant_map = {};
      merchants.map((merchant: any) => {
        merchant_ids_to_merchant_map[merchant.school_id] = merchant;
      });
      console.timeEnd('mapping merchant transaction');
      const token = this.jwtService.sign(
        { trustee_id: id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report/?limit=${limit}&startDate=${first}&endDate=${last}&page=${page}&status=${status}&school_id=${school_id}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: id,
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

      const response = await axios.request(config);

      const transactionLimit = Number(limit) || 100;
      const transactionPage = Number(page) || 1;
      let total_pages = response.data.totalTransactions / transactionLimit;

      console.timeEnd('fetching all transaction');

      console.time('mapping');

      transactionReport = await Promise.all(
        response.data.transactions.map(async (item: any) => {
          let remark = null;

          return {
            ...item,
            merchant_name:
              merchant_ids_to_merchant_map[item.merchant_id].school_name,
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
            school_name:
              merchant_ids_to_merchant_map[item.merchant_id].school_name,
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
  @UseGuards(TrusteeGuard)
  async getSingleTransactionReport(
    @Context() context,
    @Args('collect_id') collect_id: string,
    @Args('school_id', { nullable: true }) school_id?: string,
    @Args('isVBAPaymentComplete', { nullable: true, defaultValue: false }) isVBAPaymentComplete?: boolean,
  ) {
    try {
      const trustee_id = context.req.trustee;
      const token = this.jwtService.sign(
        { trustee_id, collect_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const data = await this.trusteeService.getSingleTransaction(
        trustee_id,
        collect_id,
        token,
      );

      let vbaPayment;
      if (isVBAPaymentComplete) {
        vbaPayment = await this.virtualAccSchema.findOne({
          collect_id: collect_id
        })
        if (!vbaPayment) {
          throw new BadRequestException("vba payment not found")
        }
      }

      return await data.map(async (item: any) => {
        const school = await this.trusteeSchoolModel.findOne({
          school_id: new Types.ObjectId(item?.school_id),
        });
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
          virtual_account_number: vbaPayment?.virtual_account_number || null,
          virtual_account_ifsc: vbaPayment?.virtual_account_ifsc || null,
          virtual_account_id: vbaPayment?.virtual_account_id || null,
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Something went wrong',
      );
    }
  }

  @Query(() => Commissionres)
  @UseGuards(TrusteeGuard)
  async fetchAllCommission(
    @Context() context,
    @Args('startDate', { nullable: true }) startDate?: string,
    @Args('endDate', { nullable: true }) endDate?: string,
  ) {
    try {
      let id = context.req.trustee;
      // const commissions = await this.commissionModel
      //   .find({ trustee_id: id.toString() })
      //   .sort({ createdAt: -1 });
      let query: any = {
        trustee_id: id.toString(),
      };
      if (startDate && endDate) {
        const start_date = new Date(startDate);

        const end_date = new Date(endDate);
        end_date.setHours(23, 59, 59, 999);
        const utcStartDate = new Date(
          start_date.getTime() - 5.5 * 60 * 60 * 1000,
        );
        const utcEndDate = new Date(end_date.getTime() - 5.5 * 60 * 60 * 1000);
        query = {
          trustee_id: id.toString(),
          createdAt: {
            $gte: utcStartDate,
            $lte: utcEndDate,
          },
        };
      }
      console.log(query);

      const sumCommision = await this.commissionModel.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,
            totalCommission: { $sum: '$commission_amount' },
          },
        },
        {
          $project: {
            _id: 0,
            totalCommission: 1,
          },
        },
      ]);
      if (sumCommision.length == 0) {
        return { totalCommission: 0 };
      }

      // console.log(commissions.length);
      return sumCommision[0];
    } catch (error) {
      throw error;
    }
  }

  @Query(() => [Commissionresponse])
  @UseGuards(TrusteeGuard)
  async fetchAllSchoolsCommission(
    @Args('school_id') school_id: string,
    @Context() context,
  ) {
    try {
      let id = context.req.trustee;
      const commissions = await this.commissionModel
        .find({ trustee_id: id.toString(), school_id })
        .sort({ createdAt: -1 });

      console.log(commissions.length);
      return commissions;
    } catch (error) {
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
    if (role !== 'owner' && role !== 'admin' && role !== 'finance_team') {
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

      if (role !== 'owner' && role !== 'admin' && role !== 'finance_team') {
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
              school_id: new Types.ObjectId(school.school_id),
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
    if (role !== 'owner' && role !== 'admin' && role !== 'finance_team') {
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

    if (
      !['admin', 'management', 'finance_team', 'developer'].includes(access)
    ) {
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

    await this.trusteeService.sendMemberCredentialsMail(email, password);

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
        merchantStatus: 'KYC Approved',
      }),
      this.trusteeSchoolModel.countDocuments({
        trustee_id: id,
        merchantStatus: { $in: ['Not Initiated', 'MIN_KYC_REJECTED', null] },
      }),
      this.trusteeSchoolModel.countDocuments({
        trustee_id: id,
        merchantStatus: 'Documents uploaded',
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
    if (
      !['admin', 'management', 'finance_team', 'developer'].includes(access)
    ) {
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
    if (role !== 'owner' && role !== 'developer') {
      throw new UnauthorizedException(
        'You are not Authorized to perform this action',
      );
    }
    let trustee = await this.trusteeModel.findById(id);
    if (!trustee) {
      const member = await this.trusteeMemberModel.findById(id)
      if (!member) {
        throw new NotFoundException('Account not found Not Found');
      }
      const trusteenew = await this.trusteeModel.findById(member.trustee_id)
      if (!trusteenew) {
        throw new NotFoundException('Account not found Not Found');
      }
      trustee = trusteenew
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
  async initiateRefund(
    @Args('client_id') client_id: string,
    @Args('order_id') order_id: string,
    @Args('refund_amount') refund_amount: number,
  ) {
    const data = {
      client_id,
      order_id,
      refund_amount,
    };
    try {
      const response = await axios.post(
        `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/initiate-refund`,
        data,
      );
      return `refund Created`;
    } catch (error) {
      console.error('Error:', error.response.data);
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async generatePaymentLink(
    @Args('school_id') school_id: string,
    @Args('amount') amount: string,
    @Args('callback_url') callback_url: string,
    @Args('sign') sign: string,
    @Context() context,
  ) {
    try {
      if (!school_id) throw new BadRequestException('School id required');
      if (!amount) throw new BadRequestException('Amount required');
      if (!callback_url) throw new BadRequestException('Callback url required');

      const trustee_id = context.req.trustee;
      const trustee = await this.trusteeModel.findById(trustee_id);
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!trustee) throw new NotFoundException('Invalid trustee');
      if (!school) throw new NotFoundException('Invalid school');
      if (school.trustee_id.toString() !== trustee._id.toString())
        throw new UnauthorizedException('Unauthorized user');

      const verify_val = this.jwtService.verify(sign, {
        secret: school.pg_key,
      });

      if (
        verify_val.school_id !== school_id ||
        verify_val.callback_url !== callback_url ||
        verify_val.amount !== amount
      ) {
        throw new ForbiddenException('Request forged');
      }

      const payload = {
        school_id,
        amount,
        callback_url,
      };
      const sign_val = this.jwtService.sign(payload, { secret: school.pg_key });

      const apiKeyPayload = {
        trusteeId: trustee._id,
        IndexOfApiKey: trustee.IndexOfApiKey,
      };
      const apiKey = this.jwtService.sign(apiKeyPayload, {
        secret: process.env.JWT_SECRET_FOR_API_KEY,
      });

      const response = await axios.post(
        `${process.env.URL}/erp/create-collect-request`,
        {
          amount,
          school_id: school_id,
          callback_url,
          sign: sign_val,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.collect_request_url;
    } catch (err) {
      if (err.response.data?.statusCode === 400)
        throw new BadRequestException(err.response.data?.message);
      else if (err.response.data?.statusCode === 404)
        throw new NotFoundException(err.response.data?.message);
      else if (err.response.data?.statusCode === 401)
        throw new UnauthorizedException(err.response.data?.message);
      else if (err.response.data?.statusCode === 403)
        throw new ForbiddenException(err.response.data?.message);
      throw new Error(err);
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
  @Query(() => [RefundResponse])
  async trsuteeRefund(@Context() context) {
    let userId = context.req.trustee;
    return await this.trusteeService.trusteeRefunds(userId.toString());
  }

  @UseGuards(TrusteeGuard)
  @Query(() => [RefundResponse])
  async merchantsRefunds(@Args('school_id') school_id: string) {
    return await this.trusteeService.merchantsRefunds(school_id);
  }

  @UseGuards(TrusteeGuard)
  @Query(() => [RefundResponse])
  async orderRefunds(@Args('order_id') order_id: string) {
    return await this.trusteeService.orderRefunds(order_id);
  }

  @UseGuards(TrusteeGuard)
  @Query(() => SettlementUtr)
  async transactionUtr(
    @Args('school_id') school_id: string,
    @Args('order_id') order_id: string,
  ) {
    const schoolId = new Types.ObjectId(school_id);
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
  @Mutation(() => String)
  async tooglePaymentMode(
    @Args('mode') mode: DisabledModes,
    @Args('school_id') school_id: string,
  ) {
    const validModes = [
      'wallet',
      'cardless',
      'net_banking',
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
    if (!school) {
      school = await this.trusteeSchoolModel.findOne({
        school_id: school_id,
      });
      if (!school) throw new NotFoundException('School not found');
    }
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
  @Query(() => SchoolMDRINFO)
  async getSchoolMdrData(
    @Args('school_id') school_id: string,
    @Context() context,
  ) {
    const trustee_id = context.req.trustee;
    let school: SchoolMdrInfo = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return await this.trusteeService.schoolMdrInforData(
      school_id,
      trustee_id.toString(),
    );
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

  @Mutation(() => String)
  @UseGuards(TrusteeGuard)
  async createWebhooks(
    @Context() context: any,
    @Args('webhookUrl', { type: () => String }) webhookUrl: string,
    @Args('type', { type: () => String }) type: string,
  ) {
    try {
      const role = context.req.role;
      if (role !== 'owner') {
        throw new UnauthorizedException(
          'You are not Authorized to perform this action',
        );
      }
      const trustee = await this.trusteeModel.findById(
        new Types.ObjectId(context.req.trustee),
      );
      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }
      if (type === webhookType.PAYMENTS) {
        return await this.trusteeService.createWebhooks(trustee, webhookUrl);
      } else if (type === webhookType.REFUNDS) {
        trustee.refund_webhook_url = webhookUrl;
        await trustee.save();
        return 'Refund webhook created successfully';
      } else if (type === webhookType.SETTLEMENTS) {
        trustee.settlement_webhook_url = webhookUrl;
        await trustee.save();
        return 'Settlement webhook created successfully';
      }
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @Mutation(() => String)
  @UseGuards(TrusteeGuard)
  async deleteWebhook(
    @Context() context: any,
    @Args('webHook_id', { type: () => Number }) webhook_id: number,
    @Args('type', { type: () => String }) type: string,
  ) {
    try {
      const role = context.req.role;
      if (role !== 'owner') {
        throw new UnauthorizedException(
          'You are not Authorized to perform this action',
        );
      }
      const trustee = await this.trusteeModel.findById(
        new Types.ObjectId(context.req.trustee),
      );

      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }
      if (type === webhookType.PAYMENTS) {
        await this.trusteeService.deleteWebhook(trustee, webhook_id);
        return 'Webhook deleted successfully';
      } else if (type === webhookType.REFUNDS) {
        trustee.refund_webhook_url = null;
        await trustee.save();
        return 'Webhook deleted successfully';
      } else if (type === webhookType.SETTLEMENTS) {
        trustee.settlement_webhook_url = null;
        await trustee.save();
        return 'Webhook deleted successfully';
      }
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @Query(() => [WebhookUrlType])
  @UseGuards(TrusteeGuard)
  async getWebhooks(@Context() context: any) {
    try {
      const trustee = await this.trusteeModel.findById(
        new Types.ObjectId(context.req.trustee),
      );

      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }

      let webhookUrls: any = trustee.webhook_urls;
      if (trustee.refund_webhook_url) {
        webhookUrls.push({
          id: webhookUrls.length + 1,
          url: trustee.refund_webhook_url,
          type: webhookType.REFUNDS,
        });
      }

      if (trustee.settlement_webhook_url) {
        webhookUrls.push({
          id: webhookUrls.length + 1,
          url: trustee.settlement_webhook_url,
          type: webhookType.SETTLEMENTS,
        });
      }

      return webhookUrls;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @Mutation(() => Boolean)
  @UseGuards(TrusteeGuard)
  async sendTestWebhook(
    @Context() context,
    @Args('webhookUrl', { type: () => String }) webhookUrl: string,
  ): Promise<boolean> {
    try {
      const role = context.req.role;
      if (role !== 'owner') {
        throw new UnauthorizedException(
          'You are not Authorized to perform this action',
        );
      }
      const urlRegex = /^https:\/\/([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

      if (!urlRegex.test(webhookUrl)) {
        throw new BadRequestException('Please provide valid webhook url');
      }
      const res = await this.trusteeService.testWebhook(webhookUrl);
      console.log(res, 'res');
      if (!res) return false;
      return true;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async addRemarks(
    @Args('collect_id') collect_id: string,
    @Args('remark') remark: string,
    @Context() context,
  ) {
    const trustee_id = context.req.trustee;
    await await this.trusteeService.createRemark(
      collect_id,
      remark,
      trustee_id,
    );
    return `Remark Added Successfully`;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => GetRemarkResponse)
  async getRemarks(@Args('collect_id') collect_id: string) {
    return await this.trusteeService.getRemarks(collect_id);
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async deleteRemark(@Args('collect_id') collect_id: string) {
    return await this.trusteeService.deleteRemark(collect_id);
  }

  @UseGuards(TrusteeGuard)
  @Query(() => Commission)
  async getCommission(@Context() context) {
    const trustee_id = context.req.trustee;
    return await this.commissionModel.find({ trustee_id });
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async generateMerchantLoginToken(
    @Args('email') email: string,
  ): Promise<string> {
    try {
      const merchant = await this.trusteeSchoolModel.findOne({
        email,
      });

      if (merchant) {
        return this.trusteeService.generateToken(merchant._id);
      }
      const member = await this.merchantMemberModel.findOne({ email });
      if (member) {
        return this.trusteeService.generateToken(member._id);
      }
      throw new NotFoundException('Email not found');
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async uploadInvoice(
    @Args('base64') base64: string,
    @Args('invoice_no') invoice_no: string,
    @Args('invoice_date') invoice_date: string,
    @Args('hsn') hsn: string,
    @Args('amount_in_words') amount_in_words: string,
    @Args('amount') amount: number,
    @Args('amount_without_gst') amount_without_gst: number,
    @Args('tax') tax: number,
    @Args('duration') duration: string,
    @Args('note') note: string,
    @Context() context: any,
  ) {
    const buffer = Buffer.from(base64.split(',')[1], 'base64');
    const trustee = await this.trusteeModel.findById(context.req.trustee);
    if (!trustee) {
      throw new NotFoundException('Merchant Not Found');
    }
    const check_invoice = await this.invoiceModel.findOne({
      invoice_no,
      trustee_id: context.req.trustee,
    });
    if (check_invoice) {
      throw new BadRequestException(
        'Invoice already exists with invoice Number',
      );
    }

    const parsedInvoiceDate = invoice_date;

    const targetMonthYear = invoice_date.slice(invoice_date.indexOf(' ') + 1); // Extract "October 2024"

    const existingInvoice = await this.invoiceModel.findOne({
      trustee_id: context.req.trustee,
      invoice_date: { $regex: new RegExp(`\\b${targetMonthYear}\\b`, 'i') }, // Case-insensitive match for the month and year
    });

    if (existingInvoice) {
      throw new ConflictException(
        `An invoice for ${targetMonthYear} already exists.`,
      );
    }

    const invoice = await new this.invoiceModel({
      invoice_details: {
        amount_without_gst,
        tax,
        total: amount,
      },
      seller_details: {
        name: trustee.name,
        gstIn: trustee.gstIn || 'NA',
        residence_state: trustee.residence_state || 'NA',
        account_holder_name: trustee.bank_details?.account_holder_name || 'NA',
        account_number: trustee.bank_details?.account_number || 'NA',
        ifsc_code: trustee.bank_details?.ifsc_code || 'NA',
      },
      buyer_details: {
        name: `THRIVEDGE EDUTECH PRIVATE LIMITED`,
        gstIn: '06AAJCT8114C1ZJ',
        address:
          '4th & 5th Floor, DLF Phase-5,Sector-43, Golf Course Rd, Gurugram. DLF QE, Gurgaon, Dlf Qe, Haryana, India, 122002',
        placeOfSupply: 'Delhi-NCR',
      },
      invoice_status: invoice_status.PENDING,
      invoice_date: parsedInvoiceDate,
      invoice_no,
      amount_in_words,
      hsn,
      note,
      trustee_id: context.req.trustee,
      amount,
      duration,
    }).save();

    const pdfUrl = await new Promise<string>(async (resolve, reject) => {
      try {
        // Upload the PDF buffer to AWS S3
        const url = await this.awsS3Service.uploadToS3(
          buffer,
          `invoice_${invoice._id.toString()}.pdf`,
          'application/pdf',
          'edviron-backend-dev',
        );

        resolve(url);
      } catch (error) {
        reject(error);
      }
    });

    if (pdfUrl) {
      invoice.invoice_url = pdfUrl;
      await invoice.save();
    }
    return `Invoice Request created`;
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async requestInvoice(
    @Args('invoice_no') invoice_no: string,
    @Args('invoice_date') invoice_date: string,
    @Args('hsn') hsn: string,
    @Args('amount_in_words') amount_in_words: string,
    @Args('amount') amount: number,
    @Args('amount_without_gst') amount_without_gst: number,
    @Args('tax') tax: number,
    @Args('duration') duration: string,
    @Args('note') note: string,
    @Context() context: any,
    @Args('base64', { nullable: true }) base64: string,
  ) {
    try {
      const trustee = await this.trusteeModel.findById(context.req.trustee);
      if (!trustee) {
        throw new NotFoundException('Merchant Not Found');
      }

      const checkDuration = await this.invoiceModel.findOne({
        duration: duration,
        trustee_id: context.req.trustee,
        invoice_status: invoice_status.APPROVED,
      });
      if (checkDuration) {
        throw new ConflictException(`Invoice Already Exists For This Duration`);
      }

      const invoice = await this.invoiceModel.findOne({
        invoice_no,
        trustee_id: context.req.trustee,
      });

      if (invoice) {
        throw new ConflictException(`Invoice number already present`);
      }
      const parsedInvoiceDate = invoice_date;
      const targetMonthYear = parsedInvoiceDate.slice(
        invoice_date.indexOf(' ') + 1,
      ); // Extract "October 2024"

      const existingInvoice = await this.invoiceModel.findOne({
        trustee_id: context.req.trustee,
        duration: { $regex: new RegExp(`\\b${duration}\\b`, 'i') }, // Case-insensitive match for the month and year
      });
      console.log(targetMonthYear, 'targetMonthYear');

      if (existingInvoice) {
        throw new ConflictException(
          `An invoice for ${duration} already exists.`,
        );
      }

      const newInvoice = await new this.invoiceModel({
        trustee_id: context.req.trustee,
        invoice_details: {
          amount_without_gst,
          tax,
          total: amount,
        },
        seller_details: {
          name: trustee.name,
          gstIn: trustee.gstIn || 'NA',
          residence_state: trustee.residence_state || 'NA',
          account_holder_name:
            trustee.bank_details?.account_holder_name || 'NA',
          account_number: trustee.bank_details?.account_number || 'NA',
          ifsc_code: trustee.bank_details?.ifsc_code || 'NA',
        },
        buyer_details: {
          name: `THRIVEDGE EDUTECH PRIVATE LIMITED`,
          gstIn: '06AAJCT8114C1ZJ',
          address:
            '4th & 5th Floor, DLF Phase-5,Sector-43, Golf Course Rd, Gurugram. DLF QE, Gurgaon, Dlf Qe, Haryana, India, 122002',
          placeOfSupply: 'Delhi-NCR',
        },
        invoice_status: invoice_status.PENDING,
        invoice_date: parsedInvoiceDate,
        invoice_no,
        duration,
        amount_in_words,
        hsn,
        note,
      }).save();

      const invoiceData = {
        invoiceDate: parsedInvoiceDate,
        invoiceNumber: invoice_no,
        hsn,
        amountInWords: amount_in_words,
        note,
        sellerDetails: newInvoice.seller_details,
        buyerDetails: newInvoice.buyer_details,
        month: duration,
        details: {
          amount_without_gst,
          tax,
          total: amount,
        },
      };
      if (base64) {
        const buffer = Buffer.from(base64.split(',')[1], 'base64');
        const pdfUrl = await new Promise<string>(async (resolve, reject) => {
          try {
            // Upload the PDF buffer to AWS S3
            const url = await this.awsS3Service.uploadToS3(
              buffer,
              `invoice_${invoice._id.toString()}.pdf`,
              'application/pdf',
              'edviron-backend-dev',
            );

            resolve(url);
          } catch (error) {
            reject(error);
          }
        });

        if (pdfUrl) {
          newInvoice.invoice_url = pdfUrl;
          await newInvoice.save();
        }
        return `Invoice Request created`;
      }
      setImmediate(() => {
        this.generateInvoicePDF(newInvoice._id.toString(), invoiceData);
      });
      return `Invoice Request created`;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async generateInvoicePDF(invoiceId: string, invoiceData: any) {
    try {
      console.log(invoiceData, 'invoiceData');

      const buffer = await this.pdfService.generateInvoicePdf(invoiceData);
      const pdfUrl = await this.awsS3Service.uploadToS3(
        buffer,
        `invoice_${invoiceId}.pdf`,
        'application/pdf',
        'edviron-backend-dev',
      );

      await this.invoiceModel.findByIdAndUpdate(invoiceId, {
        invoice_url: pdfUrl,
      });
      console.log(`Invoice Saved`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  }

  @UseGuards(TrusteeGuard)
  @Query(() => [MerchantRefundRequestRes])
  async getRefundRequest(@Args('order_id') order_id: string) {
    const refundRequests =
      await this.merchnatService.getRefundRequest(order_id);
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

  @UseGuards(TrusteeGuard)
  @Query(() => [InvoiceResponse])
  async getInvoice(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
  ) {
    const invoices = await this.invoiceModel
      .find({ trustee_id: context.req.trustee })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return invoices;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => [RefundRequestRes])
  async getTrusteeRefundRequest(@Context() context: any) {
    try {
      // return await this.refundRequestModel.find({trustee_id: context.req.trustee})
      const refunds = await this.refundRequestModel.aggregate([
        { $match: { trustee_id: context.req.trustee } },
        {
          $lookup: {
            from: 'trusteeschools',
            localField: 'school_id',
            foreignField: '_id',
            as: 'result',
          },
        },
        {
          $unwind: '$result',
        },
        {
          $project: {
            _id: 1,
            trustee_id: 1,
            school_id: '$result.school_id',
            order_id: 1,
            school_name: '$result.school_name',
            status: 1,
            refund_amount: 1,
            order_amount: 1,
            transaction_amount: 1,
            reason: 1,
            createdAt: 1,
            updatedAt: 1,
            custom_id: 1,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ]);

      return refunds;
    } catch (e) {
      console.error(e);
      throw new BadRequestException('Error fetching refund requests');
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async createVendor(
    @Args('school_id') school_id: string,
    @Args('vendor_info', { type: () => VendorInfoInput })
    vendor_info: VendorInfoInput,
    @Context() context: any,
    @Args('chequeBase64') chequeBase64?: string,
    @Args('chequeExtension') chequeExtension?: string,
  ): Promise<string> {
    const trustee_id = context.req.trustee;
    console.log({ school_id, trustee_id });

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

    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) throw new NotFoundException('School not found');

    if (school.trustee_id === trustee_id) {
      throw new ForbiddenException(
        'You are not authorized to perform this operation',
      );
    }
    const client_id = school.client_id || 'null';
    // if (!client_id) {
    //   throw new BadRequestException(
    //     'Payment gateway is not enabled for this school yet, Kindly contact us at tarun.k@edviron.com',
    //   );
    // }
    return await this.trusteeService.onboardVendor(
      client_id,
      trustee_id.toString(),
      school_id,
      school.school_name,
      vendor_info,
      chequeBase64,
      chequeExtension,
    );
  }

  @UseGuards(TrusteeGuard)
  @Query(() => VendorsPaginationResponse)
  async getVendors(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
  ) {
    const trustee_id = context.req.trustee;
    const vendors = await this.trusteeService.getAllVendors(
      trustee_id.toString(),
      page,
      limit,
    );
    return vendors;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => VendorSingleTransaction)
  async getSingleVendorTransaction(
    @Args('order_id', { type: () => String }) order_id: string,
    @Context() context: any,
  ) {
    // console.log('test');
    const trustee_id = context.req.trustee;
    if (!trustee_id) {
      throw new NotFoundException('trustee id not found ');
    }
    const transactions = this.trusteeService.getVendonrSingleTransactions(
      order_id,
      trustee_id.toString(),
    );
    return transactions;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => VendorsTransactionPaginatedResponse)
  async getVendorTransaction(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Args('vendor_id', { type: () => String }) vendor_id: string,
    @Context() context: any,
  ) {
    console.log('test');

    const trustee_id = context.req.trustee;
    const transactions = this.trusteeService.getVendorTransactions(
      vendor_id,
      trustee_id.toString(),
      page,
      limit,
    );
    return transactions;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => VendorsTransactionPaginatedResponse)
  async getAllVendorTransaction(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
    @Args('startDate', { type: () => String, nullable: true })
    startDate?: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('vendor_id', { type: () => String, nullable: true })
    vendor_id?: string,
    @Args('school_id', { type: () => String, nullable: true })
    school_id?: string,
    @Args('custom_id', { type: () => String, nullable: true })
    custom_id?: string,
    @Args('order_id', { type: () => String, nullable: true })
    order_id?: string,
  ) {
    const trustee_id = context.req.trustee;
    const transactions = this.trusteeService.getAllVendorTransactions(
      trustee_id.toString(),
      page,
      limit,
      status,
      vendor_id,
      school_id,
      startDate,
      endDate,
      custom_id,
      order_id,
    );
    return transactions;
  }

  @UseGuards(TrusteeGuard)
  @Query(() => VendorsSettlementReportPaginatedResponse)
  async getAllVendorSettlementReport(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
    @Args('start_date', { type: () => String, nullable: true })
    start_date?: string,
    @Args('end_date', { type: () => String, nullable: true }) end_date?: string,
    @Args('utr', { type: () => String, nullable: true })
    utr?: string,
    @Args('school_id', { type: () => String, nullable: true })
    school_id?: string,
    @Args('vendor_id', { type: () => String, nullable: true })
    vendor_id?: string,
  ) {
    const trusteeId = context.req.trustee;

    let schoolId = new Types.ObjectId(school_id);

    const query = {
      trustee_id: trusteeId,
      ...(school_id && { school_id: schoolId }),
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

    // Return paginated response
    return {
      vendor_settlements,
      totalCount,
      totalPages,
      page,
      limit,
    };
  }

  @UseGuards(TrusteeGuard)
  @Query(() => VendorsSettlementReportPaginatedResponse)
  async getSingleVendorSettlementReport(
    @Args('vendor_id', { type: () => String }) vendor_id: string,
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
  ) {
    const trusteeId = context.req.trustee;
    const totalCount = await this.vendorsSettlementModel.countDocuments({
      trustee_id: trusteeId,
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch paginated data
    const vendor_settlements = await this.vendorsSettlementModel
      .find({ trustee_id: trusteeId, vendor_id: vendor_id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    // Return paginated response
    return {
      vendor_settlements,
      totalCount,
      totalPages,
      page,
      limit,
    };
  }

  @UseGuards(TrusteeGuard)
  @Query(() => SettlementsTransactionsPaginatedResponse)
  async getSettlementsTransactions(
    @Args('utr', { type: () => String }) utr: string,
    @Args('limit', { type: () => Int }) limit: number,
    @Args('cursor', { type: () => String, nullable: true })
    cursor: string | null,
  ) {
    try {
      const settlement = await this.settlementReportModel.findOne({
        utrNumber: utr,
      });
      if (!settlement) {
        throw new Error('Settlement not found');
      }
      const client_id = settlement.clientId;
      return await this.trusteeService.getTransactionsForSettlements(
        utr,
        client_id,
        limit,
        cursor,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Query(() => ErpWebhooksLogsPaginatedResponse)
  async GetWEbhookLogs(
    @Context() context: any,
    @Args('startDate', { type: () => String, nullable: true })
    startDate: string,
    @Args('endDate', { type: () => String, nullable: true })
    endDate: string,
    @Args('page', { type: () => Int, nullable: true }) page: number | null,
    @Args('limit', { type: () => Int, nullable: true }) limit: number | null,
    @Args('school_id', { type: () => String, nullable: true })
    school_id: string | null,
    @Args('collect_id', { type: () => String, nullable: true })
    collect_id: string | null,
    @Args('custom_id', { type: () => String, nullable: true })
    custom_id: string | null,
  ) {
    try {
      const trustee_id = context.req.trustee;
      const data = {
        trustee_id,
        startDate,
        endDate,
        page,
        limit,
        school_id,
        collect_id,
        custom_id,
      };
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/erp-webhook-logs`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: data,
      };
      const response = await axios(config);

      return response.data;
    } catch (e) {
      throw new Error(e.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Query(() => [batchTransactionsReport])
  async getBatchTransactionReport(
    @Args('year') year: string,
    @Context() context: any,
  ) {
    const trustee_id = context.req.trustee;
    try {
      return await this.trusteeService.getBatchTransactions(
        trustee_id.toString(),
        year,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Query(() => DisputesRes)
  async getDisputes(
    @Context() context: any,
    @Args('page', { type: () => Int, defaultValue: 0 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
    @Args('school_id', { type: () => String, nullable: true })
    school_id: string,
    @Args('collect_id', { type: () => String, nullable: true })
    collect_id: string,
    @Args('custom_id', { type: () => String, nullable: true })
    custom_id: string,
    @Args('startDate', { type: () => String, nullable: true })
    startDate: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string,
    @Args('dispute_status', { type: () => String, nullable: true })
    dispute_status: string,
  ) {
    try {
      return this.trusteeService.getDisputes(
        context.req.trustee,
        page,
        limit,
        school_id,
        collect_id,
        custom_id,
        startDate,
        endDate,
        dispute_status,
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Query(() => String)
  async generateWebhookKeyOtp(@Context() context: any) {
    try {
      const trustee_id = context.req.trustee;
      const trusteeDetails = await this.trusteeModel.findById(trustee_id);
      if (!trusteeDetails) {
        throw new NotFoundException('Invalid Request');
      }
      const sendMail = await this.trusteeService.sendWebhookKeyMail(
        trusteeDetails.email_id,
      );
      if (sendMail) {
        return 'Otp send to email, verify otp to generate webhook key';
      } else {
        throw new BadRequestException('Error Sending Mail');
      }
    } catch (error) {
      throw new BadRequestException(error.message || 'Something went wrong');
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async generateAndSaveWebhookKey(
    @Context() context: any,
    @Args('otp', { type: () => String }) otp: string,
  ) {
    try {
      const trustee_id = context.req.trustee;
      const trusteeDetails = await this.trusteeModel.findById(trustee_id);
      if (!trusteeDetails) {
        throw new NotFoundException('Invalid Request');
      }
      const isVerifiedOtp = await this.trusteeService.validateOtp(
        otp,
        trusteeDetails.email_id,
      );
      if (!isVerifiedOtp) {
        throw new BadRequestException('Invalid OTP');
      }
      const key = crypto.randomBytes(24);
      const webhookKey = key.toString('hex');
      trusteeDetails.webhook_key = webhookKey;
      await trusteeDetails.save();
      return `Webhook key generated`;
    } catch (error) {
      throw new BadRequestException(error.message || 'Something went wrong');
    }

  }

  @UseGuards(TrusteeGuard)
  @Query(() => ReconRes)
  async getReconcilation(
    @Context() context: any,
    @Args('page', { type: () => Int, defaultValue: 0 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
    @Args('school_id', { type: () => String, nullable: true })
    school_id: string,
    @Args('startDate', { type: () => String, nullable: true })
    startDate: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string,
  ) {
    const trustee_id = context.req.trustee.toString();
    return await this.trusteeService.getReconciliation(
      trustee_id,
      page,
      limit,
      startDate,
      endDate,
      school_id,
    );
  }

  @UseGuards(TrusteeGuard)
  @Query(() => commisonStatsRes)
  async getCommissionDetails(
    @Args('month', { type: () => String }) month: string,
    @Args('year', { type: () => String }) year: string,
    @Context() context: any,
  ) {
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    // Construct IST dates manually
    const startDateIST = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0)); // 1st day, 00:00 IST
    const endDateIST = new Date(
      Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999),
    ); // Last day, 23:59 IST

    // Convert IST to UTC manually
    const startDateUTC = new Date(
      startDateIST.getTime() - 5.5 * 60 * 60 * 1000,
    );
    const endDateUTC = new Date(endDateIST.getTime() - 5.5 * 60 * 60 * 1000);

    console.log({ startDateUTC, endDateUTC });

    const commissionsInfo = await this.commissionModel.aggregate([
      {
        $match: {
          trustee_id: context.req.trustee.toString(),
          createdAt: { $gte: startDateUTC, $lte: endDateUTC },
        },
      },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$commission_amount' },
        },
      },
    ]);
    console.log(commissionsInfo, 'commissionsInfo');
    if (commissionsInfo.length === 0) return { totalCommission: 0 };

    return { totalCommission: commissionsInfo[0].totalCommission };
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => DisputeResponse)
  async handleAndUploadDisputDocs(
    @Args('collect_id', { type: () => String }) collect_id: string,
    @Args('action', { type: () => String }) action: Dispute_Actions,
    @Context() context: any,
    @Args('files', { type: () => [UploadedFile] })
    files: UploadedFile[],
    @Args('reason', { type: () => String, nullable: true }) reason?: string,
  ) {
    let uploadedFiles: Array<{ document_type: string; file_url: string }> = [];
    try {
      const trustee_id = context.req.trustee;
      const trustee = await this.trusteeModel.findById(trustee_id);
      if (!trustee) throw new NotFoundException('Trustee not found');
      // const collectObjectId = new Types.ObjectId(collect_id);
      const disputDetails = await this.DisputesModel.findOne({
        collect_id: collect_id,
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
                  const key = `trustee/${last4DigitsOfMs}_${disputDetails.dispute_id}_${sanitizedFileName}`;

                  const file_url = await this.awsS3Service.uploadToS3(
                    fileBuffer,
                    key,
                    contentType,
                    'disputes-docs',
                  );

                  return {
                    document_type: data.extension,
                    file_url,
                    name : data.name
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

     const dusputeUpdate =  await this.DisputesModel.findOneAndUpdate(
        { _id: disputDetails._id },
        {
          $push: { documents: { $each: uploadedFiles } },
          dispute_status: 'REQUEST_INITIATED',
        },
        { new: true },
      );

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

        if (!school_details) {
          throw new NotFoundException('School details not found');
        }
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
        //   client_id: school_details?.client_id || null,
        // });

        const { email, cc } = await this.trusteeService.getMails(disputDetails.school_id.toString(), "DISPUTE")

        const htmlBody = await this.trusteeService.generateDisputePDF(disputDetails)

        const subject = `A dispute has been raised against ${school_details.school_name}`

        await this.emailService.sendAlertMail2(
          subject,
          htmlBody,
          email,
          cc,
          dusputeUpdate.documents
        )

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

      // mail to trustee
      // const userMailSubject = `Dispute documents received for transaction id: ${disputDetails.collect_id}`;
      // const userMailTemplate = getDisputeReceivedEmailForUser(
      //   disputDetails.dispute_id,
      //   disputDetails.collect_id,
      //   action,
      //   reason,
      //   uploadedFiles,
      // );

      console.log('before return')

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
      console.log(error)
      throw new InternalServerErrorException(error.message);
    }
  }

  @UseGuards(TrusteeGuard)
  @Mutation(() => String)
  async testWebhook(
    @Context() context: any,
    @Args('url', { type: () => String }) url: string,
    @Args('type', { type: () => WebhookType }) type: WebhookType,
  ) {
    try {
      const trustee_id = context.req.trustee;
      const trusteeDetails = await this.trusteeModel.findById(trustee_id);
      if (!trusteeDetails) {
        throw new NotFoundException('Invalid Request');
      }
      if (!url) {
        throw new NotFoundException('Url Not Found');
      }
      const token = this.jwtService.sign({ trustee_id: trustee_id.toString() }, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });

      let base64Header = '';
      if (type === WebhookType.SETTLEMENTS) {
        const dummyData = {
          adjustment: "150.25",
          amount_settled: 1250.75,
          payment_amount: 1400.00,
          payment_from: "2024-12-01T10:00:00Z",
          payment_till: "2024-12-31T18:00:00Z",
          service_charge: 25.50,
          service_tax: 18.75,
          settled_on: "2024-09-18T10:11:39.630Z",
          settlement_amount: 1232.50,
          settlement_charge: 50.00,
          settlement_id: "SET123456789",
          settlement_initiated_on: "2024-12-30T12:00:00Z",
          status: "Completed",
          utr: "UTR987654321"
        };
        let webhook_key = trusteeDetails?.webhook_key || ""
        if (webhook_key) {
          base64Header = 'Basic ' + Buffer.from(webhook_key).toString('base64');
        }
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: url,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: base64Header,
          },
          data: dummyData
        };
        const res = await axios.request(config);
        // return res.data;
      }
      else if (type === WebhookType.REFUNDS) {
        const dummyData = {
          refund_id: "REF123456789",
          refund_amount: 1250.75,
          status_description: "Refund processed successfully",
          school_id: "123",
          order_id: "1254"
        };
        let webhook_key = trusteeDetails?.webhook_key || ""
        if (webhook_key) {
          base64Header = 'Basic ' + Buffer.from(webhook_key).toString('base64');
        }
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: url,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: base64Header,
          },
          data: dummyData,
        };
        const res = await axios.request(config);
        // return res.data;
      }
      else if (type === WebhookType.PAYMENTS) {
        const response = await this.trusteeService.testUrl(trustee_id, token, url)
        // return response.data;
      }
      return `Webhook hit successfully`;
    } catch (error) {
      throw new BadRequestException(error.message || 'Something went wrong');
    }
  }
}


export enum WebhookType {
  PAYMENTS = 'PAYMENTS',
  SETTLEMENTS = 'SETTLEMENTS',
  REFUNDS = 'REFUNDS',
}

registerEnumType(WebhookType, {
  name: 'WebhookType',
  description: 'Allowed webhook event types',
});




@ObjectType()
export class DisputeResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@ObjectType()
export class commisonStatsRes {
  @Field(() => Number, { nullable: true })
  totalCommission: number;
}

@ObjectType()
export class ReconRes {
  @Field(() => [Reconciliation], { nullable: true })
  reconciliation: Reconciliation[];

  @Field({ nullable: true })
  totalCount: number;

  @Field({ nullable: true })
  totalPages: number;
}

@ObjectType()
export class DisputesRes {
  @Field(() => [Disputes], { nullable: true })
  disputes: Disputes[];

  @Field({ nullable: true })
  totalCount: number;

  @Field({ nullable: true })
  totalPages: number;
}

@ObjectType()
export class batchTransactionsReport {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  total_order_amount: number;

  @Field({ nullable: true })
  total_transactions: number;

  @Field({ nullable: true })
  total_transaction_amount: number;

  @Field({ nullable: true })
  month: string;

  @Field({ nullable: true })
  year: string;

  @Field({ nullable: true })
  status: string;

  @Field({ nullable: true })
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;
}

@ObjectType()
export class ErpWebhooksLogs {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  response: string;

  @Field({ nullable: true })
  collect_id: string;

  @Field({ nullable: true })
  webhookType: string;

  @Field({ nullable: true })
  payload: string;

  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  webhook_url: string;

  @Field({ nullable: true })
  isSuccess: boolean;

  @Field({ nullable: true })
  status_code: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  createdAt: String;

  @Field({ nullable: true })
  updatedAt: String;

  @Field({ nullable: true })
  triggered_time: string;
}

@ObjectType()
export class ErpWebhooksLogsPaginatedResponse {
  @Field(() => [ErpWebhooksLogs], { nullable: true })
  erp_webhooks_logs: ErpWebhooksLogs[];

  @Field({ nullable: true })
  totalRecords: number;

  @Field({ nullable: true })
  page: number;
}

@ObjectType()
export class SettlementsTransactionsPaginatedResponse {
  @Field(() => [SettlementsTransactions], { nullable: true })
  settlements_transactions: SettlementsTransactions[];

  @Field({ nullable: true })
  limit: number;

  @Field({ nullable: true })
  cursor: string;
}

@ObjectType()
export class SettlementsTransactions {
  @Field({ nullable: true })
  custom_order_id: string;

  @Field({ nullable: true })
  order_id: string;

  @Field({ nullable: true })
  event_status: string;

  @Field({ nullable: true })
  event_settlement_amount: number;

  @Field({ nullable: true })
  order_amount: number;

  @Field({ nullable: true })
  event_amount: number;

  @Field({ nullable: true })
  event_time: string;

  @Field({ nullable: true })
  payment_group: string;

  @Field({ nullable: true })
  settlement_utr: string;

  @Field({ nullable: true })
  student_id: string;

  @Field({ nullable: true })
  school_name: string;

  @Field({ nullable: true })
  student_name: string;

  @Field({ nullable: true })
  student_email: string;

  @Field({ nullable: true })
  student_phone_no: string;

  @Field({ nullable: true })
  school_id: string;
}

@ObjectType()
export class VendorsSettlementReportPaginatedResponse {
  @Field(() => [VendorsSettlementReport], { nullable: true })
  vendor_settlements: VendorsSettlementReport[];

  @Field({ nullable: true })
  totalCount: number;

  @Field({ nullable: true })
  page: number;

  @Field({ nullable: true })
  totalPages: number;

  @Field({ nullable: true })
  limit: number;
}

@ObjectType()
export class VendorsSettlementReport {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  vendor_id: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  client_id: string;

  @Field({ nullable: true })
  utr: string;

  @Field({ nullable: true })
  adjustment: number;

  @Field({ nullable: true })
  settlement_amount: number;

  @Field({ nullable: true })
  net_settlement_amount: number;

  @Field({ nullable: true })
  vendor_transaction_amount: number;

  @Field({ nullable: true })
  payment_from: Date;

  @Field({ nullable: true })
  payment_till: Date;

  @Field({ nullable: true })
  settled_on: Date;

  @Field({ nullable: true })
  settlement_id: string;

  @Field({ nullable: true })
  settlement_initiated_on: Date;

  @Field({ nullable: true })
  status: string;

  @Field({ nullable: true })
  school_name: string;

  @Field({ nullable: true })
  vendor_name: string;

  @Field({ nullable: true })
  createdAt: Date;

  @Field({ nullable: true })
  updatedAt: Date;
}

@ObjectType()
export class VendorsTransactionPaginatedResponse {
  @Field(() => [VendorTransaction], { nullable: true })
  vendorsTransaction: VendorTransaction[];

  @Field({ nullable: true })
  totalCount: number;

  @Field({ nullable: true })
  page: number;

  @Field({ nullable: true })
  totalPages: number;

  @Field({ nullable: true })
  limit: number;
}

@ObjectType()
export class VendorSingleTransaction {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  collect_id: string;

  @Field({ nullable: true })
  custom_id: string;

  @Field({ nullable: true })
  name: string;

  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  status: string;

  @Field({ nullable: true })
  amount: number;

  @Field({ nullable: true })
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;

  @Field({ nullable: true })
  gateway: string;

  @Field({ nullable: true })
  additional_data: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  custom_order_id: string;

  @Field({ nullable: true })
  payment_method: string;

  @Field({ nullable: true })
  bank_reference: string;

  @Field({ nullable: true })
  transaction_amount: string;

  @Field({ nullable: true })
  payment_detail: string;

  @Field({ nullable: true })
  details: string;
}

@ObjectType()
export class VendorTransaction {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  collect_id: string;

  @Field({ nullable: true })
  custom_id: string;

  @Field({ nullable: true })
  name: string;

  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  status: string;

  @Field({ nullable: true })
  amount: number;

  @Field({ nullable: true })
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;

  @Field({ nullable: true })
  transaction_amount: number;

  @Field({ nullable: true })
  payment_method: string;

  @Field({ nullable: true })
  gateway: string;

  @Field({ nullable: true })
  additional_data: string;

  @Field({ nullable: true })
  custom_order_id: string;

  @Field({ nullable: true })
  schoolName: string;
}

@ObjectType()
export class vendorBanksInfoRes {
  @Field({ nullable: true })
  account_holder: string;

  @Field({ nullable: true })
  account_number: string;

  @Field({ nullable: true })
  ifsc: string;
}

@ObjectType()
export class VendorsResponse {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  vendor_id: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  name: string;

  @Field({ nullable: true })
  email: string;

  @Field({ nullable: true })
  phone: string;

  @Field({ nullable: true })
  bank_details: vendorBanksInfoRes;

  @Field({ nullable: true })
  kyc_info: kyc_details;

  @Field({ nullable: true })
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;

  @Field({ nullable: true })
  status: string;
}

@ObjectType()
export class VendorsPaginationResponse {
  @Field(() => [VendorsResponse])
  vendors: VendorsResponse[];

  @Field(() => Int)
  totalPages: number;

  @Field(() => Int)
  currentPage: number;
}

@ObjectType()
class RefundRequestRes {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;

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
  school_name: string;

  @Field({ nullable: true })
  custom_id: string;

  @Field({ nullable: true })
  reason: string;
}

@ObjectType()
class InvoiceResponse {
  @Field({ nullable: true })
  _id: string;

  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  invoice_details: InvoiceData;

  @Field({ nullable: true })
  invoice_status: string;

  @Field({ nullable: true })
  invoice_date: string;

  @Field({ nullable: true })
  invoice_no: string;

  @Field({ nullable: true })
  invoice_url: string;

  @Field({ nullable: true })
  createdAt: string;

  @Field({ nullable: true })
  reason: string;

  @Field({ nullable: true })
  duration: string;
}

@ObjectType()
class GetRemarkResponse {
  @Field()
  collect_id: string;

  @Field()
  trustee_id: string;

  @Field()
  remarks: string;
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
export class AuthResponse {
  @Field(() => String)
  token: string;
}

@ObjectType()
export class resetPassResponse {
  @Field()
  msg: string;
}
@ObjectType()
export class verifyRes {
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
  @Field({ nullable: true })
  gstIn: string;
  @Field({ nullable: true })
  residence_state: string;
  @Field({ nullable: true })
  bank_details: bankDetails;
  @Field({ nullable: true })
  webhook_key: string;
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
  phone_number: string;

  @Field(() => String, { nullable: true })
  merchantStatus: string;

  @Field(() => [String], { nullable: true })
  disabled_modes: [string];

  @Field(() => [PlatformCharge], { nullable: true })
  platform_charges: [PlatformCharge];

  @Field(() => Date, { nullable: true })
  updatedAt: Date;

  @Field(() => String, { nullable: true })
  gstIn: string;

  @Field(() => String, { nullable: true })
  residence_state: string;

  @Field(() => bank_Details, { nullable: true })
  bank_details: bank_Details;
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
class Vendor {
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
class Error_Details {
  @Field({ nullable: true })
  error_description?: string;

  @Field({ nullable: true })
  error_reason?: string;

  @Field({ nullable: true })
  error_source?: string;
}

@ObjectType()
export class TransactionReport {
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
  isAutoRefund: boolean;
  @Field({ nullable: true })
  isQRPayment: boolean;
  @Field({ nullable: true })
  commission: number;
  @Field({ nullable: true })
  custom_order_id?: string;
  @Field({ nullable: true })
  payment_time?: string;
  @Field(() => [Vendor], { nullable: true })
  vendors_info?: [Vendor];
  @Field({ nullable: true })
  reason?: string;
  @Field({ nullable: true })
  gateway?: string;
  @Field({ nullable: true })
  capture_status?: string;
  @Field({ nullable: true })
  virtual_account_id?: string;
  @Field({ nullable: true })
  virtual_account_number?: string;
  @Field({ nullable: true })
  virtual_account_ifsc?: string;
  @Field({ nullable: true })
  error_details?: Error_Details;
  @Field({ nullable: true })
  isVBAPaymentComplete: boolean;
}

@ObjectType()
export class TransactionReportResponsePaginated {
  @Field(() => [TransactionReport], { nullable: true })
  transactionReport: [TransactionReport];

  @Field({ nullable: true })
  total_pages: number;

  @Field({ nullable: true })
  current_page: number;
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

@ObjectType()
class RefundResponse {
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

  @Field(() => String, { nullable: true })
  base_charge_type: charge_type;

  @Field(() => Number, { nullable: true })
  base_charge: number;

  @Field(() => String, { nullable: true })
  commission: string;

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

@ObjectType()
class SettlementUtr {
  @Field({ nullable: true })
  settlement_date: string;
  @Field({ nullable: true })
  utr_number: string;
  @Field({ nullable: true })
  status: string;
}

@ObjectType()
class Commissionresponse {
  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  platform_type: string;

  @Field({ nullable: true })
  collect_id: string;

  @Field({ nullable: true })
  trustee_id: string;

  @Field({ nullable: true })
  commission_amount: number;

  @Field({ nullable: true })
  createdAt: string;

  @Field({ nullable: true })
  updatedAt: string;

  @Field({ nullable: true })
  payment_mode: string;
}

@ObjectType()
export class Commissionres {
  @Field({ nullable: true })
  totalCommission: number;
}

@ObjectType()
class SchoolMDRINFO {
  @Field({ nullable: true })
  school_id: string;

  @Field({ nullable: true })
  school_name: string;

  @Field({ nullable: true })
  requestUpdatedAt: string;

  @Field({ nullable: true })
  merchantStatus: string;

  @Field(() => [PlatformCharge], { nullable: true })
  baseMdr: PlatformCharge[];

  @Field(() => [PlatformCharge], { nullable: true })
  schoolMdr: PlatformCharge[];
}

const test = {
  status: '1',
  data: {
    hash: 'ee41f254f93f20709e5e7ac798426981e0d7c8f1c2b82509fa8d1756ccd530ac46ec22b986413e2504d82219c3825d9c9aca7722f798451460bd5a4215483e13',
    udf1: null,
    udf2: null,
    udf3: null,
    udf4: null,
    udf5: null,
    udf6: null,
    udf7: null,
    txnid: 'upi_67adc37c944c98402d6d112d',
    easepayid: 'E2502130D7XCF3',
    refund_id: 'RU6W1MGG64',
    arn_number: '504542487412',
    refund_amount: 1.0,
    refund_status: 'accepted',
    transaction_date: '2025-02-13 15:33:40.000000',
    transaction_type: 'UPI',
    merchant_refund_id: 'E2502130D7XCF3-17394414',
    transaction_amount: 1.0,
    refund_request_date: '2025-02-13 15:40:50.308912',
    chargeback_description: '',
  },
};
