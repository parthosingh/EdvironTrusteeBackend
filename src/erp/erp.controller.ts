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
} from '@nestjs/common';
import { ErpService } from './erp.service';
import { JwtService } from '@nestjs/jwt';
import { ErpGuard } from './erp.guard';
import { InjectModel, Schema } from '@nestjs/mongoose';
import { TrusteeSchool } from '../schema/school.schema';
import mongoose, { Types } from 'mongoose';
import axios from 'axios';
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
import { Trustee } from 'src/schema/trustee.schema';
import { Commission } from 'src/schema/commission.schema';
import { Earnings } from 'src/schema/earnings.schema';
import { BaseMdr } from 'src/schema/base.mdr.schema';
import { TrusteeService } from 'src/trustee/trustee.service';
import QRCode from 'qrcode';
import { refund_status, RefundRequest } from 'src/schema/refund.schema';
import { Capture } from 'src/schema/capture.schema';
// import cf_commision from 'src/utils/cashfree.commission'; // hardcoded cashfree charges change this according to cashfree
import * as qs from 'qs';
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
      let PaymnetWebhookUrl: any = req_webhook_urls;
      if (req_webhook_urls && !Array.isArray(req_webhook_urls)) {
        const decodeWebhookUrl = decodeURIComponent(req.body.req_webhook_urls);
        console.log(decodeWebhookUrl);
        PaymnetWebhookUrl = decodeWebhookUrl
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
      let PGVendorInfo: any = vendors_info;
      if (split_payments && vendors_info && !Array.isArray(vendors_info)) {
        const decoded_vendor_info = decodeURIComponent(req.body.vendors_info);
        PGVendorInfo = JSON.parse(decoded_vendor_info);
        console.log(PGVendorInfo, 'v');
        console.log(typeof PGVendorInfo);
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
          console.log(vendor, 'vendor');

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
        split_payments: splitPay || false,
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
      console.log(error);
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      if (error?.response?.data?.message) {
        throw new ConflictException(error.response.data.message);
      }
      console.log('error in create collect request', error);
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
      console.log(reseller_name, 'reseller_name');

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
      console.log(decoded);

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
      console.log('error in create collect request', error);
      throw error;
    }
  }

  @Get('collect-request/:collect_request_id')
  @UseGuards(ErpGuard)
  async getCollectRequestStatus(@Req() req) {
    try {
      const trustee_id = req.userTrustee.id;
      console.log(trustee_id);

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
      console.log(decoded);
      console.log(collect_request_id, school_id);

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
      console.log('error in collect request status check', error);
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

      const config = {
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
      console.log('error in collect request status check', error);
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
      if (!body.student_name) throw new NotFoundException('school id required');
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

        console.log('mail sent');
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

        console.log('whatsaap sent');
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
      console.log(error);
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
      console.log(error);
      if (error?.response?.data) {
        throw new BadRequestException(error?.response?.data?.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('webhook')
  async webhook(@Body() body, @Res() res) {
    try {
      console.log('webhook called', body);

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
        console.log('trustee not found while sending webhook');
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
      console.log('error in sending-webhook', error);
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
      console.log(checkCommission);

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
    const settlementDate = new Date('2025-01-13T23:59:59.695Z');
    const date = new Date(settlementDate.getTime());
    // console.log(date, 'DATE');
    // date.setUTCHours(0, 0, 0, 0); // Use setUTCHours to avoid time zone issues
    // console.log(date);

    // const day = String(date.getDate()).padStart(2, '0');
    // const month = String(date.getMonth() + 1).padStart(2, '0');
    // const year = date.getFullYear();

    // const formattedDateString = `${day}-${month}-${year}`; //eazebuzz accepts date in DD-MM-YYYY formal seprated with - like '19-07-2024'
    // console.log(formattedDateString, 'formant date');
    // return formattedDateString
    // const data = await this.erpService.easebuzzSettlements(date);
    await this.erpService.sendSettlements(date);
    // return await this.erpService.testSettlementSingle(settlementDate)
  }
  @Get('/test-callback')
  async test(@Req() req: any) {
    console.log(req.query);
    console.log(req.body);
    console.log(req.params);
    console.log(req.headers);
    console.log(req.ip);
    console.log(req.hostname);
    console.log(req.protocol);
    console.log(req.secure);
    console.log(req.connection.remoteAddress);
    console.log(req.originalUrl);
    console.log(req.baseUrl);
    console.log(req.path);
    console.log(req.method);
  }

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
      console.log(decrypted, 'dat');
      console.log({ school_id, collect_id });

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
      console.log(QRCode);

      const qrCodeBase64 = await QRCode.toDataURL(response, {
        margin: 2, // Add margin to the QR code
        width: 300, // Width of the QR code
      });
      return qrCodeBase64;
    } catch (e) {
      console.log(e);
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
      console.log(e);

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
    console.log({ refund_amount });

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
    console.log(refund_amount);

    const custom_id = response.data[0].custom_order_id;
    const order_amount = response.data[0].order_amount;
    const transaction_amount = response.data[0].transaction_amount;
    console.log(custom_id, order_amount, transaction_amount);

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
    console.log('pp');

    const { collect_id, amount, school_id, sign, capture } = body;
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('Invalid School Id');
      }
      console.log(school);

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (decoded.collect_id === !collect_id) {
        throw new BadRequestException('Invalid Collect Id');
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
      console.log(data);

      const { captureInfo, paymentInfo } = data;

      const captureData = await this.CapturetModel.findOneAndUpdate(
        { collect_id: collect_id },
        {
          $set: {
            school_id: new Types.ObjectId(school_id),
            trustee_id: school.trustee_id,
            collect_id: collect_id,
            custom_order_id: paymentInfo.custom_order_id,
            order_amount: paymentInfo.order_amount,
            payment_amount: paymentInfo.payment_amount,
            action: captureInfo.authorization.action,
            capture_status: captureInfo.authorization.status,
            capture_start_date: new Date(captureInfo.authorization.start_time),
            capture_end_date: new Date(captureInfo.authorization.end_time),
            approve_by: new Date(captureInfo.authorization.approve_by),
            action_reference: captureInfo.authorization.action_reference,
            capture_amount: captureInfo.authorization.captured_amount,
            is_captured: captureInfo.is_captured,
            error_details: captureInfo.error_details,
            auth_id: captureInfo.auth_id,
            bank_reference: captureInfo.bank_reference,
          },
        },
        { upsert: true, new: true },
      );
      const res = {
        auth_id: captureData.auth_id,
        captured_amount: captureData.capture_amount,
        capture_status: captureData.capture_status,
        action: captureData.action,
        is_captured: captureData.is_captured,
      };
      return res;
    } catch (e) {
      // console.log(e);
      if (e.response?.data.message) {
        console.log(e.response.data);
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
}

const captureData = {
  cf_payment_id: '12376123',
  order_id: 'order_8123',
  entity: 'payment',
  payment_currency: 'INR',
  error_details: null,
  order_amount: 10.01,
  is_captured: true,
  payment_group: 'upi',
  authorization: {
    action: 'CAPTURE',
    status: 'PENDING',
    captured_amount: 100,
    start_time: '2022-02-09T18:04:34+05:30',
    end_time: '2022-02-19T18:04:34+05:30',
    approve_by: '2022-02-09T18:04:34+05:30',
    action_reference: '6595231908096894505959',
    action_time: '2022-08-03T16:09:51',
  },
  payment_method: {
    upi: {
      channel: 'collect',
      upi_id: 'rohit@xcxcx',
    },
  },
  payment_amount: 10.01,
  payment_time: '2021-07-23T12:15:06+05:30',
  payment_completion_time: '2021-07-23T12:18:59+05:30',
  payment_status: 'SUCCESS',
  payment_message: 'Transaction successful',
  bank_reference: 'P78112898712',
  auth_id: 'A898101',
};
