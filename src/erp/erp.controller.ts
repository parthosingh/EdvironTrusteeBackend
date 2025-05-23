import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  ConflictException,
  Query,
  Req,
  UnauthorizedException,
  NotFoundException,
  UseGuards,
  ForbiddenException,
  Res,
  Param,
} from '@nestjs/common';
import { ErpService } from './erp.service';
import { JwtService } from '@nestjs/jwt';
import { ErpGuard } from './erp.guard';
import { InjectModel, Schema } from '@nestjs/mongoose';
import { DisabledModes, TrusteeSchool } from '../schema/school.schema';
import mongoose, { Types } from 'mongoose';
import * as moment from 'moment-timezone';
import axios from 'axios';
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
import { Trustee } from '../schema/trustee.schema';
import { Commission } from '../schema/commission.schema';
import { Earnings } from '../schema/earnings.schema';
import { BaseMdr } from '../schema/base.mdr.schema';
import { TrusteeService } from '../trustee/trustee.service';
import QRCode from 'qrcode';
import { refund_status, RefundRequest } from '../schema/refund.schema';
import { Capture } from '../schema/capture.schema';
// import cf_commision from '../utils/cashfree.commission'; // hardcoded cashfree charges change this according to cashfree
import * as qs from 'qs';
import { WebhookLogs } from '../schema/webhook.schema';
import { VendorsSettlement } from 'src/schema/vendor.settlements.schema';
import { Vendors } from 'src/schema/vendors.schema';
import { Context } from '@nestjs/graphql';
import * as crypto from 'crypto';
import { VirtualAccount } from 'src/schema/virtual.account.schema';
@Controller('erp')
export class ErpController {
  constructor(
    private erpService: ErpService,
    private readonly jwtService: JwtService,
    private readonly trusteeService: TrusteeService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementModel: mongoose.Model<SettlementReport>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(Commission.name)
    private commissionModel: mongoose.Model<Commission>,
    @InjectModel(Earnings.name)
    private earningsModel: mongoose.Model<Earnings>,
    @InjectModel(BaseMdr.name)
    private baseMdrModel: mongoose.Model<BaseMdr>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
    @InjectModel(Capture.name)
    private CapturetModel: mongoose.Model<Capture>,
    @InjectModel(WebhookLogs.name)
    private webhooksLogsModel: mongoose.Model<WebhookLogs>,
    @InjectModel(VendorsSettlement.name)
    private VendorsSettlementModel: mongoose.Model<VendorsSettlement>,
    @InjectModel(Vendors.name)
    private VendorsModel: mongoose.Model<Vendors>,
    @InjectModel(VirtualAccount.name)
    private VirtualAccountModel: mongoose.Model<VirtualAccount>,
  ) {}

  @Get('payment-link')
  @UseGuards(ErpGuard)
  async genratePaymentLink(
    @Query('phone_number')
    phone_number: string,
  ) {
    try {
      const link = await this.erpService.genrateLink(phone_number);
      return link;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('get-user')
  @UseGuards(ErpGuard)
  async validateApiKey(@Req() req): Promise<{
    name: string;
    email_id: string;
    phone_number: string;
  }> {
    try {
      const trusteeId = req.userTrustee.id;
      const trustee = await this.erpService.getUser(trusteeId);

      return trustee;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else {
        throw new UnauthorizedException(error.message);
      }
    }
  }

  @Post('create-section')
  @UseGuards(ErpGuard)
  async createSection(
    @Body()
    body: {
      school_id: string;
      data: { className: string; section: string };
    },
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const section = await this.erpService.createSection(
        body.school_id,
        body.data,
        trustee_id,
      );
      return section;
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.message);
      } else if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('create-student')
  @UseGuards(ErpGuard)
  async createStudent(
    @Body()
    body,
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const student = await this.erpService.createStudent(
        body,
        body.school_id,
        trustee_id,
      );
      return student;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.message);
      } else {
        throw new BadRequestException(error.message);
      }
    }
  }

  @Post('create-school')
  @UseGuards(ErpGuard)
  async createSchool(
    @Body()
    body: {
      name: string;
      phone_number: string;
      email: string;
      school_name: string;
    },

    @Req() req,
  ): Promise<any> {
    if (!body.name || !body.phone_number || !body.email || !body.school_name) {
      throw new BadRequestException('Fill all fields');
    }

    try {
      const school = await this.erpService.createSchool(
        body.phone_number,
        body.name,
        body.email,
        body.school_name,
        req.userTrustee.id,
      );

      return school;
    } catch (error) {
      if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('create-collect-request')
  @UseGuards(ErpGuard)
  async createCollectRequest(
    @Body()
    body: {
      school_id: string;
      amount: number;
      callback_url: string;
      sign: string;
      student_phone_no?: string;
      student_email?: string;
      student_name?: string;
      student_id?: string;
      receipt?: string;
      sendPaymentLink?: boolean;
      additional_data?: {};
      custom_order_id?: string;
      req_webhook_urls?: [string];
      split_payments?: boolean;
      disabled_modes?: DisabledModes[];
      vendors_info?: [
        {
          vendor_id: string;
          percentage?: number;
          amount?: number;
          name?: string;
        },
      ];
    },
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      // const trustee_id = new Types.ObjectId('658e759736ba0754ca45d0c2');
      // try {
      //   await new this.webhooksLogsModel({
      //     type: 'COLLECT REQUEST',
      //     order_id: trustee_id.toString(),
      //     status: 'CALLED',
      //     body: JSON.stringify(body),
      //   }).save();
      // } catch(e) {
      //   console.log(e.message);
      // }
      const {
        school_id,
        amount,
        callback_url,
        sign,
        additional_data,
        student_id,
        student_email,
        student_name,
        student_phone_no,
        receipt,
        custom_order_id,
        req_webhook_urls,
        split_payments,
        vendors_info,
      } = body;
      let { disabled_modes } = body;

      if (disabled_modes) {
        await this.erpService.validateDisabledModes(disabled_modes);
      }

      let splitPay = split_payments;
      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      if (!amount) {
        throw new BadRequestException('Amount is required');
      }
      if (!callback_url) {
        throw new BadRequestException('Callback url is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }
      if (body.student_phone_no || body.student_email) {
        if (!body.student_name) {
          throw new BadRequestException('student name is required');
        }
        // if (!body.reason) {
        //   throw new BadRequestException('reason is required');
        // }
      }
      let isVBAPayment = false;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) {
        throw new NotFoundException('Inalid Institute id');
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }
      if (school.isVBAActive) {
        isVBAPayment = true;
      }
      let vba_account_number = 'NA';
      if (isVBAPayment) {
        try {
          if (
            !student_id ||
            !student_email ||
            !student_name ||
            !student_phone_no
          ) {
            throw new BadRequestException(
              `Student details required for NEFT/RTGS`,
            );
          }
          const vba = await this.erpService.createStudentVBA(
            student_id,
            student_name,
            student_email,
            student_phone_no,
            school_id,
            Number(amount),
          );
          vba_account_number = vba.vba_account_number;
        } catch (e) {
          console.log(e);
        }
      }
      disabled_modes = Array.from(
        new Set([...school.disabled_modes, ...(disabled_modes || [])]),
      ).map((mode) => {
        const lowerMode = mode.toLowerCase();
        const validMode = Object.keys(DisabledModes).find(
          (enumValue) => enumValue.toLowerCase() === lowerMode,
        ) as keyof typeof DisabledModes;
        if (!validMode) {
          throw new BadRequestException(`Invalid payment mode: ${mode}`);
        }
        return DisabledModes[validMode];
      });

      // console.log(disabled_modes, 'disabled_modes');

      if (split_payments && !vendors_info) {
        throw new BadRequestException(
          'Vendors information is required for split payments',
        );
      }

      if (split_payments && vendors_info && vendors_info.length < 0) {
        throw new BadRequestException('At least one vendor is required');
      }
      const updatedVendorsInfo = [];
      if (vendors_info && vendors_info.length > 0) {
        // Determine the split method (amount or percentage) based on the first vendor
        let splitMethod = null;
        let totalAmount = 0;
        let totalPercentage = 0;
        for (const vendor of vendors_info) {
          // Check if vendor_id is present
          if (!vendor.vendor_id) {
            throw new BadRequestException('Vendor ID is required');
          }

          const vendors_data = await this.trusteeService.getVenodrInfo(
            vendor.vendor_id,
            school_id,
          );
          if (!vendors_data) {
            throw new NotFoundException(
              'Invalid vendor id for ' + vendor.vendor_id,
            );
          }

          if (vendors_data.status !== 'ACTIVE') {
            throw new BadRequestException(
              'Vendor is not active. Please approve the vendor first. for ' +
                vendor.vendor_id,
            );
          }
          const updatedVendor = {
            ...vendor,
            name: vendors_data.name,
          };
          updatedVendorsInfo.push(updatedVendor);

          // Check if both amount and percentage are used
          const hasAmount = typeof vendor.amount === 'number';
          const hasPercentage = typeof vendor.percentage === 'number';
          if (hasAmount && hasPercentage) {
            throw new BadRequestException(
              'Amount and Percentage cannot be present at the same time',
            );
          }

          // Determine and enforce split method consistency
          const currentMethod = hasAmount
            ? 'amount'
            : hasPercentage
              ? 'percentage'
              : null;
          if (!splitMethod) {
            splitMethod = currentMethod;
          } else if (currentMethod && currentMethod !== splitMethod) {
            throw new BadRequestException(
              'All vendors must use the same split method (either amount or percentage)',
            );
          }

          // Ensure either amount or percentage is provided for each vendor
          if (!hasAmount && !hasPercentage) {
            throw new BadRequestException(
              'Each vendor must have either an amount or a percentage',
            );
          }

          if (hasAmount) {
            if (vendor.amount < 0) {
              throw new BadRequestException('Vendor amount cannot be negative');
            }
            totalAmount += vendor.amount;
          } else if (hasPercentage) {
            if (vendor.percentage < 0) {
              throw new BadRequestException(
                'Vendor percentage cannot be negative',
              );
            }
            totalPercentage += vendor.percentage;
          }
        }
        if (splitMethod === 'amount' && totalAmount > body.amount) {
          throw new BadRequestException(
            'Sum of vendor amounts cannot be greater than the order amount',
          );
        }

        // Check if total percentage exceeds 100%
        if (splitMethod === 'percentage' && totalPercentage > 100) {
          throw new BadRequestException(
            'Sum of vendor percentages cannot be greater than 100%',
          );
        }
      }

      if (school.isVendor && school.vendor_id) {
        console.log('ADDING vendor info');

        const updatedVendor = {
          vendor_id: school.vendor_id,
          percentage: 100,
          name: school.school_name,
        };
        splitPay = true;
        updatedVendorsInfo.push(updatedVendor);
      }

      // console.log(school,'school');
      const adjustedAmount = school.adjustedAmount || 0;
      // console.log(school,'school');
      if (
        school.isAdjustment &&
        Number(amount) >= school.minAdjustmnentAmount
      ) {
        if (school.advanceAdjustment) {
          const advanceAdjustementAmount =
            school.targetAdjustmnentAmount - adjustedAmount;
          // if order amt is greater than targetAdjustmentAmount
          if (amount > advanceAdjustementAmount) {
            const splitAmount = advanceAdjustementAmount;
            const updatedVendor = {
              vendor_id: school.adjustment_vendor_id,
              amount: splitAmount,
              name: school.school_name,
            };
            splitPay = true;
            updatedVendorsInfo.push(updatedVendor);
            school.adjustedAmount = school.adjustedAmount + splitAmount;
            school.advanceAdjustment = false;
            await school.save();
          } else if (
            amount <= school.maxAdjustmnentAmount &&
            adjustedAmount + Number(amount) < school.targetAdjustmnentAmount
          ) {
            const updatedVendor = {
              vendor_id: school.adjustment_vendor_id,
              percentage: 100,
              name: school.school_name,
            };
            splitPay = true;
            updatedVendorsInfo.push(updatedVendor);
            school.adjustedAmount = school.adjustedAmount + Number(amount);
            await school.save();
          }
        } else if (
          amount <= school.maxAdjustmnentAmount &&
          adjustedAmount + Number(amount) <= school.targetAdjustmnentAmount
        ) {
          const updatedVendor = {
            vendor_id: school.adjustment_vendor_id,
            percentage: 100,
            name: school.school_name,
          };
          splitPay = true;
          updatedVendorsInfo.push(updatedVendor);
          school.adjustedAmount = school.adjustedAmount + Number(amount);
          await school.save();
        }
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.amount != amount ||
        decoded.callback_url != callback_url ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const trusteeObjId = new mongoose.Types.ObjectId(trustee_id);
      const trustee = await this.trusteeModel.findById(trusteeObjId);
      const webHookUrl = req_webhook_urls?.length;
      // if (trustee.webhook_urls.length || req_webhook_urls?.length) {
      //   webHookUrl = `${process.env.VANILLA_SERVICE}/erp/webhook`;
      // }

      let all_webhooks: string[] = [];
      if (trustee.webhook_urls.length || req_webhook_urls?.length) {
        const trusteeUrls = trustee.webhook_urls.map((item) => item.url);
        all_webhooks = [...(req_webhook_urls || []), ...trusteeUrls];
      }

      if (trustee.webhook_urls.length === 0) {
        all_webhooks = req_webhook_urls || [];
      }

      const additionalInfo = {
        student_details: {
          student_id: student_id,
          student_email: student_email,
          student_name: student_name,
          student_phone_no: student_phone_no,
          receipt: receipt,
        },
        additional_fields: {
          ...additional_data,
        },
      };
      const merchantCodeFixed = school.toObject?.()?.worldline?.merchant_code;
      const axios = require('axios');
      const data = JSON.stringify({
        amount,
        callbackUrl: callback_url,
        jwt: this.jwtService.sign(
          {
            amount,
            callbackUrl: callback_url,
            clientId: school.client_id || null,
            clientSecret: school.client_secret,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        ),
        clientId: school.client_id || null,
        clientSecret: school.client_secret || null,
        school_id: school_id,
        trustee_id: trustee_id,
        webHook: webHookUrl || null,
        platform_charges: school.platform_charges,
        additional_data: additionalInfo || {},
        custom_order_id: custom_order_id || null,
        req_webhook_urls: all_webhooks || null,
        school_name: school.school_name || null,
        easebuzz_sub_merchant_id: school.easebuzz_id || null,
        ccavenue_access_code: school.ccavenue_access_code || null,
        ccavenue_merchant_id: school.ccavenue_merchant_id || null,
        ccavenue_working_key: school.ccavenue_working_key || null,
        smartgateway_merchant_id: school.smartgateway_merchant_id || null,
        smartgateway_customer_id: school.smartgateway_customer_id || null,
        smart_gateway_api_key: school?.smart_gateway_api_key || null,
        hdfc_razorpay_id: school.hdfc_razorpay_id || null,
        hdfc_razorpay_secret: school.hdfc_razorpay_secret || null,
        hdfc_razorpay_mid: school.hdfc_razorpay_mid || null,
        pay_u_key: school.pay_u_key || null,
        pay_u_salt: school.pay_u_salt || null,
        nttdata_id: school?.ntt_data?.nttdata_id || null,
        nttdata_secret: school?.ntt_data?.nttdata_secret || null,
        nttdata_hash_req_key: school?.ntt_data?.nttdata_hash_req_key || null,
        nttdata_hash_res_key: school?.ntt_data?.nttdata_hash_res_key || null,
        nttdata_res_salt: school?.ntt_data?.nttdata_res_salt || null,
        nttdata_req_salt: school?.ntt_data?.nttdata_req_salt || null,
        worldline_merchant_id:
          school?.worldline?.merchant_code || null,
        worldline_encryption_key:
          school?.worldline?.encryption_key || null,
        worldline_encryption_iV:
          school?.worldline?.encryption_iV || null,
        worldline_merchant_id: school?.worldline?.merchant_code || null,
        worldline_encryption_key: school?.worldline?.encryption_key || null,
        worldline_encryption_iV: school?.worldline?.encryption_iV || null,
        split_payments: splitPay || false,
        vendors_info: updatedVendorsInfo || null,
        disabled_modes: disabled_modes || null,
        isVBAPayment: isVBAPayment || false,
        vba_account_number: vba_account_number || 'NA',
      });
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/collect`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: data,
      };
      const { data: paymentsServiceResp } = await axios.request(config);

      const reason = 'fee payment';

      //set some variable here (user input [sendPaymentLink:true])
      // to send link to student
      // if (body.student_phone_no || body.student_email) {
      //   if (body.sendPaymentLink) {
      //     await this.erpService.sendPaymentLink({
      //       student_name: body.student_name || ' ',
      //       phone_no: body.student_phone_no,
      //       amount: body.amount,
      //       reason: reason,
      //       school_id: body.school_id,
      //       mail_id: body.student_email,
      //       paymentURL: paymentsServiceResp.url,
      //     });
      //   }
      // }

      if (isVBAPayment) {
        try {
          await this.erpService.updateVBA(
            paymentsServiceResp.request._id.toString(),
            vba_account_number,
          );
        } catch (e) {
          console.log(e);
        }
      }

      return {
        collect_request_id: paymentsServiceResp.request._id,
        collect_request_url: paymentsServiceResp.url,
        sign: this.jwtService.sign(
          {
            collect_request_id: paymentsServiceResp.request._id,
            collect_request_url: paymentsServiceResp.url,
            custom_order_id: paymentsServiceResp.request?.custom_order_id,
          },
          { noTimestamp: true, secret: school.pg_key },
        ),
      };
    } catch (error) {
      // console.log(error);
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      if (error?.response?.data?.message) {
        throw new ConflictException(error.response.data.message);
      }
      console.log('error in create collect request', error);
      throw error;
    }
  }

  @Post('v2/create-collect-request')
  @UseGuards(ErpGuard)
  async createCollectRequestV2(
    @Body()
    body: {
      school_id: string;
      amount: number;
      callback_url: string;
      sign: string;
      student_phone_no?: string;
      student_email?: string;
      student_name?: string;
      student_id?: string;
      receipt?: string;
      sendPaymentLink?: boolean;
      additional_data?: {};
      custom_order_id?: string;
      req_webhook_urls?: [string];
      split_payments?: boolean;
      disabled_modes?: DisabledModes[];
      vendors_info?: [
        {
          vendor_id: string;
          percentage?: number;
          amount?: number;
          name?: string;
        },
      ];
    },
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const {
        school_id,
        amount,
        callback_url,
        sign,
        additional_data,
        student_id,
        student_email,
        student_name,
        student_phone_no,
        receipt,
        custom_order_id,
        req_webhook_urls,
        split_payments,
        vendors_info,
      } = body;
      let { disabled_modes } = body;

      if (disabled_modes) {
        await this.erpService.validateDisabledModes(disabled_modes);
      }
      let PaymnetWebhookUrl: any = req_webhook_urls;
      if (req_webhook_urls && !Array.isArray(req_webhook_urls)) {
        const decodeWebhookUrl = decodeURIComponent(req.body.req_webhook_urls);
        PaymnetWebhookUrl = JSON.parse(decodeWebhookUrl);
      }
      let splitPay = split_payments;
      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      if (!amount) {
        throw new BadRequestException('Amount is required');
      }
      if (!callback_url) {
        throw new BadRequestException('Callback url is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }
      if (body.student_phone_no || body.student_email) {
        if (!body.student_name) {
          throw new BadRequestException('student name is required');
        }
        // if (!body.reason) {
        //   throw new BadRequestException('reason is required');
        // }
      }
      let isVBAPayment = false;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('Inalid Institute id');
      }

      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }
      if (school.isVBAActive) {
        isVBAPayment = true;
      }
      let vba_account_number = 'NA';
      if (isVBAPayment) {
        try {
          if (
            !student_id ||
            !student_email ||
            !student_name ||
            !student_phone_no
          ) {
            throw new BadRequestException(
              `Student details required for NEFT/RTGS`,
            );
          }
          const vba = await this.erpService.createStudentVBA(
            student_id,
            student_name,
            student_email,
            student_phone_no,
            school_id,
            Number(amount),
          );
          vba_account_number = vba.vba_account_number;
        } catch (e) {
          console.log(e);
        }
      }

      disabled_modes = Array.from(
        new Set([...school.disabled_modes, ...(disabled_modes || [])]),
      ).map((mode) => {
        const lowerMode = mode.toLowerCase();
        const validMode = Object.keys(DisabledModes).find(
          (enumValue) => enumValue.toLowerCase() === lowerMode,
        ) as keyof typeof DisabledModes;
        if (!validMode) {
          throw new BadRequestException(`Invalid payment mode: ${mode}`);
        }
        return DisabledModes[validMode];
      });

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }
      let PGVendorInfo: any = vendors_info;
      if (split_payments && vendors_info && !Array.isArray(vendors_info)) {
        const decoded_vendor_info = decodeURIComponent(req.body.vendors_info);
        PGVendorInfo = JSON.parse(decoded_vendor_info);
      }

      if (split_payments && !vendors_info) {
        throw new BadRequestException(
          'Vendors information is required for split payments',
        );
      }

      if (split_payments && vendors_info && vendors_info.length < 0) {
        throw new BadRequestException('At least one vendor is required');
      }
      const updatedVendorsInfo = [];
      if (PGVendorInfo && PGVendorInfo.length > 0) {
        // Determine the split method (amount or percentage) based on the first vendor
        let splitMethod = null;
        let totalAmount = 0;
        let totalPercentage = 0;
        for (const vendor of PGVendorInfo) {
          // Check if vendor_id is present
          if (!vendor.vendor_id) {
            throw new BadRequestException('Vendor ID is required');
          }
          const vendors_data = await this.trusteeService.getVenodrInfo(
            vendor.vendor_id,
            school_id,
          );
          if (!vendors_data) {
            throw new NotFoundException(
              'Invalid vendor id for ' + vendor.vendor_id,
            );
          }

          if (vendors_data.status !== 'ACTIVE') {
            throw new BadRequestException(
              'Vendor is not active. Please approve the vendor first. for ' +
                vendor.vendor_id,
            );
          }
          const updatedVendor = {
            ...vendor,
            name: vendors_data.name,
          };
          updatedVendorsInfo.push(updatedVendor);

          // Check if both amount and percentage are used
          const hasAmount = typeof vendor.amount === 'number';
          const hasPercentage = typeof vendor.percentage === 'number';
          if (hasAmount && hasPercentage) {
            throw new BadRequestException(
              'Amount and Percentage cannot be present at the same time',
            );
          }

          // Determine and enforce split method consistency
          const currentMethod = hasAmount
            ? 'amount'
            : hasPercentage
              ? 'percentage'
              : null;
          if (!splitMethod) {
            splitMethod = currentMethod;
          } else if (currentMethod && currentMethod !== splitMethod) {
            throw new BadRequestException(
              'All vendors must use the same split method (either amount or percentage)',
            );
          }

          // Ensure either amount or percentage is provided for each vendor
          if (!hasAmount && !hasPercentage) {
            throw new BadRequestException(
              'Each vendor must have either an amount or a percentage',
            );
          }

          if (hasAmount) {
            if (vendor.amount < 0) {
              throw new BadRequestException('Vendor amount cannot be negative');
            }
            totalAmount += vendor.amount;
          } else if (hasPercentage) {
            if (vendor.percentage < 0) {
              throw new BadRequestException(
                'Vendor percentage cannot be negative',
              );
            }
            totalPercentage += vendor.percentage;
          }
        }
        if (splitMethod === 'amount' && totalAmount > body.amount) {
          throw new BadRequestException(
            'Sum of vendor amounts cannot be greater than the order amount',
          );
        }

        // Check if total percentage exceeds 100%
        if (splitMethod === 'percentage' && totalPercentage > 100) {
          throw new BadRequestException(
            'Sum of vendor percentages cannot be greater than 100%',
          );
        }
      }

      if (school.isVendor && school.vendor_id) {
        const updatedVendor = {
          vendor_id: school.vendor_id,
          percentage: 100,
          name: school.school_name,
        };
        splitPay = true;
        updatedVendorsInfo.push(updatedVendor);
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.amount != amount ||
        decoded.callback_url != callback_url ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const trusteeObjId = new mongoose.Types.ObjectId(trustee_id);
      const trustee = await this.trusteeModel.findById(trusteeObjId);
      let webHookUrl = PaymnetWebhookUrl?.length;
      // if (trustee.webhook_urls.length || req_webhook_urls?.length) {
      //   webHookUrl = `${process.env.VANILLA_SERVICE}/erp/webhook`;
      // }

      let all_webhooks: string[] = [];
      if (trustee.webhook_urls.length || PaymnetWebhookUrl?.length) {
        const trusteeUrls = trustee.webhook_urls.map((item) => item.url);
        all_webhooks = [...(PaymnetWebhookUrl || []), ...trusteeUrls];
      }

      if (trustee.webhook_urls.length === 0) {
        all_webhooks = PaymnetWebhookUrl || [];
      }

      const additionalInfo = {
        student_details: {
          student_id: student_id,
          student_email: student_email,
          student_name: student_name,
          student_phone_no: student_phone_no,
          receipt: receipt,
        },
        additional_fields: {
          ...additional_data,
        },
      };

      const axios = require('axios');
      let data = JSON.stringify({
        amount,
        callbackUrl: callback_url,
        jwt: this.jwtService.sign(
          {
            amount,
            callbackUrl: callback_url,
            clientId: school.client_id || null,
            clientSecret: school.client_secret,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        ),
        clientId: school.client_id || null,
        clientSecret: school.client_secret || null,
        school_id: school_id,
        trustee_id: trustee_id,
        webHook: webHookUrl || null,
        disabled_modes: disabled_modes || null,
        platform_charges: school.platform_charges,
        additional_data: additionalInfo || {},
        custom_order_id: custom_order_id || null,
        req_webhook_urls: all_webhooks || null,
        school_name: school.school_name || null,
        easebuzz_sub_merchant_id: school.easebuzz_id || null,
        ccavenue_access_code: school.ccavenue_access_code || null,
        ccavenue_merchant_id: school.ccavenue_merchant_id || null,
        ccavenue_working_key: school.ccavenue_working_key || null,
        split_payments: splitPay || false,
        vendors_info: updatedVendorsInfo || null,
        isVBAPayment: isVBAPayment || false,
        vba_account_number: vba_account_number || 'NA',
      });
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/collect`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: data,
      };
      const { data: paymentsServiceResp } = await axios.request(config);

      let reason = 'fee payment';

      //set some variable here (user input [sendPaymentLink:true])
      // to send link to student
      if (body.student_phone_no || body.student_email) {
        if (body.sendPaymentLink) {
          await this.erpService.sendPaymentLink({
            student_name: body.student_name || ' ',
            phone_no: body.student_phone_no,
            amount: body.amount,
            reason: reason,
            school_id: body.school_id,
            mail_id: body.student_email,
            paymentURL: paymentsServiceResp.url,
          });
        }
      }
      if (isVBAPayment) {
        try {
          await this.erpService.updateVBA(
            paymentsServiceResp.request._id.toString(),
            vba_account_number,
          );
        } catch (e) {
          console.log(e);
        }
      }
      return {
        collect_request_id: paymentsServiceResp.request._id,
        collect_request_url: paymentsServiceResp.url,
        sign: this.jwtService.sign(
          {
            collect_request_id: paymentsServiceResp.request._id,
            collect_request_url: paymentsServiceResp.url,
            custom_order_id: paymentsServiceResp.request?.custom_order_id,
          },
          { noTimestamp: true, secret: school.pg_key },
        ),
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      if (error?.response?.data?.message) {
        throw new ConflictException(error.response.data.message);
      }
      throw error;
    }
  }

  @Post('/:reseller_name/create-collect-request')
  @UseGuards(ErpGuard)
  async resellerCreateCollectRequest(
    @Body()
    body: {
      school_id: string;
      amount: number;
      callback_url: string;
      sign: string;
      student_phone_no?: string;
      student_email?: string;
      student_name?: string;
      student_id?: string;
      receipt?: string;
      sendPaymentLink?: boolean;
      additional_data?: {};
      custom_order_id?: string;
      req_webhook_urls?: [string];
      split_payments?: boolean;
      vendors_info?: [
        {
          vendor_id: string;
          percentage?: number;
          amount?: number;
          name?: string;
        },
      ];
    },
    @Req() req,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const {
        school_id,
        amount,
        callback_url,
        sign,
        additional_data,
        student_id,
        student_email,
        student_name,
        student_phone_no,
        receipt,
        custom_order_id,
        req_webhook_urls,
        split_payments,
        vendors_info,
      } = body;
      const { reseller_name } = req.params;

      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      if (!amount) {
        throw new BadRequestException('Amount is required');
      }
      if (!callback_url) {
        throw new BadRequestException('Callback url is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }
      if (body.student_phone_no || body.student_email) {
        if (!body.student_name) {
          throw new BadRequestException('student name is required');
        }
        // if (!body.reason) {
        //   throw new BadRequestException('reason is required');
        // }
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('Inalid Institute id');
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }

      if (split_payments && !vendors_info) {
        throw new BadRequestException(
          'Vendors information is required for split payments',
        );
      }

      if (split_payments && vendors_info && vendors_info.length < 0) {
        throw new BadRequestException('At least one vendor is required');
      }
      const updatedVendorsInfo = [];
      if (vendors_info && vendors_info.length > 0) {
        // Determine the split method (amount or percentage) based on the first vendor
        let splitMethod = null;
        let totalAmount = 0;
        let totalPercentage = 0;
        for (const vendor of vendors_info) {
          // Check if vendor_id is present
          if (!vendor.vendor_id) {
            throw new BadRequestException('Vendor ID is required');
          }

          const vendors_data = await this.trusteeService.getVenodrInfo(
            vendor.vendor_id,
            body.school_id,
          );
          if (!vendors_data) {
            throw new NotFoundException(
              'Invalid vendor id for ' + vendor.vendor_id,
            );
          }

          if (vendors_data.status !== 'ACTIVE') {
            throw new BadRequestException(
              'Vendor is not active. Please approve the vendor first. for ' +
                vendor.vendor_id,
            );
          }
          const updatedVendor = {
            ...vendor,
            name: vendors_data.name,
          };
          updatedVendorsInfo.push(updatedVendor);
          // Check if both amount and percentage are used
          const hasAmount = typeof vendor.amount === 'number';
          const hasPercentage = typeof vendor.percentage === 'number';
          if (hasAmount && hasPercentage) {
            throw new BadRequestException(
              'Amount and Percentage cannot be present at the same time',
            );
          }

          // Determine and enforce split method consistency
          const currentMethod = hasAmount
            ? 'amount'
            : hasPercentage
              ? 'percentage'
              : null;
          if (!splitMethod) {
            splitMethod = currentMethod;
          } else if (currentMethod && currentMethod !== splitMethod) {
            throw new BadRequestException(
              'All vendors must use the same split method (either amount or percentage)',
            );
          }

          // Ensure either amount or percentage is provided for each vendor
          if (!hasAmount && !hasPercentage) {
            throw new BadRequestException(
              'Each vendor must have either an amount or a percentage',
            );
          }

          if (hasAmount) {
            if (vendor.amount < 0) {
              throw new BadRequestException('Vendor amount cannot be negative');
            }
            totalAmount += vendor.amount;
          } else if (hasPercentage) {
            if (vendor.percentage < 0) {
              throw new BadRequestException(
                'Vendor percentage cannot be negative',
              );
            }
            totalPercentage += vendor.percentage;
          }
        }
        if (splitMethod === 'amount' && totalAmount > body.amount) {
          throw new BadRequestException(
            'Sum of vendor amounts cannot be greater than the order amount',
          );
        }

        // Check if total percentage exceeds 100%
        if (splitMethod === 'percentage' && totalPercentage > 100) {
          throw new BadRequestException(
            'Sum of vendor percentages cannot be greater than 100%',
          );
        }
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.amount != amount ||
        decoded.callback_url != callback_url ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const trusteeObjId = new mongoose.Types.ObjectId(trustee_id);
      const trustee = await this.trusteeModel.findById(trusteeObjId);
      let webHookUrl = req_webhook_urls?.length;
      // if (trustee.webhook_urls.length || req_webhook_urls?.length) {
      //   webHookUrl = `${process.env.VANILLA_SERVICE}/erp/webhook`;
      // }

      let all_webhooks: string[] = [];
      if (trustee.webhook_urls.length || req_webhook_urls?.length) {
        const trusteeUrls = trustee.webhook_urls.map((item) => item.url);
        all_webhooks = [...(req_webhook_urls || []), ...trusteeUrls];
      }

      if (trustee.webhook_urls.length === 0) {
        all_webhooks = req_webhook_urls || [];
      }

      const additionalInfo = {
        student_details: {
          student_id: student_id,
          student_email: student_email,
          student_name: student_name,
          student_phone_no: student_phone_no,
          receipt: receipt,
        },
        additional_fields: {
          ...additional_data,
        },
      };

      const axios = require('axios');
      let data = JSON.stringify({
        amount,
        callbackUrl: callback_url,
        jwt: this.jwtService.sign(
          {
            amount,
            callbackUrl: callback_url,
            clientId: school.client_id || null,
            clientSecret: school.client_secret,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        ),
        clientId: school.client_id || null,
        clientSecret: school.client_secret || null,
        school_id: school_id,
        trustee_id: trustee_id,
        webHook: webHookUrl || null,
        disabled_modes: school.disabled_modes,
        platform_charges: school.platform_charges,
        additional_data: additionalInfo || {},
        custom_order_id: custom_order_id || null,
        req_webhook_urls: all_webhooks || null,
        school_name: school.school_name || null,
        easebuzz_sub_merchant_id: school.easebuzz_id || null,
        ccavenue_access_code: school.ccavenue_access_code || null,
        ccavenue_merchant_id: school.ccavenue_merchant_id || null,
        ccavenue_working_key: school.ccavenue_working_key || null,
        split_payments: split_payments || false,
        vendors_info: updatedVendorsInfo || null,
      });
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/collect`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: data,
      };
      const { data: paymentsServiceResp } = await axios.request(config);

      let reason = 'fee payment';

      //set some variable here (user input [sendPaymentLink:true])
      // to send link to student
      if (body.student_phone_no || body.student_email) {
        if (body.sendPaymentLink) {
          await this.erpService.sendPaymentLink({
            student_name: body.student_name || ' ',
            phone_no: body.student_phone_no,
            amount: body.amount,
            reason: reason,
            school_id: body.school_id,
            mail_id: body.student_email,
            paymentURL: paymentsServiceResp.url,
          });
        }
      }

      return {
        collect_request_id: paymentsServiceResp.request._id,
        collect_request_url: paymentsServiceResp.url,
        sign: this.jwtService.sign(
          {
            collect_request_id: paymentsServiceResp.request._id,
            collect_request_url: paymentsServiceResp.url,
            custom_order_id: paymentsServiceResp.request?.custom_order_id,
          },
          { noTimestamp: true, secret: school.pg_key },
        ),
      };
    } catch (error) {
      // console.log(error);
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      if (error?.response?.data?.message)
        throw new ConflictException(error.response.data.message);

      throw error;
    }
  }

  @Get('collect-request/:collect_request_id')
  @UseGuards(ErpGuard)
  async getCollectRequestStatus(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;

      const { collect_request_id } = req.params;
      const { school_id, sign } = req.query;
      if (!collect_request_id) {
        throw new BadRequestException('Collect request id is required');
      }
      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }

      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });

      if (
        decoded.collect_request_id != collect_request_id ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${
          process.env.PAYMENTS_SERVICE_ENDPOINT
        }/check-status?transactionId=${collect_request_id}&jwt=${this.jwtService.sign(
          {
            transactionId: collect_request_id,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        )}`,
        headers: {
          accept: 'application/json',
        },
      };

      const { data: paymentsServiceResp } = await axios.request(config);
      const responseWithoutSign = { ...paymentsServiceResp, sign: undefined };
      const responseWithSign = {
        ...paymentsServiceResp,
        sign: this.jwtService.sign(responseWithoutSign, {
          noTimestamp: true,
          secret: school.pg_key,
        }),
      };
      return responseWithSign;
    } catch (error) {
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      throw error;
    }
  }

  @Get('collect-request-status/:order_id')
  @UseGuards(ErpGuard)
  async getCollectRequest(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const { order_id } = req.params;
      const { school_id, sign } = req.query;
      if (!order_id) {
        throw new BadRequestException('Order id is required');
      }
      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }

      if (!school.client_id || !school.client_secret || !school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (decoded.custom_order_id != order_id) {
        throw new ForbiddenException('request forged');
      }

      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${
          process.env.PAYMENTS_SERVICE_ENDPOINT
        }/check-status/custom-order?transactionId=${order_id}&jwt=${this.jwtService.sign(
          {
            transactionId: order_id,
            trusteeId: trustee_id,
            school_id,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        )}`,
        headers: {
          accept: 'application/json',
        },
      };

      const { data: paymentsServiceResp } = await axios.request(config);
      return paymentsServiceResp;
    } catch (error) {
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      throw error;
    }
  }

  @Post('sendPaymentLink')
  @UseGuards(ErpGuard)
  async sendPaymentLink(
    @Body()
    body: {
      student_name: string;
      phone_no: string;
      amount: number;
      reason: string;
      school_id: string;
      mail_id: string;
    },
    @Req() req,
  ) {
    try {
      if (!body.student_name)
        throw new NotFoundException('student name required');
      if (!body.amount) throw new NotFoundException('amount required');
      if (!body.reason) throw new NotFoundException('reason required');
      if (!body.school_id) throw new NotFoundException('school id required');
      if (!body.phone_no && !body.mail_id)
        throw new NotFoundException(
          'atleast one contact detail required from phone no or mail id',
        );

      const { student_name, phone_no, amount, reason, school_id, mail_id } =
        body;

      const authToken = req.headers['authorization'].substring(7);

      const payload = {
        school_id: body.school_id,
        amount: body.amount,
        callback_url: 'https://google.com',
      };

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(body.school_id),
      });

      const token = this.jwtService.sign(payload, { secret: school.pg_key });
      const data = JSON.stringify({
        school_id: body.school_id,
        amount: body.amount,
        callback_url: 'https://google.com',
        sign: token,
      });

      const temp = await axios.request({
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://vanilla.edviron.com/erp/create-collect-request`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        data: data,
      });

      const paymentURL = temp.data.collect_request_url;

      if (body.mail_id) {
        await this.erpService.sendPaymentLinkTOMail({
          student_name,
          amount,
          reason,
          school_id,
          mail_id,
          paymentURL,
        });
      }

      if (body.phone_no) {
        await this.erpService.sendPaymentLinkToWhatsaap({
          student_name,
          phone_no,
          amount,
          reason,
          school_id,
          paymentURL,
        });
      }

      return 'Notification sent scuccessfully';
    } catch (err) {
      throw new Error(err.message);
    }
  }

  @Get('settlements')
  @UseGuards(ErpGuard)
  async getSettlements(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const school_id = req.query.school_id;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 100);

      let filterQuery: any = {
        trustee: trustee_id,
      };

      if (school_id) {
        filterQuery = {
          ...filterQuery,
          schoolId: new Types.ObjectId(school_id),
        };
      }

      if (startDate && endDate) {
        const start_date = new Date(startDate);
        const end_date = new Date(endDate);
        end_date.setHours(23, 59, 59, 999);

        filterQuery = {
          ...filterQuery,
          settlementDate: {
            $gte: start_date,
            $lte: end_date,
          },
        };
      }
      //paginated query
      const settlements = await this.settlementModel
        .find(filterQuery, null, {
          skip: (page - 1) * limit,
          limit: limit,
        })
        .select('-clientId -trustee')
        .sort({ createdAt: -1 });
      const count = await this.settlementModel.countDocuments(filterQuery);
      const total_pages = Math.ceil(count / limit);
      return {
        page,
        limit,
        settlements,
        total_pages,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('/vendors-settlement')
  @UseGuards(ErpGuard)
  async getVendorsSettlements(@Req() req: any) {
    try {
      const trustee_id = req.userTrustee.id;
      const school_id = req.query.school_id;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 100);
      const vendor_id = req.query.vendor_id;
      let query: any = {
        trustee_id,
      };
      if ((startDate && !endDate) || (endDate && !startDate)) {
        throw new ConflictException(`Both start and end date must be present`);
      }

      if (vendor_id) {
        const vendors = await this.VendorsModel.findOne({ vendor_id });
        if (!vendor_id) {
          throw new NotFoundException('Invalid Vendor ID');
        }
        if (school_id && vendors.school_id.toString() !== school_id) {
          throw new BadRequestException(
            'Vendor dosent belong to school school_id:' + school_id,
          );
        }

        if (trustee_id.toString() !== vendors.trustee_id.toString()) {
          throw new BadRequestException('Invalid Vendor ID');
        }
        query = {
          ...query,
          vendor_id,
        };
      }
      if (startDate && endDate) {
        const startUTC = moment
          .tz(startDate, 'YYYY-MM-DD', 'Asia/Kolkata')
          .startOf('day')
          .utc()
          .toDate();
        const endUTC = moment
          .tz(endDate, 'YYYY-MM-DD', 'Asia/Kolkata')
          .endOf('day')
          .utc()
          .toDate();
        query = {
          ...query,
          settled_on: { $gte: startUTC, $lte: endUTC },
        };
      }

      if (limit && limit > 2000) {
        throw new BadRequestException('Limit cant be more that 2000');
      }
      if (school_id) {
        const school = await this.trusteeSchoolModel.findOne({
          school_id: new Types.ObjectId(school_id),
        });
        if (!school) {
          throw new BadRequestException(`Invalid School id`);
        }

        if (school.trustee_id.toString() !== trustee_id.toString()) {
          throw new BadRequestException(`Invalid School id`);
        }
        query = {
          ...query,
          school_id: school.school_id,
        };
      }

      const skip = (page - 1) * limit;

      // Get total count
      const total = await this.VendorsSettlementModel.countDocuments(query);

      // Get paginated data
      const vendorsSettlement = await this.VendorsSettlementModel.aggregate([
        { $match: query },
        { $sort: { settled_on: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            vendor_id: 1,
            vendor_name: 1,
            vendor_transaction_amount: 1,
            utr: 1,
            status: 1,
            settlement_initiated_on: 1,
            settlement_amount: 1,
            settled_on: 1,
            school_name: 1,
            school_id: 1,
            payment_from: 1,
            payment_till: 1,
            adjustment: 1,
            _id: 0,
          },
        },
      ]);

      return {
        data: vendorsSettlement,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Get('transactions/:school_id')
  @UseGuards(ErpGuard)
  async getTransactions(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(req.params.school_id),
        trustee_id: trustee_id,
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const status = req.query.status || null;
      const start_date = req.query.start_date || null;
      const end_date = req.query.end_date || null;
      const school_id = req.params.school_id;
      let token = this.jwtService.sign(
        {
          school_id: school_id,
        },
        {
          noTimestamp: true,
          secret: process.env.PAYMENTS_SERVICE_SECRET,
        },
      );

      let data = {
        school_id: school_id,
        token: token,
      };

      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/transactions-report`,
        headers: {
          accept: 'application/json',
        },
        data: data,
        params: {
          status,
          startDate: start_date,
          endDate: end_date,
          page,
          limit,
        },
      };
      let transactions = [];
      const response = await axios.request(config);
      if (
        response.data?.transactions &&
        response.data !== 'No orders found for clientId'
      ) {
        const modifiedResponseData = response.data.transactions.map((item) => ({
          ...item,
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

          merchant_name: school.school_name,
          school_id: school_id,
          school_name: school.school_name,
          currency: 'INR',
        }));
        transactions.push(...modifiedResponseData);
      }

      const total_pages = Math.ceil(response.data.totalTransactions / limit);
      return {
        page,
        limit,
        transactions,
        total_records: response.data.totalTransactions,
        total_pages,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('transactions')
  @UseGuards(ErpGuard)
  async getTransaction(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const status = req.query.status || null;
      const start_date = req.query.start_date || null;
      const end_date = req.query.end_date || null;

      const merchants = await this.trusteeSchoolModel.find({
        trustee_id: trustee_id,
      });
      const merchant_ids_to_merchant_map = {};
      merchants.map((merchant: any) => {
        merchant_ids_to_merchant_map[merchant.school_id] = merchant;
      });

      let token = this.jwtService.sign(
        { trustee_id: trustee_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: { trustee_id: trustee_id, token },
        params: {
          status,
          startDate: start_date,
          endDate: end_date,
          page,
          limit,
        },
      };

      const response = await axios.request(config);

      const total_pages = Math.ceil(response.data.totalTransactions / limit);
      const transactions = response.data.transactions.map((item: any) => {
        const date = new Date(item.updatedAt);
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
          formattedDate: `${date.getFullYear()}-${String(
            date.getMonth() + 1,
          ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        };
      });
      return {
        page,
        limit,
        transactions,
        total_records: response.data.totalTransactions,
        total_pages,
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  @Get('transaction-info')
  @UseGuards(ErpGuard)
  async getTransactionInfo(@Req() req: any) {
    try {
      const { sign, school_id, collect_request_id } = req.query;
      if (!sign) {
        throw new BadRequestException('Invalid signature');
      }
      if (!school_id) {
        throw new BadRequestException('Invalid school_id');
      }
      if (!collect_request_id) {
        throw new BadRequestException('Invalid collect_request_id');
      }

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('Invalid school_id');
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.collect_request_id != collect_request_id ||
        decoded.school_id != school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const token = this.jwtService.sign(
        { school_id, collect_request_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/transaction-info`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: { school_id, collect_request_id, token },
      };
      const response = await axios.request(config);

      const transactions = response.data.map((item: any) => {
        const date = new Date(item.updatedAt);
        return {
          ...item,
          merchant_name: school.school_name,
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
          school_name: school.school_name,
          formattedTransactionDate: `${date.getFullYear()}-${String(
            date.getMonth() + 1,
          ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        };
      });
      if (transactions.length > 0) {
        return transactions[0];
      }
      return {};
    } catch (error) {
      if (error?.response?.data) {
        throw new BadRequestException(error?.response?.data?.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('webhook')
  async webhook(@Body() body, @Res() res) {
    try {
      const decrypted = this.jwtService.verify(body.jwt, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });

      const trustee_id = decrypted.trustee_id;
      const school_id = decrypted.school_id;
      const collect_id = decrypted.collect_id;
      const amount = decrypted.amount;
      const status = decrypted.status;
      const req_webhook_urls = decrypted.req_webhook_urls;
      const trustee = await this.trusteeModel.findById(trustee_id);
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) throw new NotFoundException('School not found');
      const pg_key = school.pg_key;
      // const trusteeId = school.trustee_id;
      // const trustee = await this.trusteeModel.findById(trusteeId);
      const trusteeWebHookUrls = trustee.webhook_urls;

      let webHooksUrls: string[] = req_webhook_urls
        ? [...req_webhook_urls]
        : [];
      if (trusteeWebHookUrls.length) {
        const urls = trusteeWebHookUrls.map((webhook) => webhook.url);
        webHooksUrls.unshift(...urls);
      }

      if (!trustee) {
        throw new NotFoundException('Trustee not found');
      }
      if (!pg_key) {
        throw new BadRequestException(
          'webhook:PG Key not found for this school',
        );
      }

      if (webHooksUrls.length) {
        const token = this.jwtService.sign(
          {
            collect_id,
            amount,
            status,
          },
          { noTimestamp: true, secret: pg_key },
        );

        const webHookData = {
          collect_id,
          amount,
          status,
          token,
        };
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          data: webHookData,
        };
        const requests = webHooksUrls.map((webhook) => {
          let url = webhook;
          return axios.request({ ...config, url });
        });
        const responses = await Promise.allSettled(requests);

        responses.forEach((response, i) => {
          if (response.status === 'fulfilled') {
            console.log(`webhook sent to ${webHooksUrls[i]} `);
          } else {
            console.log(`webhook failed to ${webHooksUrls[i]} `);
          }
        });
      } else {
        console.log(
          `skipping webhook as no webhook url was set for trustee`,
          trustee.email_id,
        );
      }

      return res.status(200).send('OK');
    } catch (error) {
      throw error;
    }
  }

  @Post('update-commission') //add collect req id/transaction id in schema
  async updateCommission(
    @Body()
    body: {
      token: string;
      school_id: string;
      trustee_id: string;
      commission_amount: number;
      payment_mode: string;
      earnings_amount: number;
      transaction_id: string;
    },
  ) {
    const decrypted = this.jwtService.verify(body.token, {
      secret: process.env.PAYMENTS_SERVICE_SECRET,
    });
    const {
      school_id,
      trustee_id,
      commission_amount,
      payment_mode,
      earnings_amount,
      transaction_id,
    } = body;
    try {
      if (
        decrypted.school_id != school_id ||
        decrypted.trustee_id != trustee_id ||
        decrypted.commission_amount != commission_amount ||
        decrypted.payment_mode != payment_mode ||
        decrypted.earnings_amount != earnings_amount
      ) {
        throw new ForbiddenException('request forged');
      }

      const checkCommission = await this.commissionModel.findOne({
        collect_id: new Types.ObjectId(transaction_id),
      });

      if (checkCommission) {
        throw new BadRequestException('Commission already updated');
      }

      await new this.commissionModel({
        school_id: new Types.ObjectId(school_id),
        trustee_id: new Types.ObjectId(trustee_id),
        commission_amount,
        payment_mode,
        collect_id: new Types.ObjectId(transaction_id),
      }).save(); // ERP Commission

      await new this.earningsModel({
        school_id: new Types.ObjectId(school_id),
        trustee_id: new Types.ObjectId(trustee_id),
        payment_mode,
        earnings_amount,
        collect_id: new Types.ObjectId(transaction_id),
      }).save(); //edviron Earnings

      return {
        status: 'successful',
        msg: 'Commission and Earnings are Updated Successfully',
      };
    } catch (err) {
      throw new Error(err.message);
    }
  }

  @Post('add-commission')
  async addCommission(
    @Body()
    body: {
      token: string;
      school_id: string;
      trustee_id: string;
      order_amount: number;
      transaction_amount: number;
      payment_mode: string;
      platform_type: string;
      collect_id: string;
    },
  ) {
    const {
      payment_mode,
      platform_type,
      order_amount,
      token,
      school_id,
      trustee_id,
      collect_id,
    } = body;
    try {
      const decrypted = this.jwtService.verify(token, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });

      if (
        decrypted.school_id != school_id ||
        decrypted.trustee_id != trustee_id ||
        decrypted.order_amount != order_amount ||
        decrypted.payment_mode != payment_mode ||
        decrypted.platform_type != platform_type ||
        decrypted.collect_id != collect_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const checkCommision = await this.commissionModel.findOne({
        collect_id: new Types.ObjectId(collect_id),
      });
      // if(checkCommision){
      //   throw new BadRequestException('Commission already updated');
      // }

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException(`School not found for ${school_id}`);
      }
      const trustee = await this.trusteeModel.findById(trustee_id);

      if (!trustee) {
        throw new NotFoundException(`Trustee not found for ${trustee_id}`);
      }
      const baseMdr = await this.baseMdrModel.findOne({
        trustee_id: trustee._id,
      });
      if (!baseMdr) {
        throw new ConflictException('Trustee has no Base MDR set ');
      }

      const school_platform_charges = school.platform_charges; //MDR 2 charges
      const trustee_platform_charges = baseMdr.platform_charges; //Trustee base rate charges
      let paymentMode = payment_mode;
      if (
        platform_type === 'CreditCard' ||
        platform_type === 'DebitCard' ||
        platform_type === 'CORPORATE CARDS'
      ) {
        paymentMode = payment_mode.split(' ')[0];
      }

      const school_commission = await this.erpService.calculateCommissions(
        school_platform_charges,
        paymentMode,
        platform_type,
        order_amount,
      ); //MDR2 amount
      const trustee_base = await this.erpService.calculateCommissions(
        trustee_platform_charges,
        paymentMode,
        platform_type,
        order_amount,
      ); // trustee base rate amount

      const erpCommission = school_commission - trustee_base; // ERP/Trustee commission(MDR2-Trustee Base rate)
      // const edvCommission = trustee_base - cashfree_commission; // Edviron Earnings (Trustee base rate - cashfree Commission)
      const erpCommissionWithGST = erpCommission + erpCommission * 0.18;

      await this.commissionModel.findOneAndUpdate(
        { collect_id: new Types.ObjectId(collect_id) }, // Filter by collect_id
        {
          $set: {
            school_id,
            trustee_id,
            commission_amount: erpCommissionWithGST,
            payment_mode,
            platform_type,
            collect_id: new Types.ObjectId(collect_id),
          },
        },
        { upsert: true, new: true }, // upsert: true will insert a new document if no matching document is found
      );

      return {
        status: 'successful',
        msg: 'Commission and Earnings are Updated Successfully',
      };
    } catch (err) {
      throw new Error(err.message);
    }
  }

  @Get('school-info')
  async getSchoolInfo(@Body() body: { school_id: string; token: string }) {
    const { school_id, token } = body;
    const decrypted = this.jwtService.verify(token, {
      secret: process.env.PAYMENTS_SERVICE_SECRET,
    });
    if (decrypted.school_id !== school_id) {
      throw new UnauthorizedException('token forged');
    }

    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });

    return { school_name: school.school_name };
  }

  @Get('school-data')
  async getSchoolData(@Req() req: any) {
    const { school_id } = req.query;
    // const decrypted = this.jwtService.verify(token, {
    //   secret: process.env.PAYMENTS_SERVICE_SECRET,
    // });
    // if (decrypted.school_id !== school_id) {
    //   throw new UnauthorizedException('token forged');
    // }

    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });

    return { school_name: school.school_name };
  }

  @Get('trustee-logo')
  async getTrusteeLogo(
    @Body() body: { token: string },
    @Query('trustee_id') trustee_id: string,
  ) {
    try {
      const trustee = await this.trusteeModel.findById(trustee_id);
      const decrypted = await this.jwtService.verify(body.token, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      if (decrypted.trustee_id !== trustee_id) {
        throw new UnauthorizedException('Unauthorized User');
      }
      if (!trustee) {
        throw new NotFoundException('trustee not found');
      }
      if (trustee.logo) {
        return { status: 'success', logo: trustee.logo };
      }

      return { status: 'failed' };
    } catch (e) {
      throw new Error(e.message);
    }
  }

  @Get('/test-cron')
  async checkSettlement() {
    const settlementDate = new Date('2025-01-27T23:59:59.695Z');
    const date = new Date(settlementDate.getTime());

    // date.setUTCHours(0, 0, 0, 0); // Use setUTCHours to avoid time zone issues

    // const day = String(date.getDate()).padStart(2, '0');
    // const month = String(date.getMonth() + 1).padStart(2, '0');
    // const year = date.getFullYear();

    // const formattedDateString = `${day}-${month}-${year}`; //eazebuzz accepts date in DD-MM-YYYY formal seprated with - like '19-07-2024'

    // return formattedDateString
    // const data = await this.erpService.easebuzzSettlements(date);
    await this.erpService.sendSettlements(date);
    // return await this.erpService.testSettlementSingle(settlementDate)
  }
  @Get('/test-callback')
  async test(@Req() req: any) {}

  @Get('/upi-pay')
  @UseGuards(ErpGuard)
  async getUpiPay(
    @Query('collect_id') collect_id: string,
    @Query('school_id') school_id: number,
    @Query('sign') sign: string,
  ) {
    if (!sign || !collect_id || !school_id) {
      throw new BadRequestException('Invalid parameters');
    }
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('Invalid school');
      }
      const pg_key = school.pg_key;
      if (!pg_key) {
        throw new NotFoundException(
          'Payment Gateway is Not active yet for this merchant',
        );
      }

      const decrypted = this.jwtService.verify(sign, { secret: pg_key });

      if (decrypted.collect_id !== collect_id) {
        throw new BadRequestException('incorrect sign');
      }
      if (decrypted.school_id !== school_id) {
        throw new BadRequestException('incorrect sign');
      }

      const pg_token = await this.jwtService.sign(
        { collect_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const config = {
        method: 'GET',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/upi-payment?collect_id=${collect_id}&token=${pg_token}`,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };
      const { data: response } = await axios.request(config);
      return response;
    } catch (e) {
      if (e.response?.data?.message) {
        throw new BadRequestException(e.response.data.message);
      }
      throw new BadRequestException(e.message);
    }
  }

  @Get('/upi-data')
  async getUpiData(@Query('collect_id') collect_id: string) {
    try {
      const config = {
        method: 'GET',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/upi-pay-qr?collect_id=${collect_id}`,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };
      var QRCode = require('qrcode');
      const { data: response } = await axios.request(config);

      const qrCodeBase64 = await QRCode.toDataURL(response, {
        margin: 2, // Add margin to the QR code
        width: 300, // Width of the QR code
      });
      return qrCodeBase64;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Get('settlement-transactions')
  async getSettlementTransactions(
    @Query('settlement_id') settlement_id: string,
    @Query('utr_number') utr_number: string,
    @Query('cursor') cursor: string | null,
    @Query('limit') limit: string,
  ) {
    let dataLimit = Number(limit) || 10;

    if (dataLimit < 10 || dataLimit > 1000) {
      throw new BadRequestException('Limit should be between 10 and 1000');
    }
    let utrNumber = utr_number;
    try {
      if (settlement_id) {
        const settlement = await this.settlementModel.findById(settlement_id);
        if (!settlement) {
          throw new NotFoundException(
            'Settlement not found for ' + settlement_id,
          );
        }
        utrNumber = settlement.utrNumber;
      }
      const settlement = await this.settlementModel.findOne({
        utrNumber: utrNumber,
      });
      const client_id = settlement.clientId;
      const token = this.jwtService.sign(
        { utrNumber, client_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );

      const paginationData = {
        cursor: cursor,
        limit: dataLimit,
      };

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/settlements-transactions?token=${token}&utr=${utrNumber}&client_id=${client_id}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: paginationData,
      };

      const { data: transactions } = await axios.request(config);
      const { settlements_transactions } = transactions;

      return {
        limit: transactions.limit,
        cursor: transactions.cursor,
        settlements_transactions,
      };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('initiate-refund')
  async initiateRefund(
    @Body()
    body: {
      sign: string;
      refund_amount: number;
      school_id: string;
      order_id: string;
      refund_note: string;
    },
    @Req() req: any,
  ) {
    const { school_id, sign, refund_amount, order_id, refund_note } = body;

    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) {
      throw new NotFoundException('Invalid School Id ');
    }

    const pg_key = school.pg_key;
    const client_id = school.client_id;
    if (!pg_key && !client_id) {
      throw new NotFoundException(
        'Payment Gateway not enabled for this school',
      );
    }

    const decrypted = this.jwtService.verify(sign, { secret: pg_key });
    if (decrypted.school_id !== school_id && decrypted.order_id !== order_id) {
      throw new BadRequestException('Invalid Sign');
    }

    const checkRefundRequest = await this.refundRequestModel
      .findOne({
        order_id: new Types.ObjectId(order_id),
      })
      .sort({ createdAt: -1 });

    if (checkRefundRequest?.status === refund_status.INITIATED) {
      throw new BadRequestException(
        'Refund request already initiated for this order',
      );
    }
    const pg_token = this.jwtService.sign(
      { school_id, collect_request_id: order_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );
    let pgConfig = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/transaction-info`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: { school_id, collect_request_id: order_id, token: pg_token },
    };

    const response = await axios.request(pgConfig);

    const custom_id = response.data[0].custom_order_id;
    const order_amount = response.data[0].order_amount;
    const transaction_amount = response.data[0].transaction_amount;

    if (refund_amount > order_amount) {
      throw new BadRequestException(
        'Refund amount cannot be greater than order amount',
      );
    }

    if (checkRefundRequest?.status === refund_status.APPROVED) {
      const totalRefunds = await this.refundRequestModel.find({
        order_id: new Types.ObjectId(order_id),
        status: refund_status.APPROVED,
      });
      let totalRefundAmount = 0;
      totalRefunds.map((refund: any) => {
        totalRefundAmount += refund.refund_amount;
      });

      const refundableAmount =
        checkRefundRequest.transaction_amount - totalRefundAmount;

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
    }).save();

    return `Refund Request Created`;
  }
  catch(error) {
    throw new BadRequestException(error.message);
  }

  @Post('settlement-recons')
  async settlementRecons(
    @Body()
    body: {
      trustee_id: string;
      school_id: string;
      settlement_date: string;
      transaction_start_date: string;
      transaction_end_date: string;
    },
  ) {
    const {
      trustee_id,
      school_id,
      settlement_date,
      transaction_start_date,
      transaction_end_date,
    } = body;
    return await this.trusteeService.reconSettlementAndTransaction(
      trustee_id,
      school_id,
      settlement_date,
      transaction_start_date,
      transaction_end_date,
    );
  }

  @UseGuards(ErpGuard)
  @Post('payment-capture')
  async paymentCapture(
    @Body()
    body: {
      collect_id: string;
      amount: number;
      capture: string;
      school_id: string;
      sign: string;
    },
  ) {
    const { collect_id, amount, school_id, sign, capture } = body;
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('Invalid School Id');
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });

      if (decoded.collect_id !== collect_id) {
        throw new BadRequestException('Fordge request');
      }
      const payload = {
        collect_id,
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/payment-capture`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        data: {
          collect_id,
          amount,
          capture,
          token,
        },
      };

      const response = await axios.request(config);
      const data = response.data;

      const { captureInfo, paymentInfo } = data;

      // const captureData = await this.CapturetModel.findOneAndUpdate(
      //   { collect_id: collect_id },
      //   {
      //     $set: {
      //       school_id: new Types.ObjectId(school_id),
      //       trustee_id: school.trustee_id,
      //       collect_id: collect_id,
      //       custom_order_id: paymentInfo.custom_order_id,
      //       order_amount: paymentInfo.order_amount,
      //       payment_amount: paymentInfo.payment_amount,
      //       action: captureInfo.authorization.action,
      //       capture_status: captureInfo.authorization.status,
      //       capture_start_date: new Date(captureInfo.authorization.start_time),
      //       capture_end_date: new Date(captureInfo.authorization.end_time),
      //       approve_by: new Date(captureInfo.authorization.approve_by),
      //       action_reference: captureInfo.authorization.action_reference,
      //       capture_amount: captureInfo.authorization.captured_amount,
      //       is_captured: captureInfo.is_captured,
      //       error_details: captureInfo.error_details,
      //       auth_id: captureInfo.auth_id,
      //       bank_reference: captureInfo.bank_reference,
      //     },
      //   },
      //   { upsert: true, new: true },
      // );

      const res = {
        auth_id: data.auth_id,
        authorization: {
          action: data.authorization.action,
          status: data.authorization.status,
          captured_amount: data.authorization.captured_amount,
          start_time: data.authorization.start_time,
          end_time: data.authorization.end_time,
          action_reference: data.authorization.action_reference,
          approve_by: data.authorization.approve_by,
          action_time: data.authorization.action_time,
        },
        order_id: data.order_id,
        bank_reference: data.bank_reference,
        order_amount: data.order_amount,
        payment_amount: data.payment_amount,
        payment_completion_time: data.payment_completion_time,
        payment_currency: data.payment_currency,
        payment_group: data.payment_group,
        payment_method: data.payment_method,
        payment_status: data.payment_status,
        payment_type: data.payment_type,
      };
      return res;
    } catch (e) {
      if (e.message === 'Fordge request') {
        throw new BadRequestException('Fordge request');
      }
      if (e.response?.data.message) {
        if (e.response.data.message.startsWith('Capture/Void')) {
          throw new BadRequestException(
            'Capture/Void not enabled for your merchant account',
          );
        }
        throw new BadRequestException(e.response.data.message);
      }
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Get('get-order-link')
  async getOrderLink(
    @Query()
    query: {
      sign: string;
      collect_id: string;
      school_id: string;
    },
  ) {
    const { sign, collect_id, school_id } = query;
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('Invalid School Id');
      }
      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (decoded.collect_id === !collect_id) {
        throw new BadRequestException('Invalid Sign');
      }
      const payload = {
        collect_id,
      };
      const token = this.jwtService.sign(payload, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });

      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-order-payment-link?token=${token}&collect_id=${collect_id}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
      };
      const response = await axios.request(config);
      return response.data;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Get('/v2/check-status')
  async checkPaymentStatus(
    @Query('sign') sign: string,
    @Query('school_id') school_id: string,
    @Query('collect_id') collect_id?: string,
    @Query('custom_order_id') custom_order_id?: string,
  ) {
    try {
      if (collect_id && custom_order_id) {
        throw new BadRequestException(
          'Either collect_id or custom_order_id should be provided',
        );
      }
      if (!collect_id && !custom_order_id) {
        throw new BadRequestException(
          'Either collect_id or custom_order_id should be provided',
        );
      }

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('Invalid School Id');
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      let query: any = {};
      if (collect_id) {
        if (decoded.collect_id !== collect_id) {
          throw new BadRequestException('Sign fordge');
        }
        query = {
          _id: new Types.ObjectId(collect_id),
        };
      } else if (custom_order_id) {
        if (decoded.custom_order_id !== custom_order_id) {
          throw new BadRequestException('Sign fordge');
        }
        query = {
          custom_order_id,
        };
      }

      throw new NotFoundException('Payment Status Not Found');
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Get('school-logo')
  async getSchoolLogo(@Query('school_id') school_id: string) {
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('school not found');
      }
      if (school.logo) {
        return { logo: true, url: school.logo };
      }
      return { logo: false, url: null };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('create-signature')
  async createSignature(
    @Body() body: { payload: any; school_id: string; pg_key: string },
    @Req() req: any,
  ) {
    try {
      const trustee_id = req.userTrustee.id;
      const { payload, school_id, pg_key } = body;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
        trustee_id,
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }
      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }
      if (school.pg_key !== pg_key) {
        throw new BadRequestException('Invalid PG Key');
      }
      const sign = this.jwtService.sign(payload, { secret: school.pg_key });
      return { sign };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('vendor-settlements-recon')
  async vendorSettlementRecon(
    @Body()
    body: {
      limit: number;
      utr: string;
      school_id: string;
      cursor?: string;
    },
  ) {
    const { limit, utr, cursor, school_id } = body;
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School not found');
      }
      if (limit < 10 && limit > 1000) {
        throw new BadRequestException(
          `Pagination limit must be between 10 to 1000`,
        );
      }
      const vendorsSettlements = await this.VendorsSettlementModel.findOne({
        utr,
      });
      if (vendorsSettlements.school_id.toString() !== school_id) {
        throw new BadRequestException('Invalid School ID');
      }
      if (!vendorsSettlements) {
        throw new BadRequestException('UTR not found');
      }
      const { settlement_id, client_id, vendor_id } = vendorsSettlements;
      const data = {
        limit,
        merchant_vendor_id: vendor_id,
        settlement_id,
        client_id,
        cursor: cursor || null,
      };
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/vendor-settlement-reconcilation`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data,
      };
      const { data: response } = await axios.request(config);
      return response;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('erp-get-transactions')
  async getEprTransactions(@Req() req: any, @Body() body: any) {
    const { userTrustee } = req;
    let { start_date, end_date, payment_modes, status, page, limit } = body;
    payment_modes = [payment_modes];
    const trustee_id = userTrustee.id;
    let isQRCode = false;
    if (payment_modes[0] === 'qr_pay') {
      isQRCode = true;
      payment_modes = null;
    }
    try {
      if (!trustee_id) {
        throw new BadRequestException('trustee not found');
      }
      if (limit > 1000) {
        throw new BadRequestException('Limit should be less than 1000');
      }
      const merchants = await this.trusteeSchoolModel.find({
        trustee_id: trustee_id,
      });
      const merchant_ids_to_merchant_map = {};
      merchants.map((merchant: any) => {
        merchant_ids_to_merchant_map[merchant.school_id] = merchant;
      });

      let token = this.jwtService.sign(
        { trustee_id: trustee_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );

      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: trustee_id,
          token,
          payment_modes,
          isQRCode,
        },
        params: {
          status,
          startDate: start_date,
          endDate: end_date,
          page,
          limit,
          school_id: 'null',
        },
      };
      const response = await axios.request(config);

      const total_pages = Math.ceil(response.data.totalTransactions / limit);
      const transactions = response.data.transactions.map((item: any) => {
        const date = new Date(item.updatedAt);
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
          formattedDate: `${date.getFullYear()}-${String(
            date.getMonth() + 1,
          ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        };
      });
      return {
        page,
        limit,
        transactions,
        total_records: response.data.totalTransactions,
        total_pages,
      };
    } catch (error) {
      console.error('Error in getSuccessTransactions:', error);
      throw new BadRequestException('Error fetching success transactions');
    }
  }

  @UseGuards(ErpGuard)
  @Post('erp-get-transactions/:school_id')
  async getEprTransactionsSchoolId(
    @Req() req: any,
    @Body() body: any,
    @Param('school_id') school_id: string,
  ) {
    const trustee_id = req.userTrustee.id;
    let { start_date, end_date, payment_modes, status, page, limit } = body;
    payment_modes = [payment_modes];
    let isQRCode = false;
    if (payment_modes[0] === 'qr_pay') {
      isQRCode = true;
      payment_modes = null;
    }

    try {
      if (!trustee_id) {
        throw new BadRequestException('trustee not found');
      }
      if (limit > 1000) {
        throw new BadRequestException('Limit should be less than 1000');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) {
        throw new BadRequestException('school not found');
      }
      const merchants = await this.trusteeSchoolModel.find({
        trustee_id: trustee_id,
      });
      const merchant_ids_to_merchant_map = {};
      merchants.map((merchant: any) => {
        merchant_ids_to_merchant_map[merchant.school_id] = merchant;
      });
      let token = this.jwtService.sign(
        { trustee_id: trustee_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: {
          trustee_id: trustee_id,
          token,
          payment_modes,
          isQRCode,
        },
        params: {
          status,
          startDate: start_date,
          endDate: end_date,
          page,
          limit,
          school_id: 'null',
        },
      };
      const response = await axios.request(config);
      // console.log(response.data, 'response data');
      const total_pages = Math.ceil(response.data.totalTransactions / limit);
      const transactions = response.data.transactions.map((item: any) => {
        const date = new Date(item.updatedAt);
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
          formattedDate: `${date.getFullYear()}-${String(
            date.getMonth() + 1,
          ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        };
      });
      return {
        page,
        limit,
        transactions,
        total_records: response.data.totalTransactions,
        total_pages,
      };
    } catch (error) {
      console.error('Error in getSuccessTransactions:', error);
      throw new BadRequestException('Error fetching success transactions');
    }
  }

  @UseGuards(ErpGuard)
  @Post('create-virtual-account')
  async createVirtualAccount(
    @Req() req: any,
    @Body()
    body: {
      student_id: string;
      student_name: string;
      student_email: string;
      student_number: string;
      school_id: string;
      sign: string;
    },
  ) {
    const trustee_id = req.userTrustee.id;
    const requiredFields = [
      'student_id',
      'student_name',
      'student_email',
      'student_number',
      'school_id',
      'sign',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        throw new BadRequestException(`${field} is required`);
      }
    }

    const {
      student_email,
      student_id,
      student_name,
      student_number,
      school_id,
      sign,
    } = body;

    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) {
        throw new BadRequestException('INVALID school_id');
      }
      if (trustee_id.toString() !== school.trustee_id.toString()) {
        throw new BadRequestException('Invalid School id');
      }
      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
        );
      }
      const decodedPayload = this.jwtService.verify(sign, {
        secret: school.pg_key,
      });

      if (
        decodedPayload.school_id !== school_id ||
        decodedPayload.student_id !== student_id
      ) {
        throw new UnauthorizedException('Invalid SIGN');
      }
      const checkVirtualAccount = await this.VirtualAccountModel.findOne({
        student_id,
      });
      if (checkVirtualAccount) {
        throw new ConflictException(
          'Students Virtual account is already created with student id ' +
            student_id,
        );
      }

      if (!school.cf_x_client_id || !school.cf_x_client_secret) {
        throw new BadRequestException(
          `Virtual account is not ennabled for your account. Kindly contact us at tarun.k@edviron.com.`,
        );
      }
      const virtualAccountId =
        await this.erpService.generateUniqueVirtualAccountId();
      const virtualAccount = await this.VirtualAccountModel.create({
        school_id: school.school_id,
        trustee_id: school.trustee_id,
        status: 'INITIATED',
        student_email,
        student_id,
        student_name,
        student_number,
        notification_group: 'test',
        gateway: 'CASHFREE',
        virtual_account_id: virtualAccountId,
      });
      const token = await this.jwtService.sign(
        { school_id: school_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET },
      );
      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/create-vba`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          cf_x_client_id: school.cf_x_client_id,
          cf_x_clien_secret: school.cf_x_client_secret,
          school_id,
          token,
          virtual_account_details: {
            virtual_account_id: virtualAccount.virtual_account_id,
            virtual_account_name: school.school_name,
            virtual_account_email: school.email,
            virtual_account_phone: school.phone_number,
          },
          notification_group: virtualAccount.notification_group || 'test',
        },
      };

      const { data: response } = await axios.request(config);
      const details = {
        status: response.virtual_bank_accounts[0].status,
        vba_account_number:
          response.virtual_bank_accounts[0].vba_account_number,
        vba_ifsc: response.virtual_bank_accounts[0].vba_ifsc,
        vba_status: response.virtual_bank_accounts[0].vba_status,
      };
      virtualAccount.status = details.vba_status;
      virtualAccount.virtual_account_number = details.vba_account_number;
      virtualAccount.virtual_account_ifsc = details.vba_ifsc;
      await virtualAccount.save();
      return details;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Get('get-student-vba')
  async getStudentVBA(@Req() req: any) {
    const { vba_account_number, school_id, amount, collect_id, token } = req.query;
    try {
      console.log(
        { vba_account_number, school_id, amount, collect_id, token }
      );
      
      const decodedPayload = await this.jwtService.verify(token, {
        secret: process.env.PAYMENTS_SERVICE_SECRET,
      });
      if (decodedPayload.vba_account_number !== vba_account_number) {
        throw new BadRequestException('Invalid token');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        console.log('not school');
        
        return {
          isSchoolVBA: false,
          isStudentVBA: false,
          virtual_account_number: '',
          virtual_account_ifsc: '',
          finalAmount: 0,
          beneficiary_bank_and_address: 'AXIS BANK,5TH FLOOR, GIGAPLEX, AIROLI KNOWLEDGE PARK, AIROLI, MUMBAI',
          beneficiary_name: '',
          refrence_no: collect_id,
          transaction_id: collect_id,
          cutomer_name: '',
          cutomer_no: '',
          customer_email: '',
          customer_id: '',
        };
      }
      const beneficiary_bank_and_address =
       'AXIS BANK,5TH FLOOR, GIGAPLEX, AIROLI KNOWLEDGE PARK, AIROLI, MUMBAI';
      const beneficiary_name = school.school_name;
      if (!school.isVBAActive) {
        return {
          isSchoolVBA: false,
          isStudentVBA: false,
          virtual_account_number: '',
          virtual_account_ifsc: '',
          finalAmount: 0,
          beneficiary_bank_and_address,
          beneficiary_name,
          refrence_no: collect_id,
          transaction_id: collect_id,
          cutomer_name: '',
          cutomer_no: '',
          customer_email: '',
          customer_id: '',
        };
      }
      const virtualAccount = await this.VirtualAccountModel.findOne({
        virtual_account_number: vba_account_number,
      });
      if (!virtualAccount) {
        return {
          isSchoolVBA: true,
          isStudentVBA: false,
          virtual_account_number: '',
          virtual_account_ifsc: '',
          finalAmount: 0,
          beneficiary_bank_and_address,
          beneficiary_name,
          refrence_no: collect_id,
          transaction_id: collect_id,
          cutomer_name: '',
          cutomer_no: '',
          customer_email: '',
          customer_id: '',
        };
      }
      const platformCharge = await this.erpService.getPlatformCharge(
        school_id,
        'vba',
        'Others',
        amount,
      );
      const finalAmount = virtualAccount.max_amount;
      return {
        isSchoolVBA: true,
        isStudentVBA: true,
        virtual_account_number: virtualAccount.virtual_account_number,
        virtual_account_ifsc: virtualAccount.virtual_account_ifsc,
        finalAmount,
        beneficiary_bank_and_address,
        beneficiary_name,
        refrence_no: collect_id,
        transaction_id: collect_id,
        cutomer_name: virtualAccount.student_name,
        cutomer_no: virtualAccount.student_number,
        customer_email: virtualAccount.student_email,
        customer_id: virtualAccount.student_id,
      };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }
}
