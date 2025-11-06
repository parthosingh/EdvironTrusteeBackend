import {
  UnauthorizedException,
  UseGuards,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Query,
  Args,
  Context,
  Field,
  ID,
  Mutation,
  ObjectType,
  Resolver,
  Int,
} from '@nestjs/graphql';
import { SubTrusteeService } from './sub-trustee.service';
import mongoose, { ObjectId, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { SettlementReport } from 'src/schema/settlement.schema';
import { SubTrusteeGuard } from './sub-trustee.guard';
import { TrusteeSchool } from 'src/schema/school.schema';
import {
  batchTransactionsReport,
  DisputesRes,
  getSchool,
  RefundRequestRes,
  resetPassResponse,
  SettlementsTransactionsPaginatedResponse,
  TransactionReport,
  TransactionReportResponsePaginated,
  VendorSingleTransaction,
  VendorsSettlementReportPaginatedResponse,
  VendorsTransactionPaginatedResponse,
  verifyRes,
} from 'src/trustee/trustee.resolver';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { SubTrustee } from 'src/schema/subTrustee.schema';
import { RefundRequest } from 'src/schema/refund.schema';
import { TrusteeService } from 'src/trustee/trustee.service';
import { MerchantMember } from 'src/schema/merchant.member.schema';
import { VirtualAccount } from 'src/schema/virtual.account.schema';
import { Trustee } from 'src/schema/trustee.schema';
import { VendorsSettlement } from 'src/schema/vendor.settlements.schema';

@ObjectType()
class SubTrusteeTokenResponse {
  @Field()
  token: string;
}

@Resolver('Sub_Trustee')
export class SubTrusteeResolver {
  constructor(
    @InjectModel(SettlementReport.name)
    private settlementReportModel: mongoose.Model<SettlementReport>,
    @InjectModel(SubTrustee.name)
    private subTrustee: mongoose.Model<SubTrustee>,
    private readonly subTrusteeService: SubTrusteeService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    private readonly jwtService: JwtService,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
    @InjectModel(MerchantMember.name)
    private merchantMemberModel: mongoose.Model<MerchantMember>,
    @InjectModel(VirtualAccount.name)
    private virtualAccountModel: mongoose.Model<VirtualAccount>,
    @InjectModel(Trustee.name)
    private trsuteeModel: mongoose.Model<Trustee>,
    @InjectModel(VendorsSettlement.name)
    private vendorsSettlementModel: mongoose.Model<VendorsSettlement>,
    private readonly trusteeService: TrusteeService,
  ) { }

  @Mutation(() => loginToken)
  async subTrusteeLogin(
    @Args('email') email_id: string,
    @Args('password') password_hash: string,
  ) {
    try {
      return await this.subTrusteeService.loginAndGenerateToken(
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
  async validatesubTrusteeLoginOtp(
    @Args('otp') otp: string,
    @Args('email') email: string,
  ): Promise<string> {
    try {
      return await this.subTrusteeService.validateLoginOtp(otp, email);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @UseGuards(SubTrusteeGuard)
  @Query(() => SubTrusteeuser)
  async getSubTrusteeQuery(@Context() context: any): Promise<SubTrusteeuser> {
    try {
      console.log('test');

      let id = context.req.subtrustee;
      const userSubTrustee = await this.subTrustee.findById(id);
      if (!userSubTrustee) {
        throw new BadRequestException('Invalid user');
      }
      console.log(userSubTrustee, 'merchant');
      const user: SubTrusteeuser = {
        _id: userSubTrustee.id,
        name: userSubTrustee.name,
        email: userSubTrustee.email,
        role: 'owner',
        phone: userSubTrustee.phone,
        trustee_id: userSubTrustee.trustee_id,
        logo: null,
      };
      return user;
    } catch (error) {
      console.log(error);

      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  @Query(() => [SettlementReport])
  @UseGuards(SubTrusteeGuard)
  async getSettlementReportsSubTrustee(@Context() context) {
    try {
      let id = context.req.subtrustee;
      const schools = await this.trusteeSchoolModel.find({
        sub_trustee_id: { $in: [id] },
      });
      console.log(schools);

      const schoolIds = schools.map((school) => school.school_id);
      const settlementReports = await this.settlementReportModel.aggregate([
        {
          $match: {
            schoolId: { $in: schoolIds },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $project: {
            _id: 1,
            settlementAmount: 1,
            adjustment: 1,
            netSettlementAmount: 1,
            fromDate: 1,
            settlementInitiatedOn: 1,
            tillDate: 1,
            settlement_initiated_on: 1,
            status: 1,
            utrNumber: 1,
            settlementDate: 1,
            clientId: 1,
            remarks: 1,
            trustee: 1,
            schoolId: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);
      return settlementReports;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Query(() => TransactionReportResponsePaginated)
  @UseGuards(SubTrusteeGuard)
  async getSubtrusteeTransactionReport(
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
      // console.log(school_id)
      let id = context.req.subtrustee;
      let trusteeId = context.req.trustee;
      console.log(trusteeId, 'trusteeId');
      console.time('mapping merchant transaction');
      const merchants = await this.trusteeSchoolModel.find({
        sub_trustee_id: id,
      });
      let schoolIds = merchants.map((school) => school.school_id);

      if (school_id) {
        let find = schoolIds.filter((id) => id.toString() === school_id);

        if (!find) {
          throw new BadRequestException('Invalid school ID');
        }
        schoolIds = find;
      }

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
        { trustee_id: trusteeId },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-subtrustee-report/?limit=${limit}&startDate=${first}&endDate=${last}&page=${page}&status=${status}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: trusteeId,
          token,
          searchParams,
          isCustomSearch,
          seachFilter: searchFilter,
          payment_modes,
          isQRCode,
          gateway,
          school_id: schoolIds,
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

  @UseGuards(SubTrusteeGuard)
  @Query(() => VendorsTransactionPaginatedResponse)
  async getAllSubtrusteeVendorTransaction(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
    @Args('startDate', { type: () => String, nullable: true })
    startDate?: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('vendor_id', { type: () => String, nullable: true })
    vendor_id?: string,
    @Args('school_id', {
      type: () => [String],
      nullable: true,
      defaultValue: null,
    })
    school_id?: string[],
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
      console.log(order_id, 'school_id');
      const trustee_id = context.req.trustee;
      const subTrustee = context.req.subtrustee;
      const schools = await this.trusteeSchoolModel.find({
        sub_trustee_id: { $in: [subTrustee] },
      });
      let school_ids = schools.map((school) => school.school_id.toString());
      if (school_id && school_id.length > 0) {
        school_ids = school_ids.filter((id) => school_id.includes(id));
      }
      return this.subTrusteeService.getAllVendorTransactions(
        trustee_id.toString(),
        page,
        limit,
        status,
        vendor_id,
        school_ids,
        startDate,
        endDate,
        custom_id,
        order_id,
        payment_modes,
        gateway,
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(SubTrusteeGuard)
  @Query(() => getSchool)
  async getSubTrusteeSchools(
    @Context() context: any,
    @Args('searchQuery', { nullable: true, defaultValue: null })
    searchQuery?: string,
    @Args('page', { nullable: true, defaultValue: 1 }) page?: number,
    @Args('limit', { nullable: true, defaultValue: 10 }) limit?: number,
    @Args('kycStatus', { type: () => [String], nullable: true })
    kycStatus?: string[],
  ) {
    try {
      const subTrustee = context.req.subtrustee;
      const subTrusteeData = await this.subTrustee.findById(subTrustee);
      if (!subTrusteeData) {
        throw new NotFoundException('Sub Trustee not found');
      }
      const schools = await this.subTrusteeService.getSubTrusteeSchools(
        subTrustee.toString(),
        page,
        limit,
        searchQuery,
        kycStatus,
      );

      return {
        schools: schools.schoolData,
        total_pages: schools.pagination.totalPages,
        page: schools.pagination.currentPage,
        totalItems: schools.pagination.totalItems,
      };
    } catch (error) {
      if (error?.response?.data?.message) {
        throw new BadRequestException(error?.response?.data?.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(SubTrusteeGuard)
  @Query(() => RefundRequestRes)
  async getSubTrusteeRefundRequest(
    @Context() context: any,
    @Args('page', { nullable: true, defaultValue: 1 }) page?: number,
    @Args('limit', { nullable: true, defaultValue: 10 }) limit?: number,
    @Args('searchQuery', { nullable: true, defaultValue: null })
    searchQuery?: string,
    @Args('status', { nullable: true, defaultValue: null }) status?: string,
    @Args('school_id', {
      type: () => [String],
      nullable: true,
      defaultValue: null,
    })
    school_id?: string[],
    @Args('startDate', { type: () => String, nullable: true })
    startDate?: string,
    @Args('endDate', { type: () => String, nullable: true }) endDate?: string,
  ) {
    try {
      const subTrustee = context.req.subtrustee;
      const subTrusteeData = await this.subTrustee.findById(subTrustee);
      if (!subTrusteeData) {
        throw new NotFoundException('Sub Trustee not found');
      }
      const pageNumber = page || 1;
      const pageSize = limit || 10;
      const skip = (pageNumber - 1) * pageSize;
      let schoolFilter: any = {
        trustee_id: context.req.trustee,
        sub_trustee_id: { $in: [new Types.ObjectId(subTrustee)] },
      };

      const schools = await this.trusteeSchoolModel
        .find(schoolFilter)
        .select('school_id _id');

      let searchFilter: any = {
        trustee_id: context.req.trustee,
        school_id: { $in: schools.map((school) => school._id) },
        ...(searchQuery
          ? Types.ObjectId.isValid(searchQuery)
            ? {
              $or: [
                { order_id: new mongoose.Types.ObjectId(searchQuery) },
                { _id: new mongoose.Types.ObjectId(searchQuery) },
              ],
            }
            : {
              $or: [
                { status: { $regex: searchQuery, $options: 'i' } },
                { reason: { $regex: searchQuery, $options: 'i' } },
                { custom_id: { $regex: searchQuery, $options: 'i' } },
                { gatway_refund_id: { $regex: searchQuery, $options: 'i' } },
              ],
            }
          : {}),
      };
      if (!searchQuery && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        searchFilter = {
          ...searchFilter,
          createdAt: {
            $gte: start,
            $lte: end,
          },
        };
      }

      if (status) {
        searchFilter = {
          ...searchFilter,
          status: { $regex: status, $options: 'i' },
        };
      }
      if (school_id && school_id.length > 0) {
        const schoolIds = school_id.map((e) => new Types.ObjectId(e));
        const matchedSchools = await Promise.all(
          schoolIds.map((id) =>
            this.trusteeSchoolModel.findOne({ school_id: id }, { _id: 1 }),
          ),
        );
        const schoolObjectIds = matchedSchools
          .filter(Boolean)
          .map((school) => school._id);

        searchFilter = {
          ...searchFilter,
          school_id: { $in: schoolObjectIds },
        };
      }
      const countAggregation = await this.refundRequestModel.aggregate([
        { $match: searchFilter },
        {
          $lookup: {
            from: 'trusteeschools',
            localField: 'school_id',
            foreignField: '_id',
            as: 'result',
          },
        },
        { $unwind: '$result' },
        { $count: 'total' },
      ]);
      const totalItems = countAggregation[0]?.total || 0;
      const totalPages = Math.ceil(totalItems / pageSize);

      const refunds = await this.refundRequestModel.aggregate([
        { $match: searchFilter },
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
        {
          $skip: skip,
        },
        {
          $limit: pageSize,
        },
      ]);
      // console.log(refunds, 'refunds');
      return {
        refund: Array.isArray(refunds) ? refunds : [],
        currentPage: pageNumber,
        totalPages: totalPages,
        totalItems: totalItems,
      };
    } catch (e) {
      console.error(e);
      throw new BadRequestException('Error fetching refund requests');
    }
  }

  @UseGuards(SubTrusteeGuard)
  @Query(() => DisputesRes)
  async getSubTrusteeDisputes(
    @Context() context: any,
    @Args('page', { type: () => Int, defaultValue: 0 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
    @Args('school_id', { type: () => [String], nullable: true })
    school_id: string[],
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
      return this.subTrusteeService.getDisputes(
        context.req.subtrustee,
        context.req.trustee,
        page,
        limit,
        school_id,
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

  @UseGuards(SubTrusteeGuard)
  @Mutation(() => String)
  async generateMerchantLoginTokenForSubtrustee(
    @Context() context: any,
    @Args('email') email: string,
  ): Promise<string> {
    try {
      const merchant = await this.trusteeSchoolModel.findOne({
        email,
        sub_trustee_id: { $in: [context.req.subtrustee] },
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

  @Query(() => [TransactionReport])
  @UseGuards(SubTrusteeGuard)
  async getSingleTransactionReportForSubTrustee(
    @Context() context,
    @Args('collect_id') collect_id: string,
    @Args('school_id', { nullable: true }) school_id?: string,
    @Args('isVBAPaymentComplete', { nullable: true, defaultValue: false })
    isVBAPaymentComplete?: boolean,
  ) {
    try {
      const trustee_id = context.req.trustee;
      const subTrsutee = context.req.subtrustee;
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
        vbaPayment = await this.virtualAccountModel.findOne({
          collect_id: collect_id,
        });
        if (!vbaPayment) {
          throw new BadRequestException('vba payment not found');
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

  @Mutation(() => verifyRes)
  async resetMailsSubtrustee(@Args('email') email: string) {
    const subTrustee = await this.subTrustee.findOne({ email_id: email });
    if (!subTrustee) {
      throw new BadRequestException('Invalid Email');
    }
    await this.subTrusteeService.sentResetMail(email);
    return { active: true };
  }

  // reset password
  @Mutation(() => resetPassResponse)
  async resetPasswordSubtrustee(
    @Args('email') email: string,
    @Args('password') password: string,
  ) {
    await this.subTrusteeService.resetPassword(email, password);
    return { msg: `Password Change` };
  }

  @Query(() => verifyRes)
  async verifyToken(@Args('token') token: string) {
    const res = await this.trusteeService.verifyresetToken(token);
    return { active: res };
  }

  @UseGuards(SubTrustee)
  @Query(() => SubTrusteeTokenResponse)
  async kycLoginToken(
    @Args('school_id') school_id: string,
    @Context() context,
  ) {
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

  // @UseGuards(SubTrusteeGuard)
  // @Mutation(() => String)
  // async generateMerchantLoginToken(
  //   @Args('email') email: string,
  //   @Context() context,
  // ): Promise<string> {
  //   try {
  //     const merchant = await this.trusteeSchoolModel.findOne({
  //       email,
  //       sub_trustee_id: { $in: [context.req.subtrustee] },
  //     });

  //     if (merchant) {
  //       return this.trusteeService.generateToken(merchant._id);
  //     }
  //     const member = await this.merchantMemberModel.findOne({ email });
  //     if (member) {
  //       return this.trusteeService.generateToken(member._id);
  //     }
  //     throw new NotFoundException('Email not found');
  //   } catch (error) {
  //     throw new Error(error.message);
  //   }
  // }

  @UseGuards(SubTrusteeGuard)
  @Query(() => VendorsSettlementReportPaginatedResponse)
  async getAllSubtrusteeVendorSettlementReport(
    @Args('page', { type: () => Int }) page: number,
    @Args('limit', { type: () => Int }) limit: number,
    @Context() context: any,
    @Args('start_date', { type: () => String, nullable: true })
    start_date?: string,
    @Args('end_date', { type: () => String, nullable: true }) end_date?: string,
    @Args('utr', { type: () => String, nullable: true })
    utr?: string,
    @Args('school_id', { type: () => [String], nullable: true })
    school_id?: string[],
    @Args('vendor_id', { type: () => String, nullable: true })
    vendor_id?: string,
  ) {
    const trusteeId = context.req.trustee;
    const subTrustee = context.req.subtrustee;
    const schools = await this.trusteeSchoolModel.find({
      sub_trustee_id: { $in: [subTrustee] },
    });

    let school_ids: any = schools.map((school) => school.school_id.toString());
    if (school_id && school_id.length > 0) {
      school_ids = school_ids.filter((id) => school_id.includes(id));
    }

    school_ids = school_ids.map((id) => new Types.ObjectId(id));
    const query = {
      trustee_id: trusteeId,
      ...(school_ids && { school_id: { $in: school_ids } }),
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

  @UseGuards(SubTrusteeGuard)
  @Query(() => SubTrusteeDashboard)
  async getSubTrusteeBatchTransactions(
    @Args('year') year: string,
    @Context() context: any,
  ) {
    try {
      const subTrusteeId = context.req.subtrustee;
      const trusteeId = context.req.trustee;
      console.log({ subTrusteeId, trusteeId });

      const schoolIds = await this.subTrusteeService.getSubTrusteeSchoolIds(
        subTrusteeId.toString(),
        trusteeId.toString(),
      );
      console.log(schoolIds);
      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/fetch-subtrustee-batch-transactions`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          school_ids: schoolIds,
          year,
        },
      };
      const response = await axios.request(config);
      console.log(response.data);
      return response.data;
    } catch (e) {
      // console.log(e);

      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(SubTrusteeGuard)
  @Query(() => String)
  async getSubTrusteeTransactionSum(
    @Context() context: any,
    @Args('startDate', { type: () => String, nullable: true })
    startDate?: string,
    @Args('endDate', { type: () => String, nullable: true })
    endDate?: string,
    @Args('status', { type: () => String, nullable: true })
    status?: string,
    @Args('gateway', { type: () => [String], nullable: true }) // ✅ array of strings
    gateway?: string[],
    @Args('school_ids', { type: () => [String], nullable: true }) // ✅ array of strings
    school_ids?: string[],
    @Args('mode', { type: () => [String], nullable: true }) // ✅ array of strings
    mode?: string[],
    @Args('isqrpayment', { type: () => Boolean, nullable: true }) // ✅ boolean
    isqrpayment?: boolean,
  ) {
    try {
      const subTrusteeId = context.req.subtrustee;
      const trusteeId = context.req.trustee;
      console.log({ subTrusteeId, trusteeId });
      let filtered_school_ids = school_ids || [];
      if (!filtered_school_ids || filtered_school_ids.length === 0) {
        const schoolIds = await this.subTrusteeService.getSubTrusteeSchoolIds(
          subTrusteeId.toString(),
          trusteeId.toString(),
        );
        filtered_school_ids = schoolIds;
      }
      console.log(filtered_school_ids);

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/sub-trustee-transactions-sum`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: trusteeId,
          school_id: filtered_school_ids,
          gateway: gateway,
          start_date: startDate,
          end_date: endDate,
          status: status,
          mode: mode,
          isQRPayment: isqrpayment,
        },
      };
      const response = await axios.request(config);
      console.log(response.data);
      return JSON.stringify(response.data);
    } catch (e) {
      console.log(e);

      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(SubTrusteeGuard)
  @Query(() => SettlementsTransactionsPaginatedResponse)
  async getSubtrusteeSettlementsTransactions(
    @Args('utr', { type: () => String }) utr: string,
    @Context() context: any,
    @Args('limit', { type: () => Int }) limit: number,
    @Args('cursor', { type: () => String, nullable: true })
    cursor: string | null,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
  ) {
    try {
      // console.log('test');

      const settlement = await this.settlementReportModel.findOne({
        utrNumber: utr,
      });

      if (settlement.trustee.toString() !== context.req.trustee.toString()) {
        throw new ForbiddenException(
          'You are not authorized to access this settlement',
        );
      }
      if (!settlement) {
        throw new Error('Settlement not found');
      }

      if (settlement.gateway && settlement.gateway === 'EDVIRON_PAY_U') {
        console.log('gateway pay-us');

        return await this.trusteeService.getPayuSettlementRecon(
          utr,
          settlement.schoolId.toString(),
        );
      }
      const client_id = settlement.clientId;
      const razorpay_id = settlement.razorpay_id;
      if (client_id) {
        console.log('check cashfree');

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
      const school = await this.trusteeSchoolModel.findOne({
        school_id: settlement.schoolId,
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }
      console.log('here');
      if (
        school.isEasebuzzNonPartner &&
        school.easebuzz_non_partner.easebuzz_key &&
        school.easebuzz_non_partner.easebuzz_salt &&
        school.easebuzz_non_partner.easebuzz_submerchant_id
      ) {
        console.log('settlement from date');
        const settlements = await this.settlementReportModel
          .find({
            schoolId: settlement.schoolId,
            settlementDate: { $lt: settlement.settlementDate },
          })
          .sort({ settlementDate: -1 })
          .select('settlementDate')
          .limit(2);
        let previousSettlementDate = settlements[1]?.settlementDate;
        if (!previousSettlementDate) {
          console.log('No previous settlement date found');
          const date = new Date(settlement.settlementDate); // clone date
          date.setDate(date.getDate() - 4);
          previousSettlementDate = date;
        }
        const formatted_start_date =
          await this.trusteeService.formatDateToDDMMYYYY(
            previousSettlementDate,
          );
        console.log({ formatted_start_date }); // e.g. 06-09-2025

        const formatted_end_date =
          await this.trusteeService.formatDateToDDMMYYYY(
            settlement.settlementDate,
          );
        console.log({ formatted_end_date }); // e.g. 06-09-2025
        const paginatioNPage = page || 1;
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
          cursor,
        );

        return res;
      }
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(SubTrusteeGuard)
  @Query(() => VendorSingleTransaction)
  async getSingleSubtrusteeVendorTransaction(
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

  @UseGuards(SubTrusteeGuard)
  @Query(() => [batchTransactionsReport])
  async getSubtrusteeBatchTransactionReport(
    @Args('year') year: string,
    @Context() context: any,
  ) {
    const subTrusteeId = context.req.subtrustee;
    let trusteeId = context.req.trustee;

    try {
      const schoolIds =
        (await this.subTrusteeService.getSubTrusteeSchoolIds(
          subTrusteeId,
          trusteeId,
        )) || [];
      return await this.subTrusteeService.getSubtrusteeBatchTransactions(
        schoolIds,
        year,
        subTrusteeId
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }
  @UseGuards(SubTrusteeGuard)
  @Query(() => transactionV2)
  async getSubTrusteeTransactionSummary(
    @Context() context: any,
    @Args('startDate', { type: () => String, nullable: true })
    startDate?: string,
    @Args('endDate', { type: () => String, nullable: true })
    endDate?: string,
    @Args('status', { type: () => String, nullable: true }) status?: string,
    @Args('isQRPayment', { type: () => Boolean, nullable: true })
    isQRPayment?: boolean,
    @Args('mode', { type: () => [String], nullable: true }) mode?: string[],
    @Args('gateway', { type: () => [String], nullable: true })
    gateway?: string[],
    @Args('school_ids', { type: () => [String], nullable: true })
    school_ids?: string[],
  ): Promise<transactionV2> {
    try {
      const subTrusteeId = context.req.subtrustee;
      const trusteeId = context.req.trustee;
      let filtered_school_ids = school_ids || [];
      if (!filtered_school_ids || filtered_school_ids.length === 0) {
        const schoolIds = await this.subTrusteeService.getSubTrusteeSchoolIds(
          subTrusteeId.toString(),
          trusteeId.toString(),
        );
        filtered_school_ids = schoolIds;
      }

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-transaction-report-batched-v2`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: trusteeId,
          school_id: filtered_school_ids,
          gateway: gateway,
          start_date: startDate,
          end_date: endDate,
          status: status,
          mode: mode,
          isQRPayment: isQRPayment,
        },
      };
      const response = await axios.request(config);
      return {
        length: response.data.length || 0,
        transaction: response.data.transactions || [],
      };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }
}

@ObjectType()
class TRANSACTION {
  @Field({ nullable: true })
  totalTransactionAmount: number;

  @Field({ nullable: true })
  totalOrderAmount: number;

  @Field({ nullable: true })
  totalTransactions: number;
}

@ObjectType()
export class transactionV2 {
  @Field(() => Number)
  length: number;

  @Field(() => [TRANSACTION])
  transaction: TRANSACTION[];
}

@ObjectType()
export class SubTrusteeDashboard {
  @Field(() => Number)
  total_order_amount: number;

  @Field(() => Number)
  total_transaction_amount: number;

  @Field(() => Number)
  total_transactions: number;
}

@ObjectType()
export class loginToken {
  @Field(() => String)
  token: string;
}

@ObjectType()
export class SubTrusteeuser {
  @Field(() => ID)
  _id: ObjectId;

  @Field(() => String)
  name: string;

  @Field(() => String)
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  logo?: string;

  @Field(() => String, { nullable: true })
  role?: string;

  @Field(() => ID)
  trustee_id: ObjectId;
}
