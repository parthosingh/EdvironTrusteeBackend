import {
  UnauthorizedException,
  UseGuards,
  BadRequestException,
  NotFoundException,
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
  DisputesRes,
  RefundRequestRes,
  TransactionReportResponsePaginated,
} from 'src/trustee/trustee.resolver';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { SubTrustee } from 'src/schema/subTrustee.schema';
import { RefundRequest } from 'src/schema/refund.schema';
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
  ) {}

  @Mutation(() => Boolean)
  async subTrusteeLogin(
    @Args('email') email_id: string,
    @Args('password') password_hash: string,
  ): Promise<Boolean> {
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

  @Query(() => SubTrusteeuser)
  async getSubTrusteeQuery(@Context() context: any): Promise<SubTrusteeuser> {
    try {
      const token = context.req.headers.authorization.split(' ')[1];
      const userSubTrustee =
        await this.subTrusteeService.validateMerchant(token);
      console.log(userSubTrustee, 'merchant');
      const user: SubTrusteeuser = {
        _id: userSubTrustee.id,
        name: userSubTrustee.name,
        email: userSubTrustee.email,
        role: userSubTrustee.role,
        phone: userSubTrustee.phone,
        trustee_id: userSubTrustee.trustee_id,
        logo: userSubTrustee.trustee_logo || null,
      };
      return user;
    } catch (error) {
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
      console.log(school_id);
      let id = context.req.subtrustee;
      console.time('mapping merchant transaction');
      const merchants = await this.trusteeSchoolModel.find({
        sub_trustee_id: id,
      });
      const schoolIds = merchants.map((school) => school.school_id);
      // console.log(schoolIds, "schoolIds")
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
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-subtrustee-report/?limit=${limit}&startDate=${first}&endDate=${last}&page=${page}&status=${status}`,
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
          school_ids: schoolIds,
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
  @Query(() => [TrusteeSchool])
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
        subTrusteeData.trustee_id.toString(),
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
        .select('school_id -_id');

      let searchFilter: any = {
        trustee_id: context.req.trustee,
        school_id: { $in: schools.map((school) => school.school_id) },
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
