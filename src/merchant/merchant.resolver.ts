/* eslint-disable @typescript-eslint/ban-types */

import {
  BadRequestException,
  ConflictException,
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
  Resolver,
} from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { TrusteeSchool } from 'src/schema/school.schema';
import { SettlementReport } from 'src/schema/settlement.schema';
import { MerchantGuard } from './merchant.guard';
import axios from 'axios';
import { MerchantService } from './merchant.service';
import {
  AuthResponse,
  resetPassResponse,
  verifyRes,
} from 'src/trustee/trustee.resolver';
import { MerchantMember } from '../schema/merchant.member.schema';
import { Access } from '../schema/merchant.member.schema';
import { Trustee } from 'src/schema/trustee.schema';
import { TransactionInfo } from 'src/schema/transaction.info.schema';
import { TrusteeService } from 'src/trustee/trustee.service';

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
    private readonly trusteeService: TrusteeService,
  ) {}

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
      console.log(userMerchant,'merchant');
      
      // Map the trustee data to the User type
      const user: MerchantUser = {
        _id: userMerchant.id,
        name: userMerchant.name,
        email_id: userMerchant.email,
        apiKey: userMerchant.apiKey,
        role: userMerchant.role,
        phone_number: userMerchant.phone_number,
        user: userMerchant.user,
        trustee_id:userMerchant.trustee_id,
        trustee_logo:userMerchant.trustee_logo
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
      .find({ clientId: merchant.client_id })
      .sort({ createdAt: -1 });
    return settlementReports;
  }

  @Query(() => [MerchantTransactionReport])
  @UseGuards(MerchantGuard)
  async getMerchantTransactionReport(@Context() context) {
    try {

      const merchant = await this.trusteeSchoolModel.findById(
        context.req.merchant,
      );

      const school_id = merchant?.school_id;


      let transactionReport = [];

      if (!school_id) return transactionReport;

      if (!merchant) throw new NotFoundException('Merchant not found');

      console.log(`Getting report for ${merchant.merchantName}(${school_id})`);


      const token = this.jwtService.sign(

        { school_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );


      const config = {
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

      transactionReport = response.data.transactions.map(
        async (transaction) => {
          // Parse additional_data from the transaction
          let remark = null;
          remark = await this.trusteeService.getRemarks(transaction.collect_id);
          if (remark) {
            transaction.remarks = remark.remarks;
          }
          let additionalData: AdditionalData = {};
          if (transaction.additional_data) {
            additionalData = JSON.parse(transaction.additional_data);
          }

          transaction.student_id =
            additionalData?.student_details?.student_id || '';
          transaction.student_name =
            additionalData?.student_details?.student_name || '';
          transaction.student_email =
            additionalData?.student_details?.student_email || '';
          transaction.student_phone =
            additionalData?.student_details?.student_phone_no || '';
          transaction.receipt = additionalData?.student_details?.receipt || '';
          transaction.additional_data = additionalData?.additional_fields || '';
          transaction.school_id = school_id || '';
          transaction.school_name = merchant?.school_name || '';


          return transaction;
        },
      );

      transactionReport.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      return transactionReport;
    } catch (error) {
      throw error;
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
      $or: [{ email }, { phone_number }],
    });
    // if (trustee) {
    //   throw new ConflictException('This email or phone number is already registered for a partner account. Please use a different email or phone number.')
    // }
    if (member || merchant) {
      throw new ConflictException('Email or Phone Number is Taken');
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
    @Args('date') date: string,
    @Args('school_id') school_id: string,
  ) {
    const schoolId = new Types.ObjectId(school_id);

    try {
      const inputDate = new Date(date);
      const year = inputDate.getFullYear();
      const month = inputDate.getMonth();
      const day = inputDate.getDate();
      const startDate = new Date(year, month, day);
      const endDate = new Date(year, month, day + 1);

      const settlement = await this.settlementReportModel.find({
        schoolId,
        settlementDate: {
          $gte: startDate, // Greater than or equal to start of the specified date
          $lt: endDate, // Less than the start of the next day
        },
      });
      return settlement;
    } catch (error) {
      console.error('Error fetching settlement data:', error);
      throw new Error('Failed to fetch settlement data');
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
  trustee_logo?: string;
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
