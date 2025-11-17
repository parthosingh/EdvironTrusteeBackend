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
  InternalServerErrorException,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErpService } from './erp.service';
import { JwtService } from '@nestjs/jwt';
import { ErpGuard } from './erp.guard';
import { InjectModel, Schema } from '@nestjs/mongoose';
import { DisabledModes, TrusteeSchool } from '../schema/school.schema';
import mongoose, { isValidObjectId, Types } from 'mongoose';
import * as moment from 'moment-timezone';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { Express } from 'express';
import {
  SettlementReport,
  SettlementSchema,
} from '../schema/settlement.schema';
import { Trustee } from '../schema/trustee.schema';
import { Commission } from '../schema/commission.schema';
import {
  CommissionEarning,
  CommissionEarningSchema,
} from '../schema/earnings.schema';
import { BaseMdr } from '../schema/base.mdr.schema';
import { TrusteeService } from '../trustee/trustee.service';
import QRCode from 'qrcode';
import { refund_status, RefundRequest } from '../schema/refund.schema';
import { Capture } from '../schema/capture.schema';
// import cf_commision from '../utils/cashfree.commission'; // hardcoded cashfree charges change this according to cashfree
import * as qs from 'qs';
import { WebhookLogs } from '../schema/webhook.schema';
import { VendorsSettlement } from 'src/schema/vendor.settlements.schema';
import { GATEWAY, Vendors } from 'src/schema/vendors.schema';
import { Context } from '@nestjs/graphql';
import { PosMachine } from '../schema/pos.machine.schema';
import * as crypto from 'crypto';
import { VirtualAccount } from 'src/schema/virtual.account.schema';
import { Disputes } from 'src/schema/disputes.schema';
import { add } from 'date-fns';
import { generatePaymentEmail } from 'src/email/templates/dipute.template';
const enum PG_GATEWAYS {
  RAZORPAY = 'RAZORPAY',
  CASHFREE = 'CASHFREE',
  EASEBUZZ = 'EASEBUZZ',
  CCAVENUE = 'CCAVENUE',
  HDFC = 'HDFC',
  SMARTGATEWAY = 'SMARTGATEWAY',
  PAYU = 'PAYU',
  NTTDATA = 'NTTDATA',
}
import { CurrencyCode } from 'src/utils/email.group';
import { Readable } from 'stream';
import { Multer } from 'multer'; // <-- important

import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { AwsS3Service } from 'src/aws.s3/aws.s3.service';
import {
  BusinessTypes,
  EasebuzzBankCode,
  EasebuzzPayLater,
  EasebuzzWallets,
  fileType,
  KycBusinessCategory,
  KycBusinessSubCategory,
  KycDocType,
  PaymentMode,
  UpiModes,
} from 'src/utils/enums';
import { SchoolBaseMdr } from 'src/schema/school.base.mdr.schema';
import { stat } from 'fs';
import { CommissionService } from 'src/commission/commission.service';
import { generatePosRequest } from 'src/business-alarm/templates/htmlToSend.format';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';

@Controller('erp')
export class ErpController {
  constructor(
    private erpService: ErpService,
    private readonly jwtService: JwtService,
    private readonly trusteeService: TrusteeService,
    private readonly S3BucketService: AwsS3Service,
    private readonly commissionService: CommissionService,
    @InjectModel(TrusteeSchool.name)
    private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    @InjectModel(SettlementReport.name)
    private settlementModel: mongoose.Model<SettlementReport>,
    @InjectModel(Trustee.name)
    private trusteeModel: mongoose.Model<Trustee>,
    @InjectModel(Commission.name)
    private commissionModel: mongoose.Model<Commission>,
    @InjectModel(CommissionEarning.name)
    private earningsModel: mongoose.Model<CommissionEarning>,
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
    @InjectModel(PosMachine.name)
    private posMachineModel: mongoose.Model<PosMachine>,
    @InjectModel(VirtualAccount.name)
    private VirtualAccountModel: mongoose.Model<VirtualAccount>,
    @InjectModel(Disputes.name)
    private disputeModel: mongoose.Model<Disputes>,
    @InjectModel(SchoolBaseMdr.name)
    private SchoolBaseMdrModel: mongoose.Model<SchoolBaseMdr>,
    private emailService: EmailService,
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
      currency?: CurrencyCode;
      disabled_modes?: DisabledModes[];
      vendors_info?: [
        {
          vendor_id: string;
          percentage?: number;
          amount?: number;
          name?: string;
        },
      ];
      displayName?: string;
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
        currency,
        displayName,
      } = body;
      let { disabled_modes } = body;

      if (disabled_modes) {
        await this.erpService.validateDisabledModes(disabled_modes);
      }

      let splitPay = split_payments;
      if (!school_id) {
        throw new HttpException(
          {
            message: `School id is Required`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      console.log({ amount });

      if (!amount || Number(amount) <= 0) {
        throw new HttpException(
          {
            message: `Invalid Amount`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (!callback_url) {
        throw new HttpException(
          {
            message: `Callback url is Required`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (!sign) {
        throw new HttpException(
          {
            message: `sign is Required`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // if (body.student_phone_no || body.student_email) {
      //   if (!body.student_name) {
      //     throw new BadRequestException('student name is required');
      //   }
      //   // if (!body.reason) {
      //   //   throw new BadRequestException('reason is required');
      //   // }
      // }
      let isVBAPayment = false;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) {
        throw new HttpException(
          {
            message: `Merchant Not found for school_id: ${school_id}`,
            error: 'Not Found Error',
            statusCode: '404',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      const isSelectGateway = school.isMasterGateway || false;

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (!school.pg_key) {
        throw new HttpException(
          {
            message: `PG Gatreway is Not Activated for school_id: ${school_id}`,
            error: 'Forbidden Error',
            statusCode: '403',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      if (school.easebuzz_id && !school.easebuzz_school_label) {
        throw new HttpException(
          {
            message: `Split Information Not Configure Please contact tarun.k@edviron.com`,
            error: 'Bad Request Error',
            statusCode: '400',
          },
          HttpStatus.BAD_REQUEST,
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
            throw new HttpException(
              {
                message: `Student details are required for VBA payment`,
                error: 'Validation Error',
                statusCode: '400',
              },
              HttpStatus.UNPROCESSABLE_ENTITY,
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
          throw new HttpException(
            {
              message: `Invalid Payment Mode for disable Modes`,
              error: 'Forbidden Error',
              statusCode: '403',
            },
            HttpStatus.FORBIDDEN,
          );
        }
        return DisabledModes[validMode];
      });

      // console.log(disabled_modes, 'disabled_modes');

      if (split_payments && !vendors_info) {
        throw new HttpException(
          {
            message: `Vendors information is Required for Split payments`,
            error: 'Forbidden Error',
            statusCode: '403',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      if (split_payments && vendors_info && vendors_info.length < 0) {
        throw new BadRequestException('At least one vendor is required');
      }
      let vendorgateway: any = {};
      const updatedVendorsInfo = [];
      let easebuzzVendors = [];
      let cashfreeVedors = [];
      let worldLine_vendors: any = [];
      let razorpayVendors: any = [];
      // VENDORS LOGIC FOR MULTIPLE GATEWAYS
      if (split_payments && vendors_info && vendors_info.length > 0) {
        // Determine the split method (amount or percentage) based on the first vendor
        let splitMethod = null;
        let totalAmount = 0;
        let totalPercentage = 0;
        if (school.worldline && school.worldline.encryption_key) {
          for (const vendor of vendors_info) {
            if (!vendor.vendor_id) {
              throw new HttpException(
                {
                  message: `Vendor id is Required`,
                  error: 'Bad Request',
                  statusCode: '403',
                },
                HttpStatus.UNPROCESSABLE_ENTITY,
              );
            }
            const vendors_data = await this.trusteeService.getVenodrInfo(
              vendor.vendor_id,
              school_id,
            );
            if (!vendors_data) {
              throw new HttpException(
                {
                  message: `Vendor Not found for ${vendor.vendor_id}`,
                  error: 'Not Found Error',
                  statusCode: '404',
                },
                HttpStatus.NOT_FOUND,
              );
            }

            if (vendors_data.status !== 'ACTIVE') {
              throw new HttpException(
                {
                  message: `Vendor is not Active for ${vendor.vendor_id}`,
                  error: 'Forbidden Error',
                  statusCode: '403',
                },
                HttpStatus.FORBIDDEN,
              );
            }

            if (!vendors_data.gateway?.includes(GATEWAY.WORLDLINE)) {
              throw new HttpException(
                {
                  message: `Split not Active for your Account`,
                  error: 'Forbidden Error',
                  statusCode: '403',
                },
                HttpStatus.FORBIDDEN,
              );
            }
            if (vendor.percentage) {
              throw new BadRequestException(
                'Please pass Amount for WorldLine schools',
              );
            }
            if (
              !vendors_data.worldline_vendor_name &&
              vendors_data.worldline_vendor_id
            ) {
              throw new HttpException(
                {
                  message: `Split not Active for your Account`,
                  error: 'Forbidden Error',
                  statusCode: '403',
                },
                HttpStatus.FORBIDDEN,
              );
            }
            vendorgateway.worldline = true;
            let worldlineVenodr: any = {};
            (worldlineVenodr.vendor_id = vendor.vendor_id),
              (worldlineVenodr.amount = vendor.amount),
              (worldlineVenodr.name = vendors_data.worldline_vendor_name);
            worldlineVenodr.scheme_code = vendors_data.worldline_vendor_id;
            worldLine_vendors.push(worldlineVenodr);
          }
        } else {
          console.time('check vendor');
          for (const vendor of vendors_info) {
            // Check if vendor_id is present
            if (!vendor.vendor_id) {
              throw new HttpException(
                {
                  message: `Vendor id is Required`,
                  error: 'Bad Request',
                  statusCode: '403',
                },
                HttpStatus.UNPROCESSABLE_ENTITY,
              );
            }

            const vendors_data = await this.trusteeService.getVenodrInfo(
              vendor.vendor_id,
              school_id,
            );

            if (!vendors_data) {
              throw new HttpException(
                {
                  message: `Vendor not found for ${vendor.vendor_id}`,
                  error: 'Not Found Error',
                  statusCode: '443',
                },
                HttpStatus.NOT_FOUND,
              );
            }

            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.EASEBUZZ)
            ) {
              if (
                !vendors_data.easebuzz_vendor_id ||
                !school.easebuzz_school_label
              ) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.easebuzz = true;
              let easebuzzVen = vendor;
              easebuzzVen.vendor_id = vendors_data.easebuzz_vendor_id;
              const updatedEZBVendor = {
                ...easebuzzVen,
                name: vendors_data.name,
              };
              easebuzzVendors.push(updatedEZBVendor);
            }

            // VENDORS FOR RAZORPAY
            if (
              vendors_data.gateway &&
              vendors_data.gateway.includes(GATEWAY.RAZORPAY)
            ) {
              console.log('checking vendors for razorpay');
              if (
                school.razorpay &&
                school.razorpay?.razorpay_id &&
                school.razorpay?.razorpay_secret &&
                school.razorpay?.razorpay_mid &&
                !school.razorpay?.razorpay_account
              ) {
                throw new BadRequestException(
                  'Split is not Configured For your Account',
                );
              }

              if (
                school.razorpay_seamless &&
                school.razorpay_seamless?.razorpay_id &&
                school.razorpay_seamless?.razorpay_secret &&
                school.razorpay_seamless?.razorpay_mid &&
                !school.razorpay_seamless?.razorpay_account
              ) {
                throw new BadRequestException(
                  'Split is not Configured For your Account',
                );
              }
              if (!vendors_data.razorpayVendor?.account) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.razorpay = true;
              let razorpayVendor = vendor;
              razorpayVendor.vendor_id = vendors_data.razorpayVendor.account;
              const updatedRazorPayVendor = {
                ...razorpayVendor,
                account: vendors_data.razorpayVendor.account,
                vendor_id: vendors_data._id.toString(),
                name: vendors_data.name,
              };
              console.log(
                updatedRazorPayVendor,
                'checking for updated vendors',
              );
              console.log(vendor, 'checkoing vendors');
              console.log(vendors_data.gateway.includes(GATEWAY.CASHFREE));
              console.log(updatedVendorsInfo, 'updatedben');

              if (!vendors_data.gateway.includes(GATEWAY.CASHFREE)) {
                console.log('cashfree vendor not active');

                updatedVendorsInfo.push({
                  vendor_id: vendors_data._id.toString(),
                  amount: razorpayVendor.amount,
                  name: vendors_data.name,
                });
              }
              razorpayVendors.push(updatedRazorPayVendor);
            }

            // CASHFREE VENDORS
            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.CASHFREE)
            ) {
              if (!vendors_data.vendor_id) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.cashfree = true;
              let CashfreeVen = vendor;
              CashfreeVen.vendor_id = vendors_data.vendor_id;
              const updatedCFVendor = {
                ...CashfreeVen,
                name: vendors_data.name,
              };
              cashfreeVedors.push(updatedCFVendor);
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
            if (!vendors_data.gateway?.includes(GATEWAY.RAZORPAY)) {
              updatedVendorsInfo.push(updatedVendor);
            }

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
                throw new BadRequestException(
                  'Vendor amount cannot be negative',
                );
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
          console.timeEnd('check vendor');
          if (splitMethod === 'amount' && totalAmount > body.amount) {
            throw new BadRequestException(
              'Sum of vendor amounts cannot be greater than the order amount',
            );
          }

          if (splitMethod === 'percentage' && totalPercentage > 100) {
            throw new BadRequestException(
              'Sum of vendor percentages cannot be greater than 100%',
            );
          }

          // ✅ Convert percentage to amount if gateway is EASEBUZZ
          if (splitMethod === 'percentage' && vendorgateway.easebuzz) {
            for (const vendor of easebuzzVendors) {
              if (typeof vendor.percentage === 'number') {
                vendor.amount = (vendor.percentage / 100) * body.amount;
                delete vendor.percentage;
              }
            }
            // Update splitMethod to 'amount' since we converted it
            splitMethod = 'amount';
          }
        }
      }

      // FOR SPARK IT CANTEEN SCHOOLS ONLY
      if (school.isVendor && school.vendor_id) {
        vendorgateway.cashfree = true;
        const updatedVendor = {
          vendor_id: school.vendor_id,
          percentage: 100,
          name: school.school_name,
        };
        splitPay = true;
        cashfreeVedors.push(updatedVendor);
      }

      const adjustedAmount = school.adjustedAmount || 0;

      if (
        school.isAdjustment &&
        Number(amount) >= school.minAdjustmnentAmount &&
        !splitPay
      ) {
        console.log('adjustment');

        if (school.advanceAdjustment) {
          console.log('advance adjustment');

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
            cashfreeVedors.push(updatedVendor);
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
            cashfreeVedors.push(updatedVendor);
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
        throw new HttpException(
          {
            message: `Request Forged | Invalid Sign`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
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
      console.time('payments1');

      if (school.isEasebuzzNonPartner && body.additional_data) {
        for (const [key, value] of Object.entries(body.additional_data)) {
          if (typeof value === 'string') {
            // Check for | or extra spaces
            if (value.includes('|')) {
              throw new BadRequestException(
                `Invalid value for key "${key}": contains "|"`,
              );
            }
            if (value.trim() !== value) {
              throw new BadRequestException(
                `Invalid value for key "${key}": has extra spaces`,
              );
            }
          }
        }
      }

      if (!isSelectGateway && school.isEasebuzzNonPartner) {
        if (
          !school.easebuzz_non_partner ||
          !school.easebuzz_non_partner?.easebuzz_key ||
          !school.easebuzz_non_partner?.easebuzz_salt ||
          !school.easebuzz_non_partner?.easebuzz_submerchant_id
        ) {
          throw new HttpException(
            {
              message: `Gateway not Configured`,
              error: 'Bad Request Error',
              statusCode: '500',
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        if (splitPay && !school.easebuzz_school_label) {
          throw new HttpException(
            {
              message: `Split not Configured`,
              error: 'Bad Request Error',
              statusCode: '500',
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
        const webHookUrl = req_webhook_urls?.length;
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

        const trustee = await this.trusteeModel.findById(school.trustee_id);
        let all_webhooks: string[] = [];
        if (trustee.webhook_urls.length || req_webhook_urls?.length) {
          const trusteeUrls = trustee.webhook_urls.map((item) => item.url);
          all_webhooks = [...(req_webhook_urls || []), ...trusteeUrls];
        }

        if (trustee.webhook_urls.length === 0) {
          all_webhooks = req_webhook_urls || [];
        }

        if (school.nonSeamless) {
          const bodydata = {
            amount,
            callbackUrl: callback_url,
            // jwt,
            webHook: webHookUrl || null,
            disabled_modes,
            platform_charges: school.platform_charges,
            additional_data: additionalInfo,
            school_id,
            trustee_id,
            custom_order_id,
            req_webhook_urls,
            school_name: school.school_name,
            easebuzz_sub_merchant_id:
              school.easebuzz_non_partner.easebuzz_submerchant_id,
            split_payments,
            easebuzzVendors,
            easebuzz_school_label: school.easebuzz_school_label,
            easebuzz_non_partner_cred: school.easebuzz_non_partner,
            additionalDataToggle: school?.additionalDataToggle || false,
          };

          const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/create-order-nonseamless`,
            headers: {
              'Content-Type': 'application/json',
            },
            data: bodydata,
          };

          const res = await axios.request(config);
          const response = {
            collect_request_id: res.data.collect_request_id,
            collect_request_url: res.data.collect_request_url,
            sign: this.jwtService.sign(
              {
                collect_request_id: res.data.collect_request_id,
                collect_request_url: res.data.collect_request_url,
                custom_order_id: custom_order_id || null,
              },
              { noTimestamp: true, secret: school.pg_key },
            ),
            // sign: res.data.jwt,
            // jwt: res.data.jwt
          };

          return response;
          return res.data;
        }

        const bodydata = {
          amount,
          callbackUrl: callback_url,
          // jwt,
          webHook: webHookUrl || null,
          disabled_modes,
          platform_charges: school.platform_charges,
          additional_data: additionalInfo,
          school_id,
          trustee_id,
          custom_order_id,
          req_webhook_urls,
          school_name: school.school_name,
          easebuzz_sub_merchant_id:
            school.easebuzz_non_partner.easebuzz_submerchant_id,
          split_payments,
          easebuzzVendors,
          easebuzz_school_label: school.easebuzz_school_label,
          easebuzz_non_partner_cred: school.easebuzz_non_partner,
          additionalDataToggle: school?.additionalDataToggle || false,
        };

        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/create-order-v2`,
          headers: {
            'Content-Type': 'application/json',
          },
          data: bodydata,
        };

        const res = await axios.request(config);

        const response = {
          collect_request_id: res.data.collect_request_id,
          collect_request_url: res.data.collect_request_url,
          sign: this.jwtService.sign(
            {
              collect_request_id: res.data.collect_request_id,
              collect_request_url: res.data.collect_request_url,
              custom_order_id: custom_order_id || null,
            },
            { noTimestamp: true, secret: school.pg_key },
          ),
          // sign: res.data.jwt,
          // jwt: res.data.jwt
        };

        return response;
      }

      if (
        !isSelectGateway &&
        school.cf_non_partner &&
        school.cashfree_credentials
      ) {
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
          split_payments: splitPay || false,
          vendors_info: updatedVendorsInfo || null,
          vendorgateway: vendorgateway,
          cashfreeVedors,
          disabled_modes: disabled_modes || null,
          easebuzz_school_label: school.easebuzz_school_label || null,
          isVBAPayment: isVBAPayment || false,
          vba_account_number: vba_account_number || 'NA',
          worldLine_vendors: worldLine_vendors || null,
          cashfree_credentials: school.cashfree_credentials || null,
        });
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/create-order-v2`,
          headers: {
            'Content-Type': 'application/json',
          },
          data: data,
        };
        const { data: paymentsServiceResp } = await axios.request(config);
        console.timeEnd('payments1');
        const reason = 'fee payment';

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
        console.log(paymentsServiceResp);

        return {
          collect_request_id: paymentsServiceResp._id,
          collect_request_url: paymentsServiceResp.url,
          sign: this.jwtService.sign(
            {
              collect_request_id: paymentsServiceResp._id,
              collect_request_url: paymentsServiceResp.url,
              custom_order_id: paymentsServiceResp.request?.custom_order_id,
            },
            { noTimestamp: true, secret: school.pg_key },
          ),
        };
      }

      let finalDisplayName =
        displayName || school.display_name || school.school_name;

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
        currency: currency || null,
        clientSecret: school.client_secret || null,
        school_id: school_id,
        trustee_id: trustee_id,
        webHook: webHookUrl || null,
        platform_charges: school.platform_charges,
        additional_data: additionalInfo || {},
        custom_order_id: custom_order_id || null,
        req_webhook_urls: all_webhooks || null,
        school_name: finalDisplayName || null,
        easebuzz_sub_merchant_id: school.easebuzz_id || null,
        ccavenue_access_code: school.ccavenue_access_code || null,
        ccavenue_merchant_id: school.ccavenue_merchant_id || null,
        ccavenue_working_key: school.ccavenue_working_key || null,
        smartgateway_merchant_id: school.smartgateway_merchant_id || null,
        smartgateway_customer_id: additionalInfo?.student_details?.student_id
          ? `${additionalInfo.student_details.student_id}_${Date.now()}`
          : `${Date.now()}`,
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
        worldline_merchant_id: school?.worldline?.merchant_code || null,
        worldline_encryption_key: school?.worldline?.encryption_key || null,
        worldline_encryption_iV: school?.worldline?.encryption_iV || null,
        worldline_scheme_code: school?.worldline?.worldline_scheme_code || null,
        split_payments: splitPay || false,
        vendors_info: updatedVendorsInfo || null,
        vendorgateway: vendorgateway,
        easebuzzVendors,
        cashfreeVedors,
        disabled_modes: disabled_modes || null,
        easebuzz_school_label: school.easebuzz_school_label || null,
        isVBAPayment: isVBAPayment || false,
        vba_account_number: vba_account_number || 'NA',
        razorpay_partner: school.razorpay_partner || false,
        razorpay_credentials: {
          razorpay_id: school.razorpay?.razorpay_id || null,
          razorpay_secret: school.razorpay?.razorpay_secret || null,
          razorpay_mid: school.razorpay?.razorpay_mid || null,
          razorpay_account: school.razorpay?.razorpay_account || null,
        }, //non seamless
        razorpay_seamless_credentials: {
          razorpay_id: school.razorpay_seamless?.razorpay_id || null,
          razorpay_secret: school.razorpay_seamless?.razorpay_secret || null,
          razorpay_mid: school.razorpay_seamless?.razorpay_mid || null,
          razorpay_account: school.razorpay_seamless?.razorpay_account || null,
        }, //seamless
        worldLine_vendors: worldLine_vendors || null,
        isSelectGateway: school.isMasterGateway || false,
        gatepay_credentials: {
          gatepay_mid: school?.gatepay?.gatepay_mid || null,
          gatepay_terminal_id: school?.gatepay?.gatepay_terminal_id || null,
          gatepay_key: school?.gatepay?.gatepay_key || null,
          gatepay_iv: school?.gatepay?.gatepay_iv || null,
        },
        isCashfreeNonpartner: school.cf_non_partner || false,
        cashfree_credentials: school.cashfree_credentials || null,
        easebuzz_non_partner_cred: school.easebuzz_non_partner,
        isEasebuzzNonpartner: school.isEasebuzzNonPartner,
        razorpay_vendors: razorpayVendors,
        additionalDataToggle: school?.additionalDataToggle || false,
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
      console.timeEnd('payments1');
      const reason = 'fee payment';

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
      if (error instanceof HttpException) {
        throw error;
      }
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
      try {
        await this.webhooksLogsModel.create({
          type: 'adjustment_check',
          body: JSON.stringify(body),
        });
      } catch (e) {
        console.log(e);
      }
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
      // if (body.student_phone_no || body.student_email) {
      //   if (!body.student_name) {
      //     throw new BadRequestException('student name is required');
      //   }
      //   // if (!body.reason) {
      //   //   throw new BadRequestException('reason is required');
      //   // }
      // }
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
      if (school.easebuzz_id && !school.easebuzz_school_label) {
        throw new BadRequestException(
          `Split Information Not Configure Please contact tarun.k@edviron.com`,
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
      let vendorgateway: any = {};
      const updatedVendorsInfo = [];
      let easebuzzVendors = [];
      let cashfreeVedors = [];
      let worldLine_vendors: any = [];
      // VENDORS LOGIC FOR MULTIPLE GATEWAYS
      if (split_payments && vendors_info && vendors_info.length > 0) {
        // Determine the split method (amount or percentage) based on the first vendor
        let splitMethod = null;
        let totalAmount = 0;
        let totalPercentage = 0;
        if (school.worldline && school.worldline.encryption_key) {
          for (const vendor of vendors_info) {
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
            if (!vendors_data.gateway?.includes(GATEWAY.WORLDLINE)) {
              throw new BadRequestException('Split Not configure');
            }
            if (vendor.percentage) {
              throw new BadRequestException(
                'Please pass Amount for WorldLine schools',
              );
            }
            if (
              !vendors_data.worldline_vendor_name &&
              vendors_data.worldline_vendor_id
            ) {
              throw new BadRequestException('Split Not Configure');
            }
            vendorgateway.worldline = true;
            let worldlineVenodr: any = {};
            (worldlineVenodr.vendor_id = vendor.vendor_id),
              (worldlineVenodr.amount = vendor.amount),
              (worldlineVenodr.name = vendors_data.worldline_vendor_name);
            worldlineVenodr.scheme_code = vendors_data.worldline_vendor_id;
            worldLine_vendors.push(worldlineVenodr);
          }
        } else {
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

            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.EASEBUZZ)
            ) {
              if (
                !vendors_data.easebuzz_vendor_id ||
                !school.easebuzz_school_label
              ) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.easebuzz = true;
              let easebuzzVen = vendor;
              easebuzzVen.vendor_id = vendors_data.easebuzz_vendor_id;
              const updatedEZBVendor = {
                ...easebuzzVen,
                name: vendors_data.name,
              };
              easebuzzVendors.push(updatedEZBVendor);
            }

            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.CASHFREE)
            ) {
              if (!vendors_data.vendor_id) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.cashfree = true;
              let CashfreeVen = vendor;
              CashfreeVen.vendor_id = vendors_data.vendor_id;
              const updatedCFVendor = {
                ...CashfreeVen,
                name: vendors_data.name,
              };
              cashfreeVedors.push(updatedCFVendor);
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
                throw new BadRequestException(
                  'Vendor amount cannot be negative',
                );
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

          if (splitMethod === 'percentage' && totalPercentage > 100) {
            throw new BadRequestException(
              'Sum of vendor percentages cannot be greater than 100%',
            );
          }

          // ✅ Convert percentage to amount if gateway is EASEBUZZ
          if (splitMethod === 'percentage' && vendorgateway.easebuzz) {
            for (const vendor of easebuzzVendors) {
              if (typeof vendor.percentage === 'number') {
                vendor.amount = (vendor.percentage / 100) * body.amount;
                delete vendor.percentage;
              }
            }
            // Update splitMethod to 'amount' since we converted it
            splitMethod = 'amount';
          }
        }
      }

      if (school.isVendor && school.vendor_id) {
        const updatedVendor = {
          vendor_id: school.vendor_id,
          percentage: 100,
          name: school.school_name,
        };
        vendorgateway.cashfree = true;
        splitPay = true;
        cashfreeVedors.push(updatedVendor);
      }

      const adjustedAmount = school.adjustedAmount || 0;
      let venlength = 0;
      if (PGVendorInfo) {
        venlength = PGVendorInfo.length;
      }

      if (
        school.isAdjustment &&
        Number(amount) >= school.minAdjustmnentAmount &&
        venlength === 0
      ) {
        console.log('adjustment');

        if (school.advanceAdjustment) {
          console.log('advance adjustment');

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
            cashfreeVedors.push(updatedVendor);
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
            cashfreeVedors.push(updatedVendor);
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
      if (school.isEasebuzzNonPartner) {
        console.log('non partner');

        if (
          !school.easebuzz_non_partner ||
          !school.easebuzz_non_partner?.easebuzz_key ||
          !school.easebuzz_non_partner?.easebuzz_salt ||
          !school.easebuzz_non_partner?.easebuzz_submerchant_id
        ) {
          throw new BadRequestException('Gateway Configration Error');
        }

        if (splitPay && !school.easebuzz_school_label) {
          throw new BadRequestException('Split payment Not Configure');
        }
        const webHookUrl = req_webhook_urls?.length;
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

        const trustee = await this.trusteeModel.findById(school.trustee_id);
        let all_webhooks: string[] = [];
        if (trustee.webhook_urls.length || req_webhook_urls?.length) {
          const trusteeUrls = trustee.webhook_urls.map((item) => item.url);
          all_webhooks = [...(req_webhook_urls || []), ...trusteeUrls];
        }

        if (trustee.webhook_urls.length === 0) {
          all_webhooks = req_webhook_urls || [];
        }
        if (school.nonSeamless) {
          const bodydata = {
            amount,
            callbackUrl: callback_url,
            // jwt,
            webHook: webHookUrl || null,
            disabled_modes,
            platform_charges: school.platform_charges,
            additional_data: additionalInfo,
            school_id,
            trustee_id,
            custom_order_id,
            req_webhook_urls,
            school_name: school.school_name,
            easebuzz_sub_merchant_id:
              school.easebuzz_non_partner.easebuzz_submerchant_id,
            split_payments,
            easebuzzVendors,
            easebuzz_school_label: school.easebuzz_school_label,
            easebuzz_non_partner_cred: school.easebuzz_non_partner,
          };

          const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/create-order-nonseamless`,
            headers: {
              'Content-Type': 'application/json',
            },
            data: bodydata,
          };

          const res = await axios.request(config);
          console.log(res, 'ppppp');

          const response = {
            collect_request_id: res.data.collect_request_id,
            collect_request_url: res.data.collect_request_url,
            sign: res.data.jwt,
            jwt: res.data.jwt,
          };

          return response;
        }
        const bodydata = {
          amount,
          callbackUrl: callback_url,
          // jwt,
          webHook: webHookUrl || null,
          disabled_modes,
          platform_charges: school.platform_charges,
          additional_data: additionalInfo,
          school_id,
          trustee_id,
          custom_order_id,
          req_webhook_urls,
          school_name: school.school_name,
          easebuzz_sub_merchant_id:
            school.easebuzz_non_partner.easebuzz_submerchant_id,
          split_payments,
          easebuzzVendors,
          easebuzz_school_label: school.easebuzz_school_label,
          easebuzz_non_partner_cred: school.easebuzz_non_partner,
        };

        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/create-order-v2`,
          headers: {
            'Content-Type': 'application/json',
          },
          data: bodydata,
        };

        const res = await axios.request(config);

        const response = {
          collect_request_id: res.data.collect_request_id,
          collect_request_url: res.data.collect_request_url,
          sign: this.jwtService.sign(
            {
              collect_request_id: res.data.collect_request_id,
              collect_request_url: res.data.collect_request_url,
              custom_order_id: custom_order_id || null,
            },
            { noTimestamp: true, secret: school.pg_key },
          ),
          // sign: res.data.jwt,
          // jwt: res.data.jwt
        };

        return response;
      }

      if (school.cf_non_partner && school.cashfree_credentials) {
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
          split_payments: splitPay || false,
          vendors_info: updatedVendorsInfo || null,
          vendorgateway: vendorgateway,
          cashfreeVedors,
          disabled_modes: disabled_modes || null,
          easebuzz_school_label: school.easebuzz_school_label || null,
          isVBAPayment: isVBAPayment || false,
          vba_account_number: vba_account_number || 'NA',
          worldLine_vendors: worldLine_vendors || null,
          cashfree_credentials: school.cashfree_credentials || null,
        });
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/create-order-v2`,
          headers: {
            'Content-Type': 'application/json',
          },
          data: data,
        };
        const { data: paymentsServiceResp } = await axios.request(config);
        console.timeEnd('payments1');
        const reason = 'fee payment';

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
        console.log(paymentsServiceResp);

        return {
          collect_request_id: paymentsServiceResp._id,
          collect_request_url: paymentsServiceResp.url,
          sign: this.jwtService.sign(
            {
              collect_request_id: paymentsServiceResp._id,
              collect_request_url: paymentsServiceResp.url,
              custom_order_id: paymentsServiceResp.request?.custom_order_id,
            },
            { noTimestamp: true, secret: school.pg_key },
          ),
        };
      }

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
        vendors_info: updatedVendorsInfo || null,
        vendorgateway: vendorgateway,
        easebuzzVendors,
        cashfreeVedors,
        split_payments: splitPay,
        // disabled_modes: disabled_modes || null,
        easebuzz_school_label: school.easebuzz_school_label || null,
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
      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      if (error?.response?.data?.message) {
        throw new ConflictException(error.response.data.message);
      }
      throw error;
    }
  }

  // CASHFREE COLLECT REQUEST FOR SEPERATE PARTNERS V2
  @Post('create-collect-request/v21')
  @UseGuards(ErpGuard)
  async cashfreeCollectRequest(
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
      // if (!sign) {
      //   throw new BadRequestException('sign is required');
      // }

      // if (body.student_phone_no || body.student_email) {
      //   if (!body.student_name) {
      //     throw new BadRequestException('student name is required');
      //   }
      //   // if (!body.reason) {
      //   //   throw new BadRequestException('reason is required');
      //   // }
      // }
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
      if (school.easebuzz_id && !school.easebuzz_school_label) {
        throw new BadRequestException(
          `Split Information Not Configure Please contact tarun.k@edviron.com`,
        );
      }

      if (
        !school.cashfree_credentials ||
        !school.cashfree_credentials.cf_x_client_id ||
        !school.cashfree_credentials.cf_x_client_secret
      ) {
        throw new BadRequestException(
          'credentials are not configured please contact support',
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
      let vendorgateway: any = {};
      const updatedVendorsInfo = [];
      let easebuzzVendors = [];
      let cashfreeVedors = [];
      let worldLine_vendors: any = [];
      // VENDORS LOGIC FOR MULTIPLE GATEWAYS
      if (split_payments && vendors_info && vendors_info.length > 0) {
        // Determine the split method (amount or percentage) based on the first vendor
        let splitMethod = null;
        let totalAmount = 0;
        let totalPercentage = 0;
        if (school.worldline && school.worldline.encryption_key) {
          for (const vendor of vendors_info) {
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

            if (!vendors_data.gateway?.includes(GATEWAY.WORLDLINE)) {
              throw new BadRequestException('Split Not configure');
            }
            if (vendor.percentage) {
              throw new BadRequestException(
                'Please pass Amount for WorldLine schools',
              );
            }
            if (
              !vendors_data.worldline_vendor_name &&
              vendors_data.worldline_vendor_id
            ) {
              throw new BadRequestException('Split Not Configure');
            }
            vendorgateway.worldline = true;
            let worldlineVenodr: any = {};
            (worldlineVenodr.vendor_id = vendor.vendor_id),
              (worldlineVenodr.amount = vendor.amount),
              (worldlineVenodr.name = vendors_data.worldline_vendor_name);
            worldlineVenodr.scheme_code = vendors_data.worldline_vendor_id;
            worldLine_vendors.push(worldlineVenodr);
          }
        } else {
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

            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.EASEBUZZ)
            ) {
              if (
                !vendors_data.easebuzz_vendor_id ||
                !school.easebuzz_school_label
              ) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.easebuzz = true;
              let easebuzzVen = vendor;
              easebuzzVen.vendor_id = vendors_data.easebuzz_vendor_id;
              const updatedEZBVendor = {
                ...easebuzzVen,
                name: vendors_data.name,
              };
              easebuzzVendors.push(updatedEZBVendor);
            }

            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.CASHFREE)
            ) {
              if (!vendors_data.vendor_id) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.cashfree = true;
              let CashfreeVen = vendor;
              CashfreeVen.vendor_id = vendors_data.vendor_id;
              const updatedCFVendor = {
                ...CashfreeVen,
                name: vendors_data.name,
              };
              cashfreeVedors.push(updatedCFVendor);
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
                throw new BadRequestException(
                  'Vendor amount cannot be negative',
                );
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

          if (splitMethod === 'percentage' && totalPercentage > 100) {
            throw new BadRequestException(
              'Sum of vendor percentages cannot be greater than 100%',
            );
          }

          // ✅ Convert percentage to amount if gateway is EASEBUZZ
          if (splitMethod === 'percentage' && vendorgateway.easebuzz) {
            for (const vendor of easebuzzVendors) {
              if (typeof vendor.percentage === 'number') {
                vendor.amount = (vendor.percentage / 100) * body.amount;
                delete vendor.percentage;
              }
            }
            // Update splitMethod to 'amount' since we converted it
            splitMethod = 'amount';
          }
        }
      }

      // FOR SPARK IT CANTEEN SCHOOLS ONLY
      if (school.isVendor && school.vendor_id) {
        vendorgateway.cashfree = true;
        const updatedVendor = {
          vendor_id: school.vendor_id,
          percentage: 100,
          name: school.school_name,
        };
        splitPay = true;
        cashfreeVedors.push(updatedVendor);
      }

      // const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      // if (
      //   decoded.amount != amount ||
      //   decoded.callback_url != callback_url ||
      //   decoded.school_id != school_id
      // ) {
      //   throw new ForbiddenException('request forged');
      // }
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
      console.time('payments1');

      if (school.isEasebuzzNonPartner) {
        console.log('non partner');

        if (
          !school.easebuzz_non_partner ||
          !school.easebuzz_non_partner?.easebuzz_key ||
          !school.easebuzz_non_partner?.easebuzz_salt ||
          !school.easebuzz_non_partner?.easebuzz_submerchant_id
        ) {
          throw new BadRequestException('Gateway Configration Error');
        }

        if (splitPay && !school.easebuzz_school_label) {
          throw new BadRequestException('Split payment Not Configure');
        }
        const webHookUrl = req_webhook_urls?.length;
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

        const trustee = await this.trusteeModel.findById(school.trustee_id);
        let all_webhooks: string[] = [];
        if (trustee.webhook_urls.length || req_webhook_urls?.length) {
          const trusteeUrls = trustee.webhook_urls.map((item) => item.url);
          all_webhooks = [...(req_webhook_urls || []), ...trusteeUrls];
        }

        if (trustee.webhook_urls.length === 0) {
          all_webhooks = req_webhook_urls || [];
        }

        const bodydata = {
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
          webHook: webHookUrl || null,
          disabled_modes,
          platform_charges: school.platform_charges,
          additional_data: additionalInfo,
          school_id,
          trustee_id,
          custom_order_id,
          req_webhook_urls,
          school_name: school.school_name,
          split_payments,
          easebuzzVendors,
          easebuzz_school_label: school.easebuzz_school_label,
          easebuzz_non_partner_cred: school.easebuzz_non_partner,
        };
        console.log('cashfree create order v2');

        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/create-order-v2`,
          headers: {
            'Content-Type': 'application/json',
          },
          data: bodydata,
        };

        const res = await axios.request(config);

        const response = {
          collect_request_id: res.data.collect_request_id,
          collect_request_url: res.data.collect_request_url,
          sign: this.jwtService.sign(
            {
              collect_request_id: res.data.collect_request_id,
              collect_request_url: res.data.collect_request_url,
              custom_order_id: custom_order_id || null,
            },
            { noTimestamp: true, secret: school.pg_key },
          ),
          // sign: res.data.jwt,
          // jwt: res.data.jwt
        };

        return response;
      }
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
        split_payments: splitPay || false,
        vendors_info: updatedVendorsInfo || null,
        vendorgateway: vendorgateway,
        cashfreeVedors,
        disabled_modes: disabled_modes || null,
        easebuzz_school_label: school.easebuzz_school_label || null,
        isVBAPayment: isVBAPayment || false,
        vba_account_number: vba_account_number || 'NA',
        worldLine_vendors: worldLine_vendors || null,
        cashfree_credentials: school.cashfree_credentials || null,
      });
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/create-order-v2`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: data,
      };
      const { data: paymentsServiceResp } = await axios.request(config);
      console.timeEnd('payments1');
      const reason = 'fee payment';

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
      console.log(paymentsServiceResp);

      return {
        collect_request_id: paymentsServiceResp._id,
        collect_request_url: paymentsServiceResp.url,
        sign: this.jwtService.sign(
          {
            collect_request_id: paymentsServiceResp._id,
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
      // if (body.student_phone_no || body.student_email) {
      //   if (!body.student_name) {
      //     throw new BadRequestException('student name is required');
      //   }
      //   // if (!body.reason) {
      //   //   throw new BadRequestException('reason is required');
      //   // }
      // }
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
        throw new HttpException(
          {
            message: `Missing required field collect id`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }
      if (!mongoose.Types.ObjectId.isValid(collect_request_id)) {
        throw new HttpException(
          {
            message: `Invalid Collect id`,
            error: 'Not Found Error',
            statusCode: '404',
          },
          HttpStatus.NOT_FOUND, // You can change this (e.g., 422, 401, etc.)
        );
      }
      if (!school_id) {
        throw new HttpException(
          {
            message: `Missing required field school id`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }
      if (!sign) {
        throw new HttpException(
          {
            message: `Missing required field Sign`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new HttpException(
          {
            message: `Merchant Not found for school_id: ${school_id}`,
            error: 'Not Found Error',
            statusCode: '404',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new HttpException(
          {
            message: `UNAUTHORIZED User`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!school.pg_key) {
        throw new HttpException(
          {
            message: `PG Gatreway is Not Activated for school_id: ${school_id}`,
            error: 'Forbidden Error',
            statusCode: '403',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });

      if (
        decoded.collect_request_id != collect_request_id ||
        decoded.school_id != school_id
      ) {
        throw new HttpException(
          {
            message: `Request Forged | Invalid Sign`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
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
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.response?.data?.message) {
        if (error.response.data.message === 'Collect request not found') {
          throw new NotFoundException('Invalid Collect id');
        }
        throw new BadRequestException(error.response.data.message);
      }
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
        throw new HttpException(
          {
            message: `Missing required field order_id`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }
      if (!school_id) {
        throw new HttpException(
          {
            message: `Missing required field school_id`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }
      if (!sign) {
        throw new HttpException(
          {
            message: `Missing required field sign`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new HttpException(
          {
            message: `Merchant Not found for school_id: ${school_id}`,
            error: 'Not Found Error',
            statusCode: '404',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new HttpException(
          {
            message: `UNAUTHORIZED User`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!school.pg_key) {
        throw new HttpException(
          {
            message:
              'Edviron PG is not enabled for this school yet. Kindly contact us at tarun.k@edviron.com.',
            error: 'Bad Request Error',
            statusCode: '400',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (decoded.custom_order_id != order_id) {
        throw new HttpException(
          {
            message: `Request Forged | Invalid Sign`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
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
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.response?.data?.message) {
        if (error.response.data.message === 'Collect request not found') {
          throw new NotFoundException('Invalid Order id');
        }
        throw new BadRequestException(error.response.data.message);
      }

      if (error.name === 'JsonWebTokenError')
        throw new BadRequestException('Invalid sign');
      throw error;
    }
  }

  // collect request status V2
  @Get('collect-request-status/v2/:order_id')
  @UseGuards(ErpGuard)
  async getCollectRequestV2(@Req() req) {
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

      if (!school.pg_key) {
        throw new BadRequestException(
          'Edviron PG is not enabled for this school yet. Kindly contact support.',
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (decoded.custom_order_id != order_id) {
        throw new ForbiddenException('request forged');
      }

      const config = {
        method: 'get',
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
        headers: { accept: 'application/json' },
      };

      const { data: paymentsServiceResp } = await axios.request(config);

      const response = {
        collect_id: paymentsServiceResp.collect_id,
        custom_order_id: paymentsServiceResp.custom_order_id,
        order_amount: paymentsServiceResp.order_amount,
        order_time: paymentsServiceResp.order_time,
        payment_mode: paymentsServiceResp.payment_mode,
        payment_details: {
          bank_ref: paymentsServiceResp.bank_ref,
          transaction_time: paymentsServiceResp.transaction_time,
        },
        settlement: {
          isSettlementComplete: paymentsServiceResp.isSettlementComplete,
          utr: paymentsServiceResp.utr_number,
        },
        callback_url: paymentsServiceResp.callback_url,
        webhook: paymentsServiceResp.webhook,
        receipt: paymentsServiceResp.receipt,
        school_id: school_id,
        school_name: school.school_name,
        currency: paymentsServiceResp.currency,
        refunds: paymentsServiceResp.refunds || [],
        disputes: paymentsServiceResp.disputes || [],
      };

      return {
        success: true,
        message: 'Payment request fetched successfully',
        data: response,
      };
    } catch (error) {
      if (error.response?.data?.message) {
        throw new BadRequestException(error.response.data.message);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Invalid sign');
      }
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
  async getSettlements(@Req() req: any) {
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
        const school = await this.trusteeSchoolModel.findOne({
          school_id: new Types.ObjectId(school_id),
          trustee_id: trustee_id,
        });
        if (!school) {
          throw new HttpException(
            {
              message: `Merchant Not found for school_id: ${school_id}`,
              error: 'Not Found Error',
              statusCode: '404',
            },
            HttpStatus.NOT_FOUND,
          );
        }
        filterQuery = {
          ...filterQuery,
          schoolId: new Types.ObjectId(school_id),
        };
      }
      const dateRegex = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

      if (startDate && endDate) {
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
          throw new HttpException(
            {
              message: `Invalid date format. Please use 'YYYY-MM-DD' format.`,
              error: 'Bad Request Error',
              statusCode: '422',
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
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
        statusCode: '200',
        page,
        limit,
        settlements,
        total_pages,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  @Get('settlements/v2')
  @UseGuards(ErpGuard)
  async getSettlementsV2(@Req() req) {
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
        const istStartDate = await this.formatIST(start_date);
        const end_date = new Date(endDate);
        const istEndDate = await this.formatIST(end_date);

        const end = new Date(istEndDate);
        end.setHours(23, 59, 59, 999);
        end.setHours(end.getHours() + 5);

        filterQuery = {
          ...filterQuery,
          settlementDate: {
            $gte: new Date(istStartDate),
            $lte: end,
          },
        };
      }
      console.log(filterQuery);

      //paginated query
      const settlements = await this.settlementModel
        .find(filterQuery, null, {
          skip: (page - 1) * limit,
          limit: limit,
        })
        .select('-clientId -trustee')
        .sort({ createdAt: -1 });
      const formattedSettlements = await Promise.all(
        settlements.map(async (settlement: any) => {
          if (settlement.settlementDate) {
            settlement = settlement.toObject();
            settlement.settlementDate = await this.formatIST(
              settlement.settlementDate,
            );
          }
          if (settlement.settlementInitiatedOn) {
            settlement.settlementInitiatedOn = await this.formatIST(
              settlement.settlementInitiatedOn,
            );
          }
          return settlement;
        }),
      );
      const count = await this.settlementModel.countDocuments(filterQuery);
      const total_pages = Math.ceil(count / limit);
      return {
        page,
        limit,
        settlements: formattedSettlements,
        total_pages,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  //V2 for settlements
  @Post('settlements/v2')
  @UseGuards(ErpGuard)
  async getSettlementsv2(@Body() body) {
    try {
      const {
        school_id,
        date,
        status,
        settlement_id,
        page = 1,
        limit = 50,
      } = body;

      const safeLimit = Math.min(limit, 1000);
      const query: any = {};
      if (school_id) query.school_id = school_id;
      if (status) query.status = status;
      if (settlement_id) query.settlement_id = settlement_id;
      if (date) {
        if (!date.from || !date.to) {
          throw new BadRequestException(
            "Both 'from' and 'to' dates are required",
          );
        }
        query.settlementDate = { $gte: date.from, $lte: date.to };
      }

      const settlements = await this.settlementModel
        .find(query)
        .skip((page - 1) * safeLimit)
        .limit(safeLimit)
        .sort({ createdAt: -1 });

      const total = await this.settlementModel.countDocuments(query);

      return {
        message: 'Settlements fetched successfully',
        page,
        limit: safeLimit,
        total,
        settlements,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch settlements',
      );
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
        const vendors = await this.VendorsModel.findById(vendor_id);
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
          vendor_id: vendors.vendor_id,
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
            vendor_id: vendor_id || 1,
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
        throw new HttpException(
          {
            message: `Merchant Not found for school_id: ${req.params.school_id}`,
            error: 'Not Found Error',
            statusCode: '404',
          },
          HttpStatus.NOT_FOUND,
        );
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
        const transactions_rep = response.data.transactions.map((item: any) => {
          const date = new Date(item.updatedAt);
          const {
            easebuzzVendors,
            cashfreeVedors,
            worldline_vendors_info,
            razorpay_vendors_info,
            cashfree_credentials,
            easebuzz_non_partner_cred,
            document_url,
            ntt_data,
            easebuzz_non_partner,
            cashfree_non_partner,
            isMasterGateway,
            razorpay_partner,
            razorpay,
            razorpay_seamless,
            isVBAPaymentComplete,
            isCFNonSeamless,
            ...rest
          } = item;

          const additionalData = item?.additional_data
            ? JSON.parse(item.additional_data)
            : null;

          const student_id = additionalData?.student_details?.student_id || '';
          const student_name =
            additionalData?.student_details?.student_name || '';
          const student_email =
            additionalData?.student_details?.student_email || '';
          const student_phone =
            additionalData?.student_details?.student_phone_no || '';
          const receipt = additionalData?.student_details?.receipt || '';
          const extra_fields = additionalData?.additional_fields || '';

          return {
            ...rest,
            merchant_name: school.school_name,
            student_id,
            student_name,
            student_email,
            student_phone,
            receipt,
            additional_data: additionalData?.additional_fields || '',
            school_id: school.school_id,
            school_name: school.school_name,
            formattedDate: `${date.getFullYear()}-${String(
              date.getMonth() + 1,
            ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          };
        });

        // const modifiedResponseData = response.data.transactions.map((item:any) => (
        //   {
        //   ...item,
        //   // student_id:
        //   //   JSON.parse(item?.additional_data)?.student_details?.student_id || '',

        //   // student_name:
        //   //   JSON.parse(item?.additional_data)?.student_details?.student_name ||
        //   //   '',

        //   // student_email:
        //   //   JSON.parse(item?.additional_data)?.student_details?.student_email ||
        //   //   '',
        //   // student_phone:
        //   //   JSON.parse(item?.additional_data)?.student_details
        //   //     ?.student_phone_no || '',
        //   receipt:
        //     JSON.parse(item?.additional_data)?.student_details?.receipt || '',
        //   additional_data:
        //     JSON.parse(item?.additional_data)?.additional_fields || '',
        //   merchant_name: school.school_name,
        //   school_id: school_id,
        //   school_name: school.school_name,
        //   currency: 'INR',
        // }));
        // transactions.push(...modifiedResponseData);
        const total_pages = Math.ceil(response.data.totalTransactions / limit);
        return {
          page,
          limit,
          statusCode: '200',
          transactions: transactions_rep,
          total_records: response.data.totalTransactions,
          total_pages,
        };
      }

      throw new HttpException(
        {
          message: `No transactions found`,
          error: 'Not Found Error',
          statusCode: '404',
        },
        HttpStatus.NOT_FOUND,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.response?.data?.message) {
        throw new BadRequestException(error.response.data.message);
      }
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

      const dateRegex = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
      if (start_date && end_date) {
        if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
          throw new HttpException(
            {
              message: `Invalid date format. Please use 'YYYY-MM-DD' format.`,
              error: 'Bad Request Error',
              statusCode: '422',
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
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
        const {
          easebuzzVendors,
          cashfreeVedors,
          worldline_vendors_info,
          razorpay_vendors_info,
          cashfree_credentials,
          easebuzz_non_partner_cred,
          document_url,
          ntt_data,
          easebuzz_non_partner,
          cashfree_non_partner,
          isMasterGateway,
          razorpay_partner,
          razorpay,
          razorpay_seamless,
          isCFNonSeamless,
          isVBAPaymentComplete,
          ...rest
        } = item;
        return {
          ...rest,
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
        statusCode: '200',
        transactions,
        total_records: response.data.totalTransactions,
        total_pages,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.response?.data?.message) {
        throw new BadRequestException(error.response.data.message);
      }
      throw new Error(error.message);
    }
  }

  @Get('transaction-info')
  @UseGuards(ErpGuard)
  async getTransactionInfo(@Req() req: any) {
    try {
      const { sign, school_id, collect_request_id } = req.query;
      if (!sign) {
        throw new HttpException(
          {
            message: `Request Forged | Invalid Sign`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (!school_id) {
        throw new HttpException(
          {
            message: `Missing required field school id`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }
      if (!collect_request_id) {
        throw new HttpException(
          {
            message: `Invalid Collect id`,
            error: 'Not Found Error',
            statusCode: '404',
          },
          HttpStatus.NOT_FOUND, // You can change this (e.g., 422, 401, etc.)
        );
      }

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new HttpException(
          {
            message: `Missing required field school id`,
            error: 'Validation Error',
            statusCode: '400',
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.collect_request_id != collect_request_id ||
        decoded.school_id != school_id
      ) {
        throw new HttpException(
          {
            message: `UNAUTHORIZED User`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
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

        const {
          easebuzzVendors,
          cashfreeVedors,
          worldline_vendors_info,
          razorpay_vendors_info,
          cashfree_credentials,
          easebuzz_non_partner_cred,
          document_url,
          ntt_data,
          easebuzz_non_partner,
          cashfree_non_partner,
          isMasterGateway,
          razorpay_partner,
          razorpay,
          razorpay_seamless,
          isVBAPaymentComplete,
          isCFNonSeamless,
          ...rest
        } = item;

        const additionalData = item?.additional_data
          ? JSON.parse(item.additional_data)
          : {};

        const studentDetails = additionalData?.student_details || {};
        const additionalFields = additionalData?.additional_fields || {};

        return {
          ...rest,
          merchant_name: school.school_name,
          student_id: studentDetails?.student_id || '',
          student_name: studentDetails?.student_name || '',
          student_email: studentDetails?.student_email || '',
          student_phone: studentDetails?.student_phone_no || '',
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
      throw new HttpException(
        {
          message: `No transactions found`,
          error: 'Not Found Error',
          statusCode: '404',
        },
        HttpStatus.NOT_FOUND,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.response?.data?.message) {
        if (error.response.data.message === 'Collect request not found') {
          throw new NotFoundException('Invalid Collect id');
        }
        throw new BadRequestException(error.response.data.message);
      }
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
      gateway?: string;
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
      gateway,
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
      let trustee_platform_charges = baseMdr.platform_charges; //Trustee base rate charges
      const schoolBaseMdr = await this.SchoolBaseMdrModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (schoolBaseMdr) {
        trustee_platform_charges = schoolBaseMdr.platform_charges;
      }
      if (!baseMdr) {
        throw new ConflictException('Trustee has no Base MDR set ');
      }

      const school_platform_charges = school.platform_charges; //MDR 2 charges
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
      let erpCommissionWithGST = erpCommission;
      if (platform_type === 'DebitCard' || platform_type === 'CreditCard') {
        if (order_amount >= 2000) {
          erpCommissionWithGST = erpCommission + erpCommission * 0.18;
        } else {
          erpCommissionWithGST = erpCommission;
        }
      } else {
        erpCommissionWithGST = erpCommission + erpCommission * 0.18;
      }
      if (erpCommissionWithGST < 0) {
        erpCommissionWithGST = 0;
      }

      const commission = await this.commissionModel.findOneAndUpdate(
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
      try {
        await this.commissionService.updateCommission(
          commission._id.toString(),
          'EVIRON_PG',
        );
      } catch (e) {
        console.log('Failed to save beakDown');
      }
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

  @Get('school-info-new')
  async getSchoolInfoNew(@Req() req: any) {
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

    return {
      school_name: school.school_name,
      email: school.email,
      phone_number: school.phone_number,
      school_id: school.school_id,
      trustee_id: school.trustee_id,
    };
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
    const settlementDate = new Date('2025-10-12T23:59:59.695Z');
    const date = new Date(settlementDate.getTime());

    // date.setUTCHours(0, 0, 0, 0); // Use setUTCHours to avoid time zone issues

    // const day = String(date.getDate()).padStart(2, '0');
    // const month = String(date.getMonth() + 1).padStart(2, '0');
    // const year = date.getFullYear();

    // const formattedDateString = `${day}-${month}-${year}`; //eazebuzz accepts date in DD-MM-YYYY formal seprated with - like '19-07-2024'

    // return formattedDateString
    const data = await this.erpService.easebuzzSettlements(date);
    // await this.erpService.sendSettlements(date);
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
      const missingFields = [];
      if (!sign) missingFields.push('sign');
      if (!collect_id) missingFields.push('collect_id');
      if (!school_id) missingFields.push('school_id');

      throw new HttpException(
        {
          message: `Missing required field${
            missingFields.length > 1 ? 's' : ''
          }: ${missingFields.join(', ')}`,
          error: 'Validation Error',
          statusCode: '400',
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // You can change this (e.g., 422, 401, etc.)
      );
    }
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new HttpException(
          {
            message: `Merchant Not found for school_id: ${school_id}`,
            error: 'Not Found Error',
            statusCode: '404',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      const pg_key = school.pg_key;
      if (!pg_key) {
        throw new HttpException(
          {
            message: `PG Gatreway is Not Activated for school_id: ${school_id}`,
            error: 'Forbidden Error',
            statusCode: '403',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      const decrypted = this.jwtService.verify(sign, { secret: pg_key });

      if (decrypted.collect_id !== collect_id) {
        throw new HttpException(
          {
            message: `Request Forged | Invalid Sign`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (decrypted.school_id !== school_id) {
        throw new HttpException(
          {
            message: `Request Forged | Invalid Sign`,
            error: 'Unauthorized Error',
            statusCode: '401',
          },
          HttpStatus.UNAUTHORIZED,
        );
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
      const dqrRes = {
        ...response,
        statusCode: '200',
      };
      return dqrRes;
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
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
    @Query('skip') skip: number,
    @Query('page') page: number,
  ) {
    let dataLimit = Number(limit) || 10;

    if (dataLimit < 10 || dataLimit > 1000) {
      throw new HttpException(
        {
          message: `Limit should be between 10 and 1000`,
          error: 'Bad Request Error',
          statusCode: '400',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    let utrNumber = utr_number;
    if (!utr_number) {
      throw new HttpException(
        {
          message: `UTR Number is Required`,
          error: 'Not Found Error',
          statusCode: '404',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      if (settlement_id) {
        const settlement = await this.settlementModel.findById(settlement_id);
        if (!settlement) {
          throw new HttpException(
            {
              message: `Settlement not found for: ${settlement_id}`,
              error: 'Not Found Error',
              statusCode: '404',
            },
            HttpStatus.NOT_FOUND,
          );
        }
        utrNumber = settlement.utrNumber;
      }
      const settlement = await this.settlementModel.findOne({
        utrNumber: utrNumber,
      });
      const client_id = settlement.clientId;
      const razorpay_id = settlement.razorpay_id;
      if (client_id) {
        console.log('cashfree');
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
        const settlementInitiatedOnDate = settlement.settlementInitiatedOn;
        const settlementDate = settlement.settlementDate;
        const { data: transactions } = await axios.request(config);
        const { settlements_transactions } = transactions;
        console.log(
          new Date(settlementInitiatedOnDate).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          }),
        );

        await Promise.all(
          settlements_transactions.map(async (tx: any) => {
            tx.settlement_initiated_on = await this.formatIST(
              settlementInitiatedOnDate,
            );
            tx.settlement_date = await this.formatIST(settlementDate);
          }),
        );

        console.log(settlements_transactions, 'settlements_transactions');
        return {
          limit: transactions.limit,
          cursor: transactions.cursor,
          settlements_transactions,
        };
      }

      if (razorpay_id) {
        console.log('inside razorpay');
        const school = await this.trusteeSchoolModel.findOne({
          'razorpay.razorpay_id': razorpay_id,
        });
        const razropay_secret = school?.razorpay?.razorpay_secret;
        return await this.trusteeService.getRazorpayTransactionForSettlement(
          utrNumber,
          razorpay_id,
          razropay_secret,
          Number(limit),
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
      if (
        school.isEasebuzzNonPartner &&
        school.easebuzz_non_partner.easebuzz_key &&
        school.easebuzz_non_partner.easebuzz_salt &&
        school.easebuzz_non_partner.easebuzz_submerchant_id
      ) {
        console.log('settlement from date');
        const settlements = await this.settlementModel
          .find({
            schoolId: settlement.schoolId,
            settlementDate: { $lt: settlement.settlementDate },
          })
          .sort({ settlementDate: -1 })
          .select('settlementDate')
          .limit(2);
        const previousSettlementDate = settlements[1]?.settlementDate;
        const formatted_start_date =
          await this.trusteeService.formatDateToDDMMYYYY(
            previousSettlementDate,
          );
        console.log({ formatted_start_date }); // e.g. 06-09-2025

        const formatted_end_date =
          await this.trusteeService.formatDateToDDMMYYYY(
            settlement.settlementDate,
          );

        const previousSettlementDate2 =
          settlements[1]?.settlementDate.toISOString();
        const tempPrev = previousSettlementDate2.split('T')[0];
        const partsPrev = tempPrev.split('-');
        const formattedPrev = `${partsPrev[2]}-${partsPrev[1]}-${partsPrev[0]}`;
        // e.g. 06-09-2025
        const end = settlement.settlementDate;
        end.setDate(end.getDate() + 2);
        const endSettlementDate = end.toISOString();
        const tempEnd = endSettlementDate.split('T')[0];
        const partsEnd = tempEnd.split('-');
        const formattedEnd = `${partsEnd[2]}-${partsEnd[1]}-${partsEnd[0]}`;
        console.log({ formatted_end_date }); // e.g. 06-09-2025
        const paginatioNPage = page || 1;
        const res = await this.trusteeService.easebuzzSettlementRecon(
          school.easebuzz_non_partner.easebuzz_submerchant_id,
          formattedPrev,
          formattedEnd,
          school.easebuzz_non_partner.easebuzz_key,
          school.easebuzz_non_partner.easebuzz_salt,
          utrNumber,
          Number(limit),
          skip,
          settlement.schoolId.toString(),
          paginatioNPage,
          cursor,
        );

        return res;
      }
      throw new HttpException(
        {
          message: `No settlement found`,
          error: 'Not Found Error',
          statusCode: '404',
        },
        HttpStatus.NOT_FOUND,
      );
    } catch (e) {
      console.log(e);

      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Get('settlement-transactions/v2')
  async getSettlementTransactionsV2(
    @Query('settlement_id') settlement_id: string,
    @Query('utr_number') utr_number: string,
    @Query('cursor') cursor: string | null,
    @Query('limit') limit: string,
    @Query('skip') skip: number,
    @Query('page') page: number,
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

      const school = await this.trusteeSchoolModel.findOne({
        school_id: settlement.schoolId,
      });
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
        const settlements = await this.settlementModel
          .find({
            schoolId: settlement.schoolId,
            settlementDate: { $lt: settlement.settlementDate },
          })
          .sort({ settlementDate: -1 })
          .select('settlementDate')
          .limit(2);
        const previousSettlementDate = settlements[1]?.settlementDate;
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
        const res = await this.trusteeService.easebuzzSettlementReconV2(
          school.easebuzz_non_partner.easebuzz_submerchant_id,
          formatted_start_date,
          formatted_end_date,
          school.easebuzz_non_partner.easebuzz_key,
          school.easebuzz_non_partner.easebuzz_salt,
          utrNumber,
          Number(limit),
          skip,
          settlement.schoolId.toString(),
          paginatioNPage,
          cursor,
        );

        return res;
      }
    } catch (e) {
      console.log(e);

      throw new BadRequestException(e.message);
    }
  }

  async formatIST(date: Date) {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;

    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get(
      'minute',
    )}:${get('second')}+05:30`;
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
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('Invalid School Id ');
      }

      const pg_key = school.pg_key;
      // const client_id = school.client_id;
      if (!pg_key) {
        throw new NotFoundException(
          'Payment Gateway not enabled for this school',
        );
      }

      const decrypted = this.jwtService.verify(sign, { secret: pg_key });
      if (
        decrypted.school_id !== school_id &&
        decrypted.order_id !== order_id
      ) {
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
    } catch (e) {
      throw new BadRequestException(e);
    }
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
      console.log(e);

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
  @Post('initiate-refund/order')
  async initiateCustomRefund(
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
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('Invalid School Id ');
      }
      const pg_key = school.pg_key;
      // const client_id = school.client_id;
      if (!pg_key) {
        throw new NotFoundException(
          'Payment Gateway not enabled for this school',
        );
      }

      const decrypted = this.jwtService.verify(sign, { secret: pg_key });
      if (
        decrypted.school_id !== school_id &&
        decrypted.order_id !== order_id
      ) {
        throw new BadRequestException('Invalid Sign');
      }

      const checkRefundRequest = await this.refundRequestModel
        .findOne({
          custom_id: order_id,
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
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/transaction-info/order`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        data: { school_id, order_id: order_id, token: pg_token },
      };

      const response = await axios.request(pgConfig);

      const custom_id = order_id;
      const order_amount = response.data[0].order_amount;
      const transaction_amount = response.data[0].transaction_amount;
      const collect_id = response.data[0].collect_id;

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
        { order_id: collect_id.toString() },
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
        order_id: new Types.ObjectId(collect_id),
        status: refund_status.INITIATED,
        refund_amount,
        order_amount,
        transaction_amount,
        gateway: gateway || null,
        custom_id: custom_id,
      }).save();

      return {
        status: 'success',
        msg: 'Refund Request Created',
        refund_id: refund._id,
        order_id: refund.custom_id,
        collect_id: refund.order_id,
        refund_amount: refund.refund_amount,
        refund_status: refund.status,
      };
    } catch (e) {
      console.log(e);

      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Get('get-refund')
  async getRefund(@Req() req: any) {
    const { school_id, sign, order_id, collect_id, refund_id } = req.query;

    try {
      if (!school_id) throw new BadRequestException('School id is missing');

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) throw new NotFoundException('Invalid School Id');

      const pg_key = school.pg_key;
      if (!pg_key)
        throw new NotFoundException(
          'Payment Gateway not enabled for this school',
        );

      const decrypted = this.jwtService.verify(sign, { secret: pg_key });
      if (decrypted.school_id !== school_id)
        throw new BadRequestException('Invalid Sign');

      const formatRefunds = (refunds: any[]) =>
        refunds.map((data: any) => ({
          refund_id: data._id,
          order_id: data.custom_id,
          collect_id: data.order_id,
          refund_amount: data.refund_amount,
          order_amount: data.order_amount,
          refund_status: data.status,
        }));

      let refunds: any[] = [];

      if (order_id) {
        refunds = await this.refundRequestModel.find({ custom_id: order_id });
      } else if (collect_id) {
        refunds = await this.refundRequestModel.find({
          order_id: new Types.ObjectId(collect_id),
        });
      } else if (refund_id) {
        refunds = await this.refundRequestModel.find({
          _id: new Types.ObjectId(refund_id),
        });
      }

      if (!refunds || refunds.length === 0) {
        return {
          status: 'failed',
          msg: `refund request not found`,
          refundRequests: [],
        };
      }

      return {
        status: 'success',
        msg: `refund request fetched`,
        refundRequests: formatRefunds(refunds),
      };
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) {
        throw e;
      }
      throw new InternalServerErrorException(
        e.message || 'Something went wrong',
      );
    }
  }

  //V2 get-refund-details
  @UseGuards(ErpGuard)
  @Get('/get-refund-details/v2/:order_id')
  async getRefundDetailsV2(@Param('order_id') order_id: string) {
    try {
      if (!Types.ObjectId.isValid(order_id)) {
        throw new BadRequestException('Invalid order_id format');
      }

      const refunds = await this.refundRequestModel
        .find({
          order_id: new Types.ObjectId(order_id),
        })
        .sort({ createdAt: -1 });

      if (!refunds || refunds.length === 0) {
        throw new NotFoundException('No refund requests found for this order');
      }

      return {
        order_id,
        total_requests: refunds.length,
        latest_status: refunds[0].status,
        refunds: refunds.map((refund) => ({
          refund_amount: refund.refund_amount,
          status: refund.status,
          gateway: refund.gateway,
          order_amount: refund.order_amount,
          transaction_amount: refund.transaction_amount,
        })),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch refund details',
      );
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

  @Post('/update-vendors')
  async updatevendor() {
    await this.VendorsModel.updateMany(
      { status: { $ne: 'ACTIVE' } },
      { $set: { gateway: [GATEWAY.CASHFREE] } },
    );

    return { message: 'All active vendors updated with CASHFREE gateway.' };
  }

  @UseGuards(ErpGuard)
  @Post('/create-pos-request')
  async createPOSRequest(
    @Body()
    body: {
      posmachine_device_id: string;
      school_id: string;
      amount: number;
      sign: string;
      student_phone_no?: string;
      student_email?: string;
      student_name?: string;
      student_id?: string;
      receipt?: string;
      custom_order_id?: string;
      req_webhook_urls?: [string];
    },
    @Req() req,
  ) {
    const trustee_id = req.userTrustee.id;
    const callback_url = 'https://payments.edviron.com/pos-paytm/callback';
    const {
      school_id,
      amount,
      sign,
      student_id,
      student_email,
      student_name,
      student_phone_no,
      receipt,
      posmachine_device_id,
      custom_order_id,
      req_webhook_urls,
    } = body;
    try {
      if (!school_id) {
        throw new BadRequestException('School id is required');
      }

      if (!posmachine_device_id) {
        throw new BadRequestException('POS Machine Details is required');
      }
      if (!amount || amount <= 0) {
        throw new BadRequestException('Amount is required');
      }
      if (!callback_url) {
        throw new BadRequestException('Callback url is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
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
      const POSMachine = await this.posMachineModel.findById(
        new Types.ObjectId(posmachine_device_id),
      );

      if (!POSMachine) {
        console.log({ posmachine_device_id });

        throw new NotFoundException('POS Machine Not Found');
      }

      if (POSMachine.school_id.toString() !== school.school_id.toString()) {
        throw new BadRequestException('Invalid POS achine ID');
      }

      const { device_mid, device_tid, channel_id, merchant_key, device_id } =
        POSMachine.machine_details;

      if (
        !device_id ||
        !device_tid ||
        !device_mid ||
        !channel_id ||
        !merchant_key
      ) {
        throw new BadRequestException(
          'Device is not Configure Please contact tarun.k@edviron.com',
        );
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.amount.toString() !== amount.toString() ||
        decoded.school_id !== school_id
      ) {
        throw new ForbiddenException('request forged');
      }

      const additionalInfo = {
        student_details: {
          student_id: student_id,
          student_email: student_email,
          student_name: student_name,
          student_phone_no: student_phone_no,
          receipt: receipt,
        },
      };

      const axios = require('axios');
      const data = JSON.stringify({
        amount,
        callbackUrl: callback_url,
        jwt: this.jwtService.sign(
          {
            amount,
            school_id,
          },
          { noTimestamp: true, secret: process.env.PAYMENTS_SERVICE_SECRET },
        ),
        school_id: school_id,
        trustee_id: trustee_id,
        platform_charges: school.platform_charges,
        additional_data: additionalInfo || {},
        school_name: school.school_name || null,
        custom_order_id: custom_order_id || null,
        machine_name: POSMachine.machine_name,
        req_webhook_urls,
        paytm_pos: {
          paytmMid: POSMachine.machine_details.device_mid || null,
          paytmTid: POSMachine.machine_details.device_tid || null,
          channel_id: POSMachine.machine_details.channel_id || null,
          paytm_merchant_key: POSMachine.machine_details.merchant_key || null,
          device_id: POSMachine.machine_details.device_id || null,
        },
      });
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/collect/pos`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: data,
      };
      const request = await axios.request(config);

      const { requestSent, paytmResponse } = request.data;
      const { body: posBody, merchantTransactionId } = paytmResponse;
      // return posBody
      const res = {
        collect_id: posBody.merchantTransactionId,
        status: posBody.resultInfo.resultStatus,
        resultMsg: posBody.resultInfo.resultMsg,
        jwt: request.data.jwt,
      };
      return res;
    } catch (e) {
      throw new BadRequestException(e.message);
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
    const { vba_account_number, school_id, amount, collect_id, token } =
      req.query;
    try {
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
          beneficiary_bank_and_address:
            'AXIS BANK,5TH FLOOR, GIGAPLEX, AIROLI KNOWLEDGE PARK, AIROLI, MUMBAI',
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

  @Post('test-razorpay-settlement')
  async razorpayRecon(@Query('date') date: string) {
    const settlementDate = date ? new Date(date) : undefined;
    return await this.erpService.settlementRazorpay(settlementDate);
  }

  @Post('bulk-settlement')
  async bulkSettlement(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('authId') authId: string,
    @Query('authSecret') authSecret: string,
    @Query('trusteeId') trusteeId: string,
    @Query('schoolId') schoolId: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException(
        'Both "from" and "to" date parameters are required',
      );
    }
    const getUTCUnix = (dateStr: string, isEnd = false): number => {
      const parts = dateStr.split('-');
      if (parts.length !== 3) {
        throw new BadRequestException(
          `Invalid date format: ${dateStr}. Use YYYY-MM-DD.`,
        );
      }
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new BadRequestException(
          `Invalid date format: ${dateStr}. Must contain valid numbers.`,
        );
      }
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        throw new BadRequestException(`Invalid date value: ${dateStr}`);
      }
      if (isEnd) {
        date.setUTCHours(23, 59, 59, 999);
      } else {
        date.setUTCHours(0, 0, 0, 0);
      }
      return Math.floor(date.getTime() / 1000);
    };
    try {
      const startDate = getUTCUnix(from);
      const endDate = getUTCUnix(to, true);
      console.log('Unix timestamps:', startDate, endDate);
      const allSettlements = [];
      let skip = 0;
      const count = 100;
      let hasMore = true;
      while (hasMore) {
        const config = {
          url: `https://api.razorpay.com/v1/settlements?from=${startDate}&to=${endDate}&count=100&skip=${skip}`,
          headers: { 'Content-Type': 'application/json' },
          auth: { username: authId, password: authSecret },
        };
        const response = await axios.request(config);
        if (!response.data.items || response.data.items.length === 0) {
          hasMore = false;
        } else {
          allSettlements.push(...response.data.items);
          skip += response.data.items.length;
          if (response.data.items.length < count) {
            hasMore = false;
          }
        }
      }
      await this.erpService.updateBulkSettlement(
        allSettlements,
        trusteeId,
        schoolId,
        authId,
      );
      return allSettlements;
    } catch (error) {
      console.error('Razorpay settlement error:', error);
      throw new BadRequestException(
        error.error?.description ||
          error.message ||
          'Failed to fetch settlements',
      );
    }
  }

  @Get('get-dispute-byOrderId')
  async getDisputesbyOrderId(@Query('collect_id') collect_id: string) {
    try {
      if (!collect_id) {
        throw new BadRequestException('collect_id is required');
      }

      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/get-dispute-byOrderId?collect_id=${collect_id}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
      };
      const { data: paymentsResponse } = await axios.request(config);
      const gateway =
        paymentsResponse.data?.gateway === 'EDVIRON_PG'
          ? 'CASHFREE'
          : paymentsResponse.data?.gateway;

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(paymentsResponse.data?.school_id),
      });

      if (!school) {
        throw new BadRequestException('school not found');
      }
      await this.disputeModel.findOneAndUpdate(
        { collect_id: paymentsResponse.data?.collect_id },
        {
          $set: {
            dispute_id:
              paymentsResponse.data?.cashfreeDispute[0]?.cf_dispute_id || null,
            custom_order_id: paymentsResponse.data?.custom_order_id || null,
            school_id:
              new Types.ObjectId(paymentsResponse.data?.school_id) || null,
            trustee_id:
              new Types.ObjectId(paymentsResponse.data?.trustee_id) || null,
            gateway: gateway || null,
            dispute_status:
              paymentsResponse.data?.cashfreeDispute[0]?.dispute_status || null,
            student_name:
              JSON.parse(paymentsResponse.data.student_detail)?.student_details
                ?.student_name || '',
            dispute_type:
              paymentsResponse.data?.cashfreeDispute[0]?.dispute_type || null,
            dispute_created_date:
              new Date(paymentsResponse.data?.cashfreeDispute[0]?.created_at) ||
              null,
            dispute_updated_date:
              new Date(paymentsResponse.data?.cashfreeDispute[0]?.updated_at) ||
              null,
            dispute_respond_by_date:
              new Date(paymentsResponse.data?.cashfreeDispute[0]?.respond_by) ||
              null,
            dispute_remark:
              paymentsResponse.data?.cashfreeDispute[0]?.cf_dispute_remarks ||
              null,
            reason_description:
              paymentsResponse.data?.cashfreeDispute[0]?.reason_description ||
              null,
            dispute_amount:
              paymentsResponse.data?.cashfreeDispute[0]?.dispute_amount || null,
            order_amount:
              paymentsResponse.data?.cashfreeDispute[0]?.order_details
                ?.order_amount || null,
            payment_amount:
              paymentsResponse.data?.cashfreeDispute[0]?.order_details
                ?.payment_amount || null,
            bank_reference: paymentsResponse?.data?.bank_reference,
            school_name: school.school_name || 'N/A',
            settlement_id:
              paymentsResponse?.data?.cashfreeDispute[0]?.cf_settlement_id ||
              'N/A',
            utr_number:
              paymentsResponse?.data?.cashfreeDispute[0]?.transfer_utr || 'N/A',
            // dispute_status:paymentsResponse.data?.cashfreeDispute[0]?.dispute_status
          },
        },
        { upsert: true, new: true },
      );
      return {
        message: 'Dispute updated successfully',
        data: paymentsResponse.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios Error:', error.response?.data || error.message);
        throw new BadRequestException(
          `External API error: ${
            error.response?.data?.message || error.message
          }`,
        );
      }
      console.error('Internal Error:', error);
      throw new InternalServerErrorException(
        error.message || 'Something went wrong',
      );
    }
  }

  @Post('/create-pos-machine')
  async createPosMachine(
    @Body()
    body: {
      school_id: string;
      trustee_id: string;
      machine_name: string;
      machine_details: {
        device_mid: string;
        merchant_key: string;
        Device_serial_no: string;
        device_tid: string;
        channel_id: string;
        device_id: string;
      };
      status: string;
    },
  ) {
    const { school_id, machine_name, machine_details, status } = body;

    if (!school_id || !machine_name || !machine_details) {
      throw new BadRequestException('Required fields are missing');
    }
    const school = await this.trusteeSchoolModel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return this.erpService.createPosMachine(
      school_id,
      school.trustee_id.toString(),
      machine_name,
      machine_details,
      status,
    );
  }

  @Post('/update-monthly-data')
  async updateBatchData(@Query('date') date?: string) {
    return await this.erpService.updateBatchData(date);
  }

  @Post('/update-monthly-data-merchant')
  async updateMerchantBatchData(@Query('date') date?: string) {
    return await this.erpService.updateMerchantBatchData(date);
  }

  @Get('commision-report')
  async getTransactionReport(
    @Req() req: Request,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('trustee_id') trustee_id?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit?: string,
    @Query('school_id') school_id?: string,
    @Query('format') format?: string,
  ) {
    const merchants = await this.trusteeSchoolModel.find({
      trustee_id: new Types.ObjectId(trustee_id),
    });
    if (!limit) {
      limit = '100';
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const first = startDate || firstDay.toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const last = endDate || lastDay.toISOString().split('T')[0];

    const merchant_ids_to_merchant_map = {};
    merchants.map((merchant: any) => {
      merchant_ids_to_merchant_map[merchant.school_id] = merchant;
    });

    const token = this.jwtService.sign(
      { trustee_id: trustee_id },
      { secret: process.env.PAYMENTS_SERVICE_SECRET },
    );

    let allTransactions: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    const initConfig = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report-csv/?limit=${limit}&startDate=${first}&endDate=${last}&page=1&status=${status}&school_id=${school_id}`,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      data: {
        trustee_id: trustee_id,
        token,
        searchParams: null,
        isCustomSearch: false,
        seachFilter: null,
        payment_modes: null,
        isQRCode: null,
        gateway: null,
      },
    };

    const initResponse = await axios.request(initConfig);
    const totalTransactions = initResponse.data.totalTransactions || 0;
    const totalPages = Math.ceil(totalTransactions / Number(limit));
    allTransactions = [...(initResponse.data.transactions || [])];

    const remainingRequests = [];
    const batchSize = 5;

    for (let i = 2; i <= totalPages; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && i + j <= totalPages; j++) {
        const page = i + j;
        const pageConfig = {
          ...initConfig,
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/bulk-transactions-report-csv/?limit=${limit}&startDate=${first}&endDate=${last}&page=${page}&status=${status}&school_id=${school_id}`,
        };

        batch.push(await this.erpService.safeAxios(pageConfig));
      }

      try {
        const results = await Promise.all(batch);
        for (const response of results) {
          allTransactions.push(...(response.data.transactions || []));
        }
      } catch (error) {
        console.error('Batch failed completely:', error.message || error);
        // Optional: add logging to file or alert
      }
    }

    const transactionReport = await Promise.all(
      allTransactions.map(async (item: any) => {
        let remark = null;
        const comms = await this.commissionModel.findOne({
          collect_id: new Types.ObjectId(item.collect_id),
        });
        if (comms === null) {
          console.log('commision null', item.collect_id);
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
            commission: 0,
            merchant_pricing_type: 'not found commision',
            partner_pricing_type: 'not found commision',
            merchant_pricing: 'not found commision',
            partner_pricing: 'not found commision',
            tax: 'not found commision',
            partner_commission_excl_tax: 'not found commision',
            payment_mode: 'not found commision',
          };
        }
        let comms_amt = comms?.commission_amount || 0;
        // if (comms_amt < 0) {
        //   comms_amt = 0;
        // }
        const schoolCard = await this.trusteeSchoolModel.findOne({
          school_id: new Types.ObjectId(item.merchant_id),
        });
        let platformType = comms?.platform_type || '';
        let payment_mode = comms?.payment_mode || '';
        if (platformType === 'DebitCard' && payment_mode === 'rupay') {
          payment_mode = 'Rupay';
        }
        if (platformType === 'CreditCard' && payment_mode === 'amex') {
          payment_mode = 'Amex';
        }

        if (platformType === 'Wallet' && payment_mode === 'AmazonPay') {
          payment_mode = 'Amazon';
        }
        // if (platformType === 'DebitCard' && payment_mode !== "Rupay") {
        //   payment_mode = "Others"
        // }
        // if (platformType === "CreditCard" && payment_mode !== "Amex") {
        //   payment_mode = "Others"
        // }

        let trustee_id = schoolCard.trustee_id;
        const partnerCard = await this.baseMdrModel.findOne({
          trustee_id: trustee_id,
        });

        let matchPartnerCharge = partnerCard?.platform_charges?.find(
          (charge) =>
            charge.platform_type === platformType &&
            charge.payment_mode === payment_mode,
        );
        if (!matchPartnerCharge) {
          matchPartnerCharge = partnerCard?.platform_charges?.find(
            (charge) =>
              charge.platform_type === platformType &&
              charge.payment_mode === 'Others',
          );
        }
        console.log(payment_mode, 'payment_mode');
        // console.log(matchPartnerCharge, 'matchPartnerCharge');

        let matchedCharge = schoolCard?.platform_charges?.find(
          (charge) =>
            charge.platform_type === platformType &&
            charge.payment_mode === payment_mode,
        );
        if (!matchedCharge) {
          matchedCharge = schoolCard?.platform_charges?.find(
            (charge) =>
              charge.platform_type === platformType &&
              charge.payment_mode === 'Others',
          );
        }

        let debit_credit_type = '';
        let pricing_type = '';
        let partner_pricing_type = '';
        let merchant_pricing = 0;
        let partner_pricing = 0;
        let tax = 0;
        let partner_commission_excl_tax = 0;
        const DEFAULT_TAX_PERCENT = 18;

        if (matchedCharge && matchedCharge.range_charge?.length > 0) {
          const amount = item.order_amount || 0;

          const sortedMerchantRange = [...matchedCharge.range_charge].sort(
            (a, b) => {
              if (a.upto === null) return 1;
              if (b.upto === null) return -1;
              return a.upto - b.upto;
            },
          );

          const range = sortedMerchantRange.find(
            (r) => r.upto === null || amount <= r.upto,
          );

          const sortedPartnerRange = [...matchPartnerCharge.range_charge].sort(
            (a, b) => {
              if (a.upto === null) return 1;
              if (b.upto === null) return -1;
              return a.upto - b.upto;
            },
          );

          const partnerRange = sortedPartnerRange.find(
            (r) => r.upto === null || amount <= r.upto,
          );

          if (range && partnerRange) {
            debit_credit_type = matchedCharge.payment_mode || '';
            pricing_type = range.charge_type || '';
            partner_pricing_type = partnerRange.charge_type || '';
            merchant_pricing = range.charge || 0;
            partner_pricing = partnerRange.charge || 0;

            // partner_commission_excl_tax = parseFloat((comms_amt - tax).toFixed(2));

            if (pricing_type === 'FLAT' && partner_pricing_type === 'FLAT') {
              partner_commission_excl_tax = parseFloat(
                (merchant_pricing - partner_pricing).toFixed(2),
              );
            } else if (
              pricing_type === 'PERCENT' &&
              partner_pricing_type === 'FLAT'
            ) {
              const merchantPrice = (amount * merchant_pricing) / 100;
              partner_commission_excl_tax = parseFloat(
                (merchantPrice - partner_pricing).toFixed(2),
              );
            } else if (
              pricing_type === 'FLAT' &&
              partner_pricing_type === 'PERCENT'
            ) {
              const partnerPrice = (amount * partner_pricing) / 100;
              partner_commission_excl_tax = parseFloat(
                (merchant_pricing - partnerPrice).toFixed(2),
              );
            } else if (
              pricing_type === 'PERCENT' &&
              partner_pricing_type === 'PERCENT'
            ) {
              const partnerPrice = (amount * partner_pricing) / 100;
              const merchantPrice = (amount * merchant_pricing) / 100;
              partner_commission_excl_tax = parseFloat(
                (merchantPrice - partnerPrice).toFixed(2),
              );
            }
          }
          tax = parseFloat(
            ((partner_commission_excl_tax * DEFAULT_TAX_PERCENT) / 100).toFixed(
              2,
            ),
          );
        }

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
          remarks: remark,
          // commission: commissionAmount,
          custom_order_id: item?.custom_order_id || null,
          commission: comms_amt || null,
          merchant_pricing_type: pricing_type || null,
          partner_pricing_type: partner_pricing_type || null,
          merchant_pricing: merchant_pricing || null,
          partner_pricing: partner_pricing || null,
          tax: tax || null,
          partner_commission_excl_tax: (comms_amt - tax).toFixed(2) || null,
          payment_mode: payment_mode || null,
        };
      }),
    );

    transactionReport.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    if (format === 'csv') {
      const { Parser } = require('json2csv');
      const formattedReport = transactionReport.map((tx, index) => ({
        'Sr.No': index + 1,
        'Institute Name': tx.school_name || '',
        'Date & Time': new Date(tx.createdAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        }),
        'Order ID': tx.custom_order_id || '',
        'Edviron order ID': tx.collect_id || '',
        'Order Amt': tx.order_amount || '',
        'Transaction Amt': tx.transaction_amount || '',
        'Payment Method': tx.payment_method || '',
        payment_mode: tx.payment_mode || '',
        Status: tx.status || '',
        'Student Name': tx.student_name || '',
        'Phone No.': tx.student_phone || '',
        'Vendor Amount': 'NA', // Add real value if available
        Gateway: tx.gateway === 'EDVIRON_PG' ? 'CASHFREE' : tx.gateway,
        'Capture Status': tx.capture_status || '',
        Commission: tx?.commission?.toFixed(2) || 0,
        // 'Card Type': JSON.parse(tx?.details)?.card?.card_network || '-', // or use platform_type
        'Merchant Pricing':
          tx.merchant_pricing_type === 'PERCENT'
            ? `${tx.merchant_pricing}%`
            : tx.merchant_pricing || '',
        'Merchant Pricing Type': tx.merchant_pricing_type || '',
        'Partner Pricing':
          tx.partner_pricing_type === 'PERCENT'
            ? `${tx.partner_pricing}%`
            : tx.partner_pricing || '',
        'Partner Pricing Type': tx.partner_pricing_type || '',
        Tax: tx.tax || '',
        'Partner Commission Excluding Tax':
          tx.partner_commission_excl_tax || '',
      }));

      const fields = Object.keys(formattedReport[0] || {});
      const parser = new Parser({ fields });
      const csv = parser.parse(formattedReport);

      res.setHeader(
        'Content-disposition',
        'attachment; filename=transaction_report.csv',
      );
      res.setHeader('Content-Type', 'text/csv');
      return res.status(200).send(csv);
    }

    // else return JSON
    return res.status(200).json({
      transactionReport,
      total_pages: Math.ceil(allTransactions.length / Number(limit)),
      current_page: 1,
    });
  }

  @UseGuards(ErpGuard)
  @Post('/merchant-dashboard')
  async getMerchantToken(
    @Req() req: any,
    @Query('school_id') school_id: string,
    @Query('sign') sign: string,
  ) {
    try {
      const merchant = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!merchant) {
        throw new NotFoundException('Merchant not found');
      }

      if (!merchant.pg_key) {
        throw new BadRequestException('PG Not enabled for this merchant');
      }
      const decoded = this.jwtService.verify(sign, {
        secret: merchant.pg_key,
      });
      if (decoded.school_id.toString() !== school_id) {
        throw new BadRequestException('request forged');
      }
      const trustee_id = req.userTrustee.id;
      const validateTrustee =
        trustee_id.toString() === merchant.trustee_id.toString();
      if (!validateTrustee) {
        throw new BadRequestException('you are not authorized');
      }
      const dashboardToken =
        await this.erpService.generateMerchantDashboardToken(merchant._id);
      const redirectLink = `https://merchant.edviron.com/admin?token=${dashboardToken}`;
      return {
        url: redirectLink,
        message: 'Merchant dashboard link generated successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('easebuzz-nonpartner-update')
  async updateEasebuzzNonpartnerSchools(
    @Body()
    body: {
      school_id: string;
      isEasebuzzNonPartner: boolean;
      nonSeamless: boolean;
      easebuzz_non_partner: {
        easebuzz_key: string;
        easebuzz_salt: string;
        easebuzz_submerchant_id: string;
        easebuzz_merchant_email: string;
      };
    },
  ) {
    try {
      const {
        school_id,
        isEasebuzzNonPartner,
        nonSeamless,
        easebuzz_non_partner,
      } = body;

      const merchant = await this.trusteeSchoolModel.findOneAndUpdate(
        { school_id: new Types.ObjectId(school_id) },
        {
          $set: {
            nonSeamless,
            isEasebuzzNonPartner,
            easebuzz_non_partner,
          },
        },
        { new: true },
      );
      if (!merchant) {
        throw new BadRequestException('school not found');
      }
      return {
        message: 'School updated successfully',
        data: merchant,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('/collect-now')
  async collectNow(
    @Context() context: any,
    @Req() req: any,
    @Body()
    body: {
      isInatallment: boolean;
      InstallmentsIds: string[];
      school_id: string;
      amount: number;
      callback_url: string;
      sign: string;
      trustee_id: string;
      webhook_url: string;
      gateway: PG_GATEWAYS;
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
  ) {
    const {
      isInatallment,
      InstallmentsIds,
      school_id,
      amount,
      callback_url,
      sign,
      webhook_url,
      gateway,
      student_phone_no,
      student_email,
      student_name,
      student_id,
      receipt,
      sendPaymentLink,
      additional_data,
      custom_order_id,
      req_webhook_urls,
      split_payments,
      vendors_info,
    } = body;

    let { disabled_modes } = body;
    const trustee_id = req.userTrustee.id;
    try {
      if (
        !school_id ||
        !amount ||
        !callback_url ||
        !sign ||
        !gateway ||
        !webhook_url
      ) {
        throw new BadRequestException('Required fields are missing');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('School not found');
      }
      if (!school.pg_key) {
        throw new BadRequestException('PG Not enabled for this merchant');
      }
      const decoded = this.jwtService.verify(sign, {
        secret: school.pg_key,
      });
      if (
        decoded.school_id.toString() !== school_id ||
        decoded.amount.toString() !== amount.toString() ||
        decoded.callback_url !== callback_url
      ) {
        throw new BadRequestException('request forged | invalid sign');
      }
      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new BadRequestException('you are not authorized');
      }

      const gateways = await this.erpService.getGatewayForSchool(school_id);

      let isVBAPayment = false;
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

      if (split_payments && !vendors_info) {
        throw new BadRequestException(
          'Vendors information is required for split payments',
        );
      }

      if (split_payments && vendors_info && vendors_info.length < 0) {
        throw new BadRequestException('At least one vendor is required');
      }

      let vendorgateway: any = {};
      const updatedVendorsInfo = [];
      let easebuzzVendors = [];
      let cashfreeVendors = [];

      // VENDORS LOGIC FOR MULTIPLE GATEWAYS
      if (split_payments && vendors_info && vendors_info.length > 0) {
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

          if (
            vendors_data.gateway &&
            vendors_data.gateway?.includes(GATEWAY.EASEBUZZ)
          ) {
            if (
              !vendors_data.easebuzz_vendor_id ||
              !school.easebuzz_school_label
            ) {
              throw new BadRequestException(
                `Split Information Not Configure Please contact tarun.k@edviron.com`,
              );
            }
            vendorgateway.easebuzz = true;
            let easebuzzVen = vendor;
            easebuzzVen.vendor_id = vendors_data.easebuzz_vendor_id;
            const updatedEZBVendor = {
              ...easebuzzVen,
              name: vendors_data.name,
            };
            easebuzzVendors.push(updatedEZBVendor);
          }

          if (
            vendors_data.gateway &&
            vendors_data.gateway?.includes(GATEWAY.CASHFREE)
          ) {
            if (!vendors_data.vendor_id) {
              throw new BadRequestException(
                `Split Information Not Configure Please contact tarun.k@edviron.com`,
              );
            }
            vendorgateway.cashfree = true;
            let CashfreeVen = vendor;
            CashfreeVen.vendor_id = vendors_data.vendor_id;
            const updatedCFVendor = {
              ...CashfreeVen,
              name: vendors_data.name,
            };
            cashfreeVendors.push(updatedCFVendor);
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

          if (splitMethod === 'amount' && totalAmount > body.amount) {
            throw new BadRequestException(
              'Sum of vendor amounts cannot be greater than the order amount',
            );
          }

          if (splitMethod === 'percentage' && totalPercentage > 100) {
            throw new BadRequestException(
              'Sum of vendor percentages cannot be greater than 100%',
            );
          }

          // ✅ Convert percentage to amount if gateway is EASEBUZZ
          if (splitMethod === 'percentage' && vendorgateway.easebuzz) {
            for (const vendor of easebuzzVendors) {
              if (typeof vendor.percentage === 'number') {
                vendor.amount = (vendor.percentage / 100) * body.amount;
                delete vendor.percentage;
              }
            }
            // Update splitMethod to 'amount' since we converted it
            splitMethod = 'amount';
          }
        }
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

      const data = {
        InstallmentsIds,
        isInatallment,
        school_id,
        trustee_id,
        callback_url,
        webhook_url,
        token: 'add later',
        gateway: gateways,
        amount,
        disabled_modes,
        custom_order_id,
        school_name: school.school_name,
        isSplit: split_payments,
        isVBAPayment,
        additional_data: additionalInfo,
        cashfree: {
          client_id: school.cashfree_credentials?.cf_api_key || null,
          client_secret:
            school.cashfree_credentials?.cf_x_client_secret || null,
          api_key: school.cashfree_credentials?.cf_api_key || null,
          isSeamless: true, //make it dynamic later
          isPartner: true, // make it dynamic later
          isVba: isVBAPayment,
          vba: {
            vba_account_number,
            vba_ifsc: '',
          },
          cashfreeVendors,
        },
        student_phone_no,
        easebuzz: {
          mid: school.easebuzz_non_partner?.easebuzz_submerchant_id || null,
          key: school.easebuzz_non_partner?.easebuzz_key || null,
          salt: school.easebuzz_non_partner?.easebuzz_salt || null,
          isPartner: true,
          bank_label: school.easebuzz_school_label || null,
          easebuzzVendors,
        },
      };
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('/save-installment')
  async saveInstallments(
    @Req() req: any,
    @Body()
    body: {
      school_id: string;
      student_detail: {
        student_id: string;
        student_number: string;
        student_name: string;
        student_email: string;
        student_class: string;
        student_section: string;
        student_gender: string;
      };
      callback_url: string;
      additional_data: any;
      amount: number;
      net_amount: number;
      discount: number;
      year: number;
      month: number;
      sign: string;
      gateway: string;
      isInstallement: boolean;
      installments: [
        {
          label: string;
          amount: number;
          net_amount: number;
          discount: number;
          gst: number;
          year: string;
          month: string;
          preSelected?: boolean;
          isPaid?: boolean;
          payment_mode?: string;
          payment_detail?: {
            bank_reference_number: string;
            upi?: {
              upi_id: string;
            };
            card?: {
              card_bank_name: string;
              card_network: string;
              card_number: string;
              card_type: string;
            };
            net_banking?: {
              netbanking_bank_name: string;
              netbanking_bank_code?: string;
            };
            dd_detail?: {
              amount: number;
              dd_number: string;
              bank_name: string;
              branch_name: string;
              depositor_name?: string;
              date?: Date;
              remark?: string;
            };
            cheque_detail?: {
              accountHolderName: string;
              bankName: string;
              chequeNo: string;
              dateOnCheque: string;
              remarks?: string;
            };
            static_qr?: {
              upiId: string;
              transactionAmount: number | string;
              bankReferenceNo: string;
              appName?: string;
            };
            cash_detail?: {
              notes: {
                [denomination: number]: number;
              };
              total_cash_amount?: number;
              amount?: number;
              depositor_name?: string;
              collector_name?: string;
              date?: Date;
              remark?: string;
            };
            wallet?: {
              provider: string;
            };
          };
          fee_heads: [
            {
              label: string;
              amount: number;
              net_amount: number;
              discount: number;
              gst: number;
            },
          ];
        },
      ];
      installment_name: string;
      webhook_url?: string;
    },
  ) {
    const trustee_id = req.userTrustee.id;
    const authHeader = req.headers.authorization;
    const authToken = authHeader.split(' ')[1] || null;
    const {
      sign,
      school_id,
      student_detail,
      callback_url,
      additional_data,
      amount,
      net_amount,
      discount,
      year,
      month,
      gateway,
      isInstallement,
      installments,
      installment_name,
      webhook_url,
    } = body;
    const {
      student_id,
      student_number,
      student_name,
      student_email,
      student_class,
      student_section,
      student_gender,
    } = student_detail;

    try {
      if (
        !student_id ||
        !student_number ||
        !student_name ||
        !student_email ||
        !student_class ||
        !student_section ||
        !student_gender
      ) {
        throw new BadRequestException(
          'required all student detail like student_id , student_number, student_name, student_email, student_class, student_section, student_gender',
        );
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School not found');
      }
      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new BadRequestException('Invalid School Id');
      }
      if (!school.isCollectNow) {
        throw new BadRequestException('school is not active on collect now');
      }
      if (!callback_url) {
        throw new BadRequestException('callback url required');
      }
      const token = this.jwtService.sign(
        { school_id },
        {
          secret: school.pg_key,
          expiresIn: '1y',
        },
      );

      if (!school.pg_key) {
        throw new BadRequestException('PG is not activated for your school');
      }

      let totalAmount = 0;
      let totalNetAmount = 0;
      let totalDiscount = 0;

      const seenMonths = new Set<string>();

      await Promise.all(
        installments.map(async (data: any, index: number) => {
          const { year, month, amount, net_amount, discount } = data;
          console.log(data, 'data');

          console.log(year, 'year');

          // YEAR REGEX VALIDATION
          if (!/^\d{4}$/.test(year)) {
            throw new ConflictException(
              `Invalid year at installment index ${index}: ${year}`,
            );
          }

          // CHECK FOR VALID MONTH
          const monthNum = Number(month);
          if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            throw new ConflictException(
              `Invalid month at installment index ${index}: ${month}`,
            );
          }

          const key = `${year}-${monthNum}`;
          if (seenMonths.has(key)) {
            throw new Error(`Duplicate installment for ${key}`);
          }
          seenMonths.add(key);

          totalAmount += Number(amount) || 0;
          totalNetAmount += Number(net_amount) || 0;
          totalDiscount += Number(discount) || 0;

          // ADD VALIDATION FOR FEE HEADS LATER
        }),
      );

      if (totalNetAmount !== net_amount) {
        throw new BadRequestException(
          `Net amount mismatch: expected ${totalNetAmount}, but received ${net_amount}.`,
        );
      }
      const data = {
        school_id,
        trustee_id,
        student_detail,
        additional_data,
        amount,
        net_amount,
        discount,
        year,
        month,
        gateway,
        isInstallement,
        installments,
        installment_name,
        callback_url,
        webhook_url,
        sign: token,
      };

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pay/installments`,
        headers: {
          'Content-Type': 'application/json',
        },
        data,
      };
      //changes
      const response = await axios.request(config);
      // console.log(response.data);

      const sign = this.jwtService.sign(
        {
          school_id,
          url: response.data.url + '&token=' + token,
        },
        {
          secret: school.pg_key,
        },
      );
      const res = {
        ...response.data,
        url: response.data.url + '&token=' + token,
        sign: sign,
      };
      return { res: res, message: 'Installment saved successfully' };
    } catch (e) {
      console.log(e.response.message, 'e.response');
      if(e.response?.data?.message){
        throw new BadRequestException(e.response.data.message);
      }
      throw new BadRequestException(e.message)

    }
  }

  @Get('/installment-sign')
  async getInstallmentSign(@Req() req: any) {
    try {
      const { school_id } = req.query;
      if (!school_id) {
        throw new BadRequestException('school_id is required');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School not found');
      }
      if (!school.pg_key) {
        throw new BadRequestException('PG is not activated for your school');
      }
      console.log(school.pg_key, 'school.pg_key');
      const sign = this.jwtService.sign(
        { school_id },
        {
          secret: school.pg_key,
        },
      );
      return { sign };
    } catch (error) {
      console.log(error.response,'Error Response ');

      throw new BadRequestException(error.message);
    }
  }

  // @UseGuards(ErpGuard)
  @Post('/edviron-pay')
  async collectInstallments(
    @Body()
    body: {
      isInstallment: boolean;
      mode: string;
      InstallmentsIds: string[];
      school_id: string;
      callback_url: string;
      webhook_url: string;
      token: string;
      sign: string;
      gateway: {
        cashfree: boolean;
        razorpay: boolean;
        easebuzz: boolean;
      };
      netBankingDetails?: {
        utr: string;
        amount: string;
        remarks: string;
        payer: {
          bank_holder_name: string;
          bank_name: string;
          ifsc: string;
          account_no: string;
        };
        recivers: {
          bank_holder_name: string;
          bank_name: string;
          ifsc: string;
        };
      };
      student_detail: {
        student_id: string;
        student_name: string;
        student_number: string;
        student_email: string;
      };
      amount: number;
      disable_mode: string[];
      custom_order_id?: string;
      isSplit?: boolean;
      isVBAPayment?: boolean;
      additional_data?: any;
      payment_link?: {
        email: string;
      };
      parents_info: {
        name: string;
        phone: string;
        email: string;
        relationship: string;
      };
      optional_fields: {
        remarks: string;
        amount: number;
        date: string;
      };
      vendors_info?: [
        {
          vendor_id: string;
          // percentage?: number;
          amount?: number;
          name?: string;
        },
      ];
      remark?: string;
      cash_detail?: {
        note: {
          [denomination: number]: number;
        };
        total_cash_amount?: number;
        amount?: number;
        depositor_name?: string;
        collector_name?: string;
        date?: Date;
        remark?: string;
      };
      dd_detail?: {
        amount: number;
        dd_number: string;
        bank_name: string;
        branch_name: string;
        depositor_name?: string;
        date?: Date;
        remark?: string;
      };
      cheque_detail?: {
        accountHolderName: string;
        bankName: string;
        chequeNo: string;
        dateOnCheque: string;
        remarks?: string;
      };
      static_qr?: {
        upiId: string;
        transactionAmount: number | string;
        bankReferenceNo: string;
        appName?: string;
      };
      beneficiaryBankingDetails?: {
        buyerName?: string;
        payeeBankName?: string;
        payeeAccountNumber?: string;
        payeeIFSC?: string;
        payeeBranch?: string;
      };
      date?: string;
      file?: any;
    },
    @Req() req,
  ) {
    try {
      const {
        isInstallment,
        InstallmentsIds,
        school_id,
        callback_url,
        webhook_url,
        gateway,
        amount,
        disable_mode,
        custom_order_id,
        isSplit,
        additional_data,
        sign,
        mode,
        student_detail,
        payment_link,
        vendors_info,
        cash_detail,
        dd_detail,
        file,
        static_qr,
        netBankingDetails,
        cheque_detail,
        date,
        parents_info,
        remark,
        beneficiaryBankingDetails,
      } = body;
      let { student_id, student_name, student_email, student_number } =
        student_detail;
      const authToken = req.headers.authorization.replace('Bearer ', '');
      // const authToken = sign;

      if (isInstallment && InstallmentsIds.length <= 0) {
        console.log(InstallmentsIds, 'InstallmentsIds');
        throw new ConflictException(`Installment Id's cant be empty`);
      }
      const additionalInfo = {
        student_details: {
          student_id: student_id,
          student_email: student_email,
          student_name: student_name,
          student_phone_no: student_number,
        },
        additional_fields: {
          ...additional_data,
        },
        beneficiary_fields: {
          ...beneficiaryBankingDetails,
        },
      };

      if (!school_id) {
        throw new BadRequestException('School id is required');
      }
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('school not found');
      }

      const decoded = this.jwtService.verify(authToken, {
        secret: school.pg_key,
      });
      if (decoded.school_id.toString() !== school_id.toString()) {
        throw new BadRequestException('Authorization Error');
      }
      if (
        mode === 'PAYMENT_LINK' &&
        !payment_link.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payment_link.email)
      ) {
        throw new BadRequestException('Please send a valid email address');
      }
      if (!amount) {
        throw new BadRequestException('Amount is required');
      }

      if (mode === 'EDVIRON_CASH') {
        if (cash_detail.amount < 0) {
          throw new BadRequestException('amount can not be less then zero');
        }
        if (
          !cash_detail.amount ||
          !cash_detail.collector_name ||
          !cash_detail.date ||
          !cash_detail.depositor_name ||
          !cash_detail.total_cash_amount
        ) {
          throw new BadRequestException('all fields required');
        }
        const totalCash = Object.entries(cash_detail.note).reduce(
          (sum, [denomination, count]) => {
            return sum + Number(denomination) * Number(count);
          },
          0,
        );
        if (totalCash !== amount) {
          throw new BadRequestException(
            `Cash mismatch: expected ${amount}, got ${totalCash}`,
          );
        }
      }

      if (mode === 'POS') {
        const htmlBody = generatePosRequest(
          school_id.toString(),
          school.school_name,
        );
        await this.emailService.sendPOSMail(
          htmlBody,
          `Edviron | POS Request of ${school.school_name}`,
          `tarun.k@edviron.com`,
          // 'manish.verma@edviron.com'
        );
        return { message: 'POS request has been raised successfully.' };
      }

      if (mode === 'EDVIRON_STATIC_QR') {
        if (Number(static_qr.transactionAmount) < 0) {
          throw new BadRequestException('amount can not be less then zero');
        }
        if (
          !static_qr.transactionAmount ||
          !static_qr.appName ||
          !static_qr.bankReferenceNo ||
          !static_qr.upiId
        ) {
          throw new BadRequestException('all fields required');
        }
        if (Number(static_qr.transactionAmount) < amount) {
          throw new BadRequestException(
            `Cash mismatch: expected ${amount}, got ${static_qr.transactionAmount}`,
          );
        }
      }

      if (mode === 'DEMAND_DRAFT') {
        if (dd_detail.amount < 0) {
          throw new BadRequestException('amount can not be less then zero');
        }
        if (dd_detail.amount !== amount) {
          throw new BadRequestException(
            `Demand draft amount mismatch: expected ${amount}, got ${dd_detail.amount}`,
          );
        }
        if (
          !dd_detail.amount ||
          !dd_detail.bank_name ||
          !dd_detail.branch_name ||
          !dd_detail.dd_number ||
          !dd_detail.depositor_name
        ) {
          throw new BadRequestException('all fields required');
        }
        if (dd_detail.dd_number.length > 7) {
          throw new BadRequestException('Invalid DD number.');
        }
      }

      if (mode === 'EDVIRON_NETBANKING') {
        if (Number(netBankingDetails.amount) < 0) {
          throw new BadRequestException('amount can not be less then zero');
        }

        if (
          !netBankingDetails?.amount ||
          !netBankingDetails?.payer?.bank_holder_name ||
          !netBankingDetails?.payer?.bank_name ||
          !netBankingDetails?.payer?.ifsc ||
          !netBankingDetails?.payer?.account_no
          // ||
          // !netBankingDetails?.recivers?.bank_holder_name ||
          // !netBankingDetails?.recivers?.bank_name ||
          // !netBankingDetails?.recivers?.ifsc
        ) {
          throw new BadRequestException('all fields required');
        }
      }
      if (mode.toUpperCase() === 'CHEQUE') {
        if (
          !cheque_detail.accountHolderName ||
          !cheque_detail.bankName ||
          !cheque_detail.chequeNo ||
          !cheque_detail.dateOnCheque
        ) {
          throw new BadRequestException('all fields required');
        }
        if (cheque_detail.chequeNo.length !== 6) {
          throw new BadRequestException('Invalid Cheque number.');
        }
      }

      let splitPay = isSplit;
      if (!callback_url) {
        throw new BadRequestException('Callback url is required');
      }
      if (!sign) {
        throw new BadRequestException('sign is required');
      }

      let document_url = null;
      if (file && typeof file === 'string' && file.startsWith('data:')) {
        console.log('Received base64 file:', file.substring(0, 50) + '...');

        const matches = file.match(/^data:(.+);base64,(.+)$/);
        if (!matches) {
          throw new BadRequestException('Invalid base64 file format');
        }

        const file_type = matches[1]; // e.g. 'application/pdf'
        const base64Data = matches[2];
        console.log('Detected file type:', file_type);

        const buffer = Buffer.from(base64Data, 'base64');

        const fieldname = 'file';
        const originalname = `upload-${Date.now()}.${file_type.split('/')[1]}`;

        const fileTypes =
          this.S3BucketService.getFileTypeFromBase64(base64Data);

        const link = await this.S3BucketService.uploadToS3(
          buffer,
          `${school_id}_${fieldname}_${originalname}`,
          fileTypes,
          process.env.PAYMENT_PROOF,
          // "pg-kyc"
        );

        document_url = link;
      }
      if (isSplit && !vendors_info) {
        throw new BadRequestException(
          'Vendors information is required for split payments',
        );
      }

      if (isSplit && vendors_info && vendors_info.length < 0) {
        throw new BadRequestException('At least one vendor is required');
      }

      let vendorgateway: any = {};
      const updatedVendorsInfo = [];
      let easebuzzVendors = [];
      let cashfreeVedors = [];
      let worldLine_vendors: any = [];
      let razorpayVendors: any = [];

      if (isSplit && vendors_info && vendors_info.length > 0) {
        // Determine the split method (amount or percentage) based on the first vendor
        let splitMethod = null;
        let totalAmount = 0;
        let totalPercentage = 0;
        if (school.worldline && school.worldline.encryption_key) {
          for (const vendor of vendors_info) {
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

            if (!vendors_data.gateway?.includes(GATEWAY.WORLDLINE)) {
              throw new BadRequestException('Split Not configure');
            }
            // if (vendor.percentage) {
            //   throw new BadRequestException(
            //     'Please pass Amount for WorldLine schools',
            //   );
            // }
            if (
              !vendors_data.worldline_vendor_name &&
              vendors_data.worldline_vendor_id
            ) {
              throw new BadRequestException('Split Not Configure');
            }
            vendorgateway.worldline = true;
            let worldlineVenodr: any = {};
            (worldlineVenodr.vendor_id = vendor.vendor_id),
              (worldlineVenodr.amount = vendor.amount),
              (worldlineVenodr.name = vendors_data.worldline_vendor_name);
            worldlineVenodr.scheme_code = vendors_data.worldline_vendor_id;
            worldLine_vendors.push(worldlineVenodr);
          }
        } else {
          console.time('check vendor');
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

            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.EASEBUZZ)
            ) {
              if (
                !vendors_data.easebuzz_vendor_id ||
                !school.easebuzz_school_label
              ) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.easebuzz = true;
              let easebuzzVen = vendor;
              easebuzzVen.vendor_id = vendors_data.easebuzz_vendor_id;
              const updatedEZBVendor = {
                ...easebuzzVen,
                name: vendors_data.name,
              };
              easebuzzVendors.push(updatedEZBVendor);
            }

            // VENDORS FOR RAZORPAY
            if (
              vendors_data.gateway &&
              vendors_data.gateway.includes(GATEWAY.RAZORPAY)
            ) {
              console.log('checking vendors for razorpay');

              if (!vendors_data.razorpayVendor?.account) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.razorpay = true;
              let razorpayVendor = vendor;
              razorpayVendor.vendor_id = vendors_data.razorpayVendor.account;
              const updatedRazorPayVendor = {
                ...razorpayVendor,
                account: vendors_data.razorpayVendor.account,
                vendor_id: vendors_data._id.toString(),
                name: vendors_data.name,
              };
              console.log(
                updatedRazorPayVendor,
                'checking for updated vendors',
              );
              console.log(vendor, 'checkoing vendors');
              console.log(vendors_data.gateway.includes(GATEWAY.CASHFREE));
              console.log(updatedVendorsInfo, 'updatedben');

              if (!vendors_data.gateway.includes(GATEWAY.CASHFREE)) {
                console.log('cashfree vendor not active');

                updatedVendorsInfo.push({
                  vendor_id: vendors_data._id.toString(),
                  amount: razorpayVendor.amount,
                  name: vendors_data.name,
                });
              }
              razorpayVendors.push(updatedRazorPayVendor);
            }

            if (
              vendors_data.gateway &&
              vendors_data.gateway?.includes(GATEWAY.CASHFREE)
            ) {
              if (!vendors_data.vendor_id) {
                throw new BadRequestException(
                  `Split Information Not Configure Please contact tarun.k@edviron.com`,
                );
              }
              vendorgateway.cashfree = true;
              let CashfreeVen = vendor;
              CashfreeVen.vendor_id = vendors_data.vendor_id;
              const updatedCFVendor = {
                ...CashfreeVen,
                name: vendors_data.name,
              };
              cashfreeVedors.push(updatedCFVendor);
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
            if (!vendors_data.gateway?.includes(GATEWAY.RAZORPAY)) {
              updatedVendorsInfo.push(updatedVendor);
            }

            // Check if both amount and percentage are used
            const hasAmount = typeof vendor.amount === 'number';
            // const hasPercentage = typeof vendor.percentage === 'number';

            // if (hasAmount && hasPercentage) {
            //   throw new BadRequestException(
            //     'Amount and Percentage cannot be present at the same time',
            //   );
            // }

            // Determine and enforce split method consistency
            const currentMethod = hasAmount;
            // ? 'amount'
            // : hasPercentage
            //   ? 'percentage'
            //   : null;

            if (!splitMethod) {
              splitMethod = currentMethod;
            } else if (currentMethod && currentMethod !== splitMethod) {
              throw new BadRequestException(
                'All vendors must use the same split method (either amount or percentage)',
              );
            }

            // Ensure either amount or percentage is provided for each vendor
            if (!hasAmount) {
              throw new BadRequestException('Each vendor must have an amount ');
            }

            if (hasAmount) {
              if (vendor.amount < 0) {
                throw new BadRequestException(
                  'Vendor amount cannot be negative',
                );
              }
              totalAmount += vendor.amount;
            }
            // else if (hasPercentage) {
            //   if (vendor.percentage < 0) {
            //     throw new BadRequestException(
            //       'Vendor percentage cannot be negative',
            //     );
            //   }
            //   totalPercentage += vendor.percentage;
            // }
          }
          console.timeEnd('check vendor');
          if (splitMethod === 'amount' && totalAmount > body.amount) {
            throw new BadRequestException(
              'Sum of vendor amounts cannot be greater than the order amount',
            );
          }

          // if (splitMethod === 'percentage' && totalPercentage > 100) {
          //   throw new BadRequestException(
          //     'Sum of vendor percentages cannot be greater than 100%',
          //   );
          // }

          // ✅ Convert percentage to amount if gateway is EASEBUZZ
          if (splitMethod === 'percentage' && vendorgateway.easebuzz) {
            for (const vendor of easebuzzVendors) {
              if (typeof vendor.percentage === 'number') {
                vendor.amount = (vendor.percentage / 100) * body.amount;
                delete vendor.percentage;
              }
            }
            // Update splitMethod to 'amount' since we converted it
            splitMethod = 'amount';
          }
        }
      }

      // if (school.isVendor && school.vendor_id) {
      //   vendorgateway.cashfree = true;
      //   const updatedVendor = {
      //     vendor_id: school.vendor_id,
      //     percentage: 100,
      //     name: school.school_name,
      //   };
      //   splitPay = true;
      //   cashfreeVedors.push(updatedVendor);
      // }

      let userGateway = {
        cashfree: false,
        razorpay: false,
        easebuzz: false,
      };
      let cashfree: any = {};
      let easebuzz: any = {};

      const gateways = await this.erpService.getGatewayForSchool(school_id);

      if (gateways.cashfree && school.client_id && school.client_id !== '0') {
        if (!school.cashfree_credentials) {
          throw new BadRequestException('Credentials not found');
        }

        userGateway.cashfree = true;
        cashfree = {
          client_id: school.cashfree_credentials?.cf_x_client_id,
          client_secret: school.cashfree_credentials?.cf_x_client_secret,
          api_key: school.cashfree_credentials?.cf_api_key,
          isSeamless: !school.nonSeamless,
          isPartner: true,
          isVba: false,
          vba: {
            vba_account_number: null,
            vba_ifsc: null,
          },
        };
      }

      if (gateways.easebuzz && school.easebuzz_non_partner.easebuzz_key) {
        easebuzz = {
          key: school.easebuzz_non_partner.easebuzz_key,
          salt: school.easebuzz_non_partner.easebuzz_salt,
          mid: school.easebuzz_non_partner.easebuzz_submerchant_id,
          easebuzz_merchant_email:
            school.easebuzz_non_partner.easebuzz_merchant_email,
          // isPartner : true
        };
      }

      let isVBAPayment = false;
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
            !student_number
          ) {
            throw new BadRequestException(
              `Student details required for NEFT/RTGS`,
            );
          }
          const vba = await this.erpService.createStudentVBA(
            student_id,
            student_name,
            student_email,
            student_number,
            school_id,
            Number(amount),
          );
          vba_account_number = vba.vba_account_number;
        } catch (e) {
          console.log(e);
        }
      }

      const token = this.jwtService.sign(
        { school_id },
        {
          secret: process.env.PAYMENTS_SERVICE_SECRET,
        },
      );
      const payload = {
        mode,
        isInstallment,
        InstallmentsIds,
        school_id,
        trustee_id: school.trustee_id.toString(),
        callback_url,
        webhook_url,
        token,
        gateway: gateways,
        amount,
        disable_mode,
        custom_order_id,
        school_name: school.school_name || 'NA',
        isSplit,
        additional_data: additionalInfo || {},
        cashfree,
        easebuzz,
        isVBAPayment: isVBAPayment || false,
        vba_account_number: vba_account_number || 'NA',
        split_payments: splitPay || false,
        vendors_info: updatedVendorsInfo || null,
        vendorgateway: vendorgateway,
        easebuzzVendors,
        cashfreeVedors,
        worldLine_vendors: worldLine_vendors || null,
        razorpay_vendors: razorpayVendors,
        cash_detail,
        dd_detail,
        document_url,
        student_detail,
        static_qr,
        netBankingDetails,
        cheque_detail,
        date,
        parents_info,
        remark,
        beneficiaryBankingDetails,
      };

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pay/collect-request`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        data: payload,
      };

      const { data: paymentRes } = await axios.request(config);
      const { collect_request_id, url } = paymentRes;

      if (mode === 'EDVIRON_UPI') {
        const pg_token = await this.jwtService.sign(
          { collect_id: collect_request_id },
          { secret: process.env.PAYMENTS_SERVICE_SECRET },
        );
        const config = {
          method: 'GET',
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/upi-payment?collect_id=${collect_request_id}&token=${pg_token}`,
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
          },
        };
        const { data: response } = await axios.request(config);
        return response;
      }
      if (mode === 'PAYMENT_LINK') {
        const school_name = school.school_name;
        const payment_url = paymentRes.url;
        if (!payment_url) {
          throw new BadRequestException('payment link not found');
        }
        const mail_id = payment_link.email;
        console.log(mail_id, 'checkhere');
        if (!mail_id) {
          throw new BadRequestException('mail id not found');
        }
        await this.trusteeService.sendPaymentMail(
          payment_url,
          mail_id,
          student_name,
          school_name || 'N/A',
          amount,
        );
      }
      if (mode === 'EDVIRON_VBA') {
        console.log('vba');

        const config = {
          method: 'GET',
          url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/vba-details?collect_id=${collect_request_id}`,
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
          },
        };
        const { data: response } = await axios.request(config);
        return response;
      }
      return paymentRes;
    } catch (e) {
      if (e?.response) {
        console.log(e?.response, 'e?.response');
        throw new BadRequestException(
          e?.response?.data?.message ||
            e?.response?.message ||
            'internal server error',
        );
      }
      console.log(e, 'error');
      throw new BadRequestException(e.message);
    }
  }

  @Post('update-cheque-status')
  @UseGuards(ErpGuard)
  async updateChequeStatus(
    @Body()
    body: {
      collect_id: string;
      school_id: string;
      status: chequeStatus;
      sign: string;
    },
  ) {
    try {
      const { collect_id, school_id, status, sign } = body;
      await new this.webhooksLogsModel({
        type: 'cheque status',
        order_id: collect_id,
        body: JSON.stringify(body),
      }).save();

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('school not found');
      }
      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (decoded.school_id.toString() !== school_id.toString()) {
        throw new ForbiddenException('request forged');
      }
      const token = this.jwtService.sign(
        { school_id: school_id },
        { secret: process.env.PAYMENTS_SERVICE_SECRET! },
      );

      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pay/update-cheque-status?token=${token}&collect_id=${collect_id}&status=${status}`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
      };
      const { data } = await axios.request(config);
      return data;
    } catch (error) {
      console.log(error.response.data);
      throw new BadRequestException(
        error?.response?.data?.message || 'internal server error',
      );
    }
  }

  @Post('create-merchant')
  @UseGuards(ErpGuard)
  async createMerchant(
    @Body()
    body: {
      admin_name: string;
      phone_number: string;
      email: string;
      merchant_name: string;
      businessProofDetails: {
        business_name: string;
        business_pan_name: string;
        business_pan_number: string;
        merchant_website: string;
        school_website: string;
      };
      businessAddress: {
        address: string;
        city: string;
        pincode: string;
        state: string;
      };
      authSignatory: {
        auth_sighnatory_aadhar_number: string;
        auth_sighnatory_name_on_aadhar: string;
        auth_sighnatory_name_on_pan: string;
        auth_sighnatory_pan_number: string;
      };
      bankDetails: {
        account_holder_name: string;
        account_number: string;
        bank_name: string;
        ifsc_code: string;
      };
      businessSubCategory: KycBusinessSubCategory;
      business_type: BusinessTypes;
      businessCategory: KycBusinessCategory;
      gst: string;
    },
    @Req() req,
  ): Promise<any> {
    try {
      const {
        phone_number,
        admin_name: name,
        email,
        merchant_name: school_name,
        businessAddress,
        businessProofDetails,
        authSignatory,
        bankDetails,
        businessCategory,
        business_type,
        businessSubCategory,
        gst,
      } = body;
      businessProofDetails.school_website =
        businessProofDetails.merchant_website;

      if (!name || !body.phone_number || !body.email || !school_name) {
        throw new BadRequestException('Fill all fields');
      }

      if (!Object.values(BusinessTypes).includes(business_type)) {
        throw new BadRequestException(`Invalid  Input: ${business_type}`);
      }

      if (!Object.values(KycBusinessCategory).includes(businessCategory)) {
        throw new BadRequestException(`Invalid  Input: ${businessCategory}`);
      }

      if (
        !Object.values(KycBusinessSubCategory).includes(businessSubCategory)
      ) {
        throw new BadRequestException(`Invalid  Input: ${businessSubCategory}`);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[6-9]\d{9}$/;
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
      const aadharRegex = /^[0-9]{12}$/;
      const bankAccountNumberRegex = /^[0-9]{9,18}$/;
      const IFSCRegex = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
      const pinCodeRegex = /^[1-9][0-9]{5}$/;

      if (!emailRegex.test(body.email)) {
        throw new BadRequestException('Invalid email format');
      }

      if (
        !businessCategory ||
        !['Education', 'Others'].includes(businessCategory)
      ) {
        throw new BadRequestException('Invalid input for businessCategory');
      }

      if (!phoneRegex.test(body.phone_number)) {
        throw new BadRequestException('Invalid phone number format');
      }

      // BUSINESS PAN REGEX
      if (
        businessProofDetails &&
        businessProofDetails.business_pan_number &&
        !panRegex.test(businessProofDetails.business_pan_number)
      ) {
        throw new BadRequestException('Invalid Input for business PAN ');
      }

      if (
        businessAddress &&
        businessAddress.pincode &&
        !pinCodeRegex.test(businessAddress.pincode)
      ) {
        throw new BadRequestException(
          'Invalid Input for businessAddress Pin Code',
        );
      }

      if (
        authSignatory &&
        authSignatory.auth_sighnatory_aadhar_number &&
        !aadharRegex.test(authSignatory.auth_sighnatory_aadhar_number)
      ) {
        throw new BadRequestException('Invalid Input for Aaadhar Card number');
      }

      if (
        bankDetails &&
        bankDetails.account_number &&
        !bankAccountNumberRegex.test(bankDetails.account_number)
      ) {
        throw new BadRequestException('Invalid Input for Bank account number');
      }

      if (
        bankDetails &&
        bankDetails.ifsc_code &&
        !IFSCRegex.test(bankDetails.ifsc_code)
      ) {
        throw new BadRequestException('Invalid Input for IFSC Code');
      }

      const school = await this.erpService.createmechant(
        phone_number,
        name,
        email,
        school_name,
        req.userTrustee.id.toString(),
        businessProofDetails,
        businessAddress,
        authSignatory,
        bankDetails,
        businessSubCategory,
        business_type,
        businessCategory,
      );

      const { school_id } = school.updatedSchool;

      const kycStatus = await this.erpService.initiateKyc(
        phone_number,
        email,
        school_name,
        school_id,
        businessProofDetails,
        businessAddress,
        authSignatory,
        bankDetails,
        businessCategory,
        business_type,
        businessSubCategory,
        gst,
      );

      return kycStatus;

      return school;
    } catch (error) {
      if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('update-merchant')
  @UseGuards(ErpGuard)
  async updateMerchant(
    @Body()
    body: {
      school_id: string;
      admin_name: string;
      phone_number: string;
      email: string;
      merchant_name: string;
      businessProofDetails: {
        business_name: string;
        business_pan_name: string;
        business_pan_number: string;
        merchant_website: string;
        school_website: string;
      };
      businessAddress: {
        address: string;
        city: string;
        pincode: string;
        state: string;
      };
      authSignatory: {
        auth_sighnatory_aadhar_number: string;
        auth_sighnatory_name_on_aadhar: string;
        auth_sighnatory_name_on_pan: string;
        auth_sighnatory_pan_number: string;
      };
      bankDetails: {
        account_holder_name: string;
        account_number: string;
        bank_name: string;
        ifsc_code: string;
      };
      businessSubCategory: KycBusinessSubCategory;
      business_type: BusinessTypes;
      businessCategory: KycBusinessCategory;
      gst: string;
    },
    @Req() req,
  ): Promise<any> {
    try {
      const {
        school_id,
        phone_number,
        admin_name: name,
        email,
        merchant_name: school_name,
        businessAddress,
        businessProofDetails,
        authSignatory,
        bankDetails,
        businessCategory,
        business_type,
        businessSubCategory,
        gst,
      } = body;
      businessProofDetails.school_website =
        businessProofDetails.merchant_website;

      if (
        name ||
        !body.phone_number ||
        !body.email ||
        !school_name ||
        school_id
      ) {
        throw new BadRequestException('Fill all fields');
      }

      if (!Object.values(BusinessTypes).includes(business_type)) {
        throw new BadRequestException(`Invalid  Input: ${business_type}`);
      }

      if (!Object.values(KycBusinessCategory).includes(businessCategory)) {
        throw new BadRequestException(`Invalid  Input: ${businessCategory}`);
      }

      if (
        !Object.values(KycBusinessSubCategory).includes(businessSubCategory)
      ) {
        throw new BadRequestException(`Invalid  Input: ${businessSubCategory}`);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[6-9]\d{9}$/;
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
      const aadharRegex = /^[0-9]{12}$/;
      const bankAccountNumberRegex = /^[0-9]{9,18}$/;
      const IFSCRegex = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
      const pinCodeRegex = /^[1-9][0-9]{5}$/;

      if (!emailRegex.test(body.email)) {
        throw new BadRequestException('Invalid email format');
      }

      if (
        !businessCategory ||
        !['Education', 'Others'].includes(businessCategory)
      ) {
        throw new BadRequestException('Invalid input for businessCategory');
      }

      if (!phoneRegex.test(body.phone_number)) {
        throw new BadRequestException('Invalid phone number format');
      }

      // BUSINESS PAN REGEX
      if (
        businessProofDetails &&
        businessProofDetails.business_pan_number &&
        !panRegex.test(businessProofDetails.business_pan_number)
      ) {
        throw new BadRequestException('Invalid Input for business PAN ');
      }

      if (
        businessAddress &&
        businessAddress.pincode &&
        !pinCodeRegex.test(businessAddress.pincode)
      ) {
        throw new BadRequestException(
          'Invalid Input for businessAddress Pin Code',
        );
      }

      if (
        authSignatory &&
        authSignatory.auth_sighnatory_aadhar_number &&
        !aadharRegex.test(authSignatory.auth_sighnatory_aadhar_number)
      ) {
        throw new BadRequestException('Invalid Input for Aaadhar Card number');
      }

      if (
        bankDetails &&
        bankDetails.account_number &&
        !bankAccountNumberRegex.test(bankDetails.account_number)
      ) {
        throw new BadRequestException('Invalid Input for Bank account number');
      }

      if (
        bankDetails &&
        bankDetails.ifsc_code &&
        !IFSCRegex.test(bankDetails.ifsc_code)
      ) {
        throw new BadRequestException('Invalid Input for IFSC Code');
      }

      const school = await this.erpService.createmechant(
        phone_number,
        name,
        email,
        school_name,
        req.userTrustee.id.toString(),
        businessProofDetails,
        businessAddress,
        authSignatory,
        bankDetails,
        businessSubCategory,
        business_type,
        businessCategory,
      );

      // const { school_id } = school.updatedSchool

      // const kycStatus = await this.erpService.initiateKyc(
      //   phone_number,
      //   email,
      //   school_name,
      //   school_id,
      //   businessProofDetails,
      //   businessAddress,
      //   authSignatory,
      //   bankDetails,
      //   businessCategory,
      //   business_type,
      //   businessSubCategory,
      //   gst
      // )

      // return kycStatus

      return school;
    } catch (error) {
      if (error.response && error.response.statusCode === 409) {
        throw new ConflictException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('update-kyc-docs')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFiles(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      merchant_id: string;
      file_type: KycDocType;
      doc_type?: string;
    },
    @Req() req: any,
  ) {
    const { merchant_id, file_type, doc_type } = body;
    const trustee_id = req.userTrustee.id;
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(merchant_id),
      });
      if (!school) {
        throw new NotFoundException('Merchant Not found');
      }

      if (school.trustee_id.toString() !== trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorized User');
      }
      // ✅ Validate that typeName is part of enum
      if (!Object.values(KycDocType).includes(file_type)) {
        throw new BadRequestException(`Invalid document type: ${file_type}`);
      }

      if (
        (file_type === KycDocType.ADDITIONALDOCUMENT && !doc_type) ||
        doc_type == ''
      ) {
        throw new BadRequestException(
          'Invalid Doc type for additional Documents',
        );
      }
      // console.log(file);

      const buffer = file.buffer;
      const fieldname = file.fieldname;
      const originalname = file.originalname;
      const base64String = buffer.toString('base64');
      const fileType = this.S3BucketService.getFileTypeFromBase64(base64String);

      const link = await this.S3BucketService.uploadToS3(
        buffer,
        `${merchant_id}_${fieldname}_${originalname}`,
        fileType,
        'pg-kyc',
      );
      console.log(link);

      // return {link}
      const token = this.jwtService.sign(
        { school_id: merchant_id },
        { secret: process.env.JWT_SECRET_FOR_INTRANET! },
      );
      const config = {
        method: 'post',
        url: `${process.env.MAIN_BACKEND_URL}/api/trustee/upload-docs`,
        headers: {
          accept: 'application/json',
        },
        data: {
          token,
          typeName: file_type,
          url: link,
          additionalFileType: doc_type || null,
        },
      };

      const { data: res } = await axios.request(config);
      return res;
    } catch (error) {
      console.error('Upload failed:', error?.response?.data || error.message);
      throw error;
    }
  }

  /*
  Settlement reconcilation,
  take settlement date and return all transactions and refund under that settlements
  Settlement Date --> get UTR (according to Gateway) -->pass to gateway API
  */

  @Post('/settlements-recon')
  @UseGuards(ErpGuard)
  async settlementRecon(
    @Body()
    body: {
      school_id: string;
      sign: string;
      settlement_date: string;
      limit: number;
      cursor?: string;
      utr?: string;
    },
  ) {
    try {
      const { school_id, sign, settlement_date, cursor, utr, limit } = body;

      if (!school_id || !sign || !settlement_date) {
        throw new BadRequestException('Required Parameter missing');
      }

      const settlemt_date = settlement_date;

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('school not found');
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.school_id !== school_id ||
        decoded.settlement_date !== settlement_date
      ) {
        throw new ForbiddenException('request forged');
      }
      // Start of day in UTC
      const settlementStartDate = new Date(
        Date.UTC(
          Number(settlemt_date.split('-')[0]), // year
          Number(settlemt_date.split('-')[1]) - 1, // month (0-indexed)
          Number(settlemt_date.split('-')[2]), // day
          0,
          0,
          0,
          0,
        ),
      );

      // End of day in UTC
      const settlementEndDate = new Date(
        Date.UTC(
          Number(settlemt_date.split('-')[0]),
          Number(settlemt_date.split('-')[1]) - 1,
          Number(settlemt_date.split('-')[2]),
          23,
          59,
          59,
          999,
        ),
      );

      const settlements = await this.settlementModel.find({
        settlementDate: { $gte: settlementStartDate, $lte: settlementEndDate },
        schoolId: new Types.ObjectId(school_id),
      });
      console.log(settlements, 'settlements');

      if (settlements.length === 0) {
        throw new BadRequestException('No Settlement Found for this Date');
      }

      let response: any[] = [];

      for (const settlementInfo of settlements) {
        const {
          utrNumber,
          fromDate,
          tillDate,
          settlementDate,
          schoolId,
          settlementAmount,
          adjustment,
          settlementInitiatedOn,
          clientId,
        } = settlementInfo;

        const gateway: String =
          await this.erpService.getSettlementGateway(settlementInfo);

        const settlementsRecon: any = {
          utrNumber,
          fromDate,
          tillDate,
          settlement_date: settlementDate,
          school_id: schoolId,
          settlementAmount,
          adjustment,
          settlement_initiated_on: settlementInitiatedOn,
          transactions: [],
          refunds: [],
        };

        const transactionsRecon: any[] = [];
        const refundsRecon: any[] = [];
        if (gateway === 'CASHFREE') {
          console.log('Cashfree settlements');

          const token = this.jwtService.sign(
            { utrNumber, client_id: clientId },
            { secret: process.env.PAYMENTS_SERVICE_SECRET },
          );

          const paginationData = { cursor, limit: 1000 };
          const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/settlements-transactions?token=${token}&utr=${utrNumber}&client_id=${clientId}`,
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            data: paginationData,
          };

          let settlements_transactions: any[] = [];
          try {
            const { data } = await axios.request(config);
            settlements_transactions = data.settlements_transactions || [];
          } catch (err) {
            console.error('Error fetching transactions:', err);
            settlements_transactions = [];
          }

          for (const tx of settlements_transactions) {
            if (tx.event_type === 'PAYMENT') {
              let additional_fields = null;
              try {
                additional_fields =
                  JSON.parse(tx.additional_data)?.additional_fields || null;
              } catch (err) {
                additional_fields = null;
              }

              transactionsRecon.push({
                order_amount: tx.order_amount,
                transaction_amount: tx.event_amount,
                settlement_amount: tx.event_settlement_amount,
                collect_id: tx.order_id,
                custom_order_id: tx.custom_order_id,
                transaction_time: tx.event_time,
                order_time: tx.order_time,
                bank_ref: tx.payment_utr, // Fixed typo
                payment_mode: tx.payment_group, // Fixed typo
                payment_details: tx.payment_details,
                status: tx.event_status,
                additional_data: additional_fields,
                payment_id: tx.payment_id,
                student_details: {
                  student_id: tx.student_id,
                  student_name: tx.student_name,
                  student_email: tx.student_email,
                  student_phone_no: tx.student_phone_no,
                },
                split_info: tx.split,
              });
            }

            if (tx.event_type === 'REFUND') {
              const refundInfo = await this.trusteeService.getRefundInfo(
                tx.order_id,
                schoolId.toString(),
              );
              if (!refundInfo || refundInfo.length === 0) continue;

              for (const refund of refundInfo) {
                refundsRecon.push({
                  refund_id: refund._id,
                  collect_id: refund.order_id,
                  custom_order_id: tx.custom_order_id,
                  refund_amount: refund.refund_amount,
                  order_amount: refund.order_amount,
                  split_refund_details: refund.split_refund_details,
                });
              }
            }
          }

          settlementsRecon.transactions = transactionsRecon;
          settlementsRecon.refunds = refundsRecon;
        }
        if (gateway === 'EASEBUZZ') {
          console.log('Easebuzz');

          if (
            school.isEasebuzzNonPartner &&
            !school.easebuzz_non_partner?.easebuzz_key &&
            !school.easebuzz_non_partner?.easebuzz_salt &&
            !school.easebuzz_non_partner?.easebuzz_submerchant_id
          ) {
            return;
          }

          const previousSettlementDate2 =
            settlementInfo.settlementDate.toISOString();
          const tempPrev = previousSettlementDate2.split('T')[0];
          const partsPrev = tempPrev.split('-');
          const formattedPrev = `${partsPrev[2]}-${partsPrev[1]}-${partsPrev[0]}`;
          // e.g. 06-09-2025

          const end = new Date(settlementInfo.settlementDate); // clone instead of referencing
          end.setDate(end.getDate() + 2);

          // console.log(settlementsRecon, 'settlementsRecon');
          const endSettlementDate = end.toISOString();
          const tempEnd = endSettlementDate.split('T')[0];
          const partsEnd = tempEnd.split('-');
          const formattedEnd = `${partsEnd[2]}-${partsEnd[1]}-${partsEnd[0]}`;
          // e.g. 06-09-2025
          const paginatioNPage = 1;
          const tokenPayload = {
            submerchant_id: school.easebuzz_non_partner.easebuzz_submerchant_id,
          };

          const token = await this.jwtService.sign(tokenPayload, {
            secret: process.env.PAYMENTS_SERVICE_SECRET,
          });
          const data = {
            submerchant_id: school.easebuzz_non_partner.easebuzz_submerchant_id,
            easebuzz_key: school.easebuzz_non_partner.easebuzz_key,
            easebuzz_salt: school.easebuzz_non_partner.easebuzz_salt,
            start_date: formattedPrev,
            end_date: formattedEnd,
            page_size: 1000,
            token,
            utr: settlementInfo.utrNumber,
          };

          const config = {
            method: 'post',
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/settlement-recon/v2`,
            headers: {
              'Content-Type': 'application/json',
              accept: 'application/json',
            },
            data,
          };

          const { data: ezbres } = await axios.request(config);
          for (const tx of ezbres.transactions) {
            let additional_fields = null;
            try {
              additional_fields =
                JSON.parse(tx.additional_data)?.additional_fields || null;
            } catch (err) {
              additional_fields = null;
            }
            transactionsRecon.push({
              order_amount: tx.order_amount,
              transaction_amount: tx.event_amount,
              settlement_amount: tx.event_settlement_amount,
              collect_id: tx.order_id,
              custom_order_id: tx.custom_order_id,
              transaction_time: tx.event_time,
              order_time: tx.order_time,
              bank_ref: tx.payment_utr, // Fixed typo
              payment_mode: tx.payment_group, // Fixed typo
              payment_details: tx.payment_details,
              status: tx.event_status,
              additional_data: additional_fields,
              payment_id: tx.payment_id,
              student_details: {
                student_id: tx.student_id,
                student_name: tx.student_name,
                student_email: tx.student_email,
                student_phone_no: tx.student_phone_no,
              },
              split_info: tx.split,
            });
          }

          // transactionsRecon.push(ezbres)
          settlementsRecon.transactions = transactionsRecon;
          settlementsRecon.refunds = refundsRecon;
        }
        if (gateway === 'RAZORPAY') {
          const razropay_secret = school?.razorpay?.razorpay_secret;
          const razorpay_id = settlementInfo.razorpay_id;
          const transactions =
            await this.trusteeService.getRazorpayTransactionForSettlement(
              utrNumber,
              razorpay_id,
              razropay_secret,
              1000,
              cursor,
              0,
              settlementInfo.fromDate,
            );

          // transactionsRecon.push(transactions.settlements_transactions)
          for (const tx of transactions.settlements_transactions) {
            let additional_fields = null;
            try {
              additional_fields =
                JSON.parse(tx.additional_data)?.additional_fields || null;
            } catch (err) {
              additional_fields = null;
            }

            transactionsRecon.push({
              order_amount: tx.order_amount,
              transaction_amount: tx.event_amount,
              settlement_amount: tx.event_settlement_amount,
              collect_id: tx.order_id,
              custom_order_id: tx.custom_order_id,
              transaction_time: tx.event_time,
              order_time: tx.order_time || null,
              bank_ref: tx.payment_utr,
              payment_mode: tx.payment_group,
              payment_details: tx.payment_details,
              status: tx.event_status,
              additional_data: additional_fields,
              payment_id: tx.entity_id,
              student_details: {
                student_id: tx.student_id,
                student_name: tx.student_name,
                student_email: tx.student_email,
                student_phone_no: tx.student_phone_no,
              },
              split_info: tx.split || [],
            });
            // transactionsRecon.push(transactionsRecon)
          }
          settlementsRecon.transactions = transactionsRecon;
        }
        // console.log({dste:settlementInfo.settlementDate});

        settlementsRecon.settlement_date = settlementInfo.settlementDate;
        response.push(settlementsRecon);
      }

      return response;
    } catch (e) {
      console.log(e);
      throw new BadRequestException(e.message);
    }
  }

  @Post('/import-school-base-mdr')
  async importData(@Body() body: { school_ids: string[]; trustee_id: string }) {
    try {
      const { school_ids, trustee_id } = body;
      if (!trustee_id) {
        throw new BadRequestException('Trustee id missing');
      }
      if (!school_ids || school_ids.length === 0) {
        throw new BadRequestException('Invalid School ids');
      }

      await Promise.all(
        school_ids.map(async (id) => {
          await this.importSchoolbase(trustee_id, id);
        }),
      );

      return school_ids;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  async importSchoolbase(trustee_id: string, school_id: string) {
    try {
      const trusteeBase = await this.baseMdrModel.findOne({
        trustee_id: new Types.ObjectId(trustee_id),
      });
      if (!trusteeBase) {
        throw new BadRequestException('Trustee base not found');
      }
      await this.SchoolBaseMdrModel.findOneAndUpdate(
        {
          trustee_id: new Types.ObjectId(trustee_id),
          school_id: new Types.ObjectId(school_id),
        },
        {
          $set: {
            trustee_id: new Types.ObjectId(trustee_id),
            school_id: new Types.ObjectId(school_id),
            platform_charges: trusteeBase.platform_charges,
          },
        },
        {
          upsert: true,
          new: true,
        },
      );

      return 'data updated';
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Post('login-link')
  async getLoginLink(@Body() body: { trustee_ids: string[] }) {
    const { trustee_ids } = body;
    try {
      let login_links: any = [];
      let invalid: any = [];
      for (const trustee_id of trustee_ids) {
        const trustee = await this.trusteeModel.findById(trustee_id);
        if (!trustee) {
          invalid.push(trustee_id);
          return;
        }
        const payload = {
          id: trustee_id,
          role: 'owner',
        };

        const token = jwt.sign(
          payload,
          process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
          {
            expiresIn: '30d',
          },
        );
        const url = `https://partner.edviron.com/admin?token=${token}`;
        login_links.push({
          name: trustee.name,
          login: url,
        });
      }

      return login_links;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('/initiate-seamless/v2')
  async initSeamlessV2(
    @Body()
    body: {
      school_id: string;
      sign: string;
      mode: PaymentMode;
      collect_id: string;
      amount: number;
      net_banking?: {
        bank_code: EasebuzzBankCode;
      };
      wallet: {
        bank_code: EasebuzzWallets;
      };
      pay_later: {
        bank_code: EasebuzzPayLater;
      };
      upi: {
        mode: UpiModes;
        vpa: string;
      };
      card: {
        enc_card_number: string;
        enc_card_holder_name: string;
        enc_card_cvv: string;
        enc_card_expiry_date: string;
      };
    },
    @Res() res: any,
    @Req() req: any,
  ) {
    try {
      const {
        school_id,
        sign,
        mode,
        amount,
        collect_id,
        net_banking,
        wallet,
        pay_later,
        card,
        upi,
      } = body;
      const trustee_id = req.userTrustee.id;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School Not Found');
      }
      if (trustee_id.toString() !== school.trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorize User');
      }
      if (!school.pg_key) {
        throw new BadRequestException(
          'PG is not Active for your Merchant kindly contact tarun.k@edviron.com',
        );
      }
      const decoded: any = jwt.verify(sign, school.pg_key);
      if (
        decoded.school_id !== school_id ||
        decoded.mode !== mode ||
        decoded.collect_id
      ) {
        throw new BadRequestException('Request Fordge || Invaid Sign');
      }

      if (!Object.values(PaymentMode).includes(mode)) {
        throw new BadRequestException('Invalid Payment Mode');
      }

      if (
        mode === 'NB' &&
        !Object.values(EasebuzzBankCode).includes(net_banking?.bank_code)
      ) {
        throw new BadRequestException('Invalid Input for bank code');
      }

      if (!Object.values(PaymentMode).includes(mode)) {
        throw new BadRequestException('Invalid Payment Mode');
      }

      if (
        mode === PaymentMode.WALLET &&
        !Object.values(EasebuzzWallets).includes(wallet?.bank_code)
      ) {
        throw new BadRequestException('Invalid Wallet Code');
      }

      if (
        mode == PaymentMode.PAY_LATER &&
        !Object.values(EasebuzzPayLater).includes(pay_later?.bank_code)
      ) {
        throw new BadRequestException('Invalid Pay_Later Code');
      }

      if (
        mode == PaymentMode.UPI &&
        !Object.values(UpiModes).includes(upi?.mode)
      ) {
        throw new BadRequestException('Invalid mode for UPI');
      }

      if (!Object.values(PaymentMode).includes(mode)) {
        throw new BadRequestException('Invalid Payment Mode');
      }

      if (
        mode === 'NB' &&
        Object.values(EasebuzzBankCode).includes(net_banking?.bank_code)
      ) {
        if (!Object.values(EasebuzzBankCode).includes(net_banking?.bank_code)) {
          throw new BadRequestException('Invalid Input for bank code');
        }
      }

      if (
        mode === PaymentMode.WALLET &&
        !Object.values(EasebuzzWallets).includes(wallet.bank_code)
      ) {
        throw new BadRequestException('Invalid Wallet Code');
      }

      if (
        mode == PaymentMode.PAY_LATER &&
        !Object.values(EasebuzzPayLater).includes(pay_later?.bank_code)
      ) {
        throw new BadRequestException('Invalid Pay_Later Code');
      }

      const token = jwt.sign(
        { school_id, amount },
        process.env.JWT_SECRET_FOR_API_KEY,
      );
      const data = {
        school_id,
        trustee_id,
        token,
        mode,
        collect_id,
        amount,
        net_banking: { bank_code: net_banking?.bank_code },
        card: {
          enc_card_number: card?.enc_card_number,
          enc_card_holder_name: card?.enc_card_holder_name,
          enc_card_cvv: card?.enc_card_cvv,
          enc_card_expiry_date: card?.enc_card_expiry_date,
        },
        wallet,
        pay_later,
        upi,
      };

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-seamless/initiate-payment`,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data,
      };
      const { data: paymentRes } = await axios.request(config);
      const responseUrl = paymentRes.url;
      if (mode === 'UPI') {
        if (upi?.mode == UpiModes.QR) {
          return res.send(paymentRes);
        } else if (upi.mode === UpiModes.VPA) {
          return res.redirect(responseUrl);
        }
      }
      return res.redirect(responseUrl);
    } catch (e) {
      console.log(e);
      if (e.response?.data?.message) {
        throw new BadRequestException(e.response?.data?.message);
      }
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(ErpGuard)
  @Post('/initiate-seamless')
  async initSeamless(
    @Body()
    body: {
      school_id: string;
      sign: string;
      mode: PaymentMode;
      collect_id: string;
      amount: number;
      net_banking?: {
        bank_code: EasebuzzBankCode;
      };
      wallet: {
        bank_code: EasebuzzWallets;
      };
      pay_later: {
        bank_code: EasebuzzPayLater;
      };
      upi: {
        mode: UpiModes;
        vpa: string;
      };
      card: {
        enc_card_number: string;
        enc_card_holder_name: string;
        enc_card_cvv: string;
        enc_card_expiry_date: string;
      };
    },
    @Res() res: any,
    @Req() req: any,
  ) {
    try {
      const {
        school_id,
        sign,
        mode,
        amount,
        collect_id,
        net_banking,
        wallet,
        pay_later,
        card,
        upi,
      } = body;
      const trustee_id = req.userTrustee.id;
      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School Not Found');
      }
      if (trustee_id.toString() !== school.trustee_id.toString()) {
        throw new UnauthorizedException('Unauthorize User');
      }
      if (!school.pg_key) {
        throw new BadRequestException(
          'PG is not Active for your Merchant kindly contact tarun.k@edviron.com',
        );
      }
      const decoded: any = jwt.verify(sign, school.pg_key);
      if (
        decoded.school_id !== school_id ||
        decoded.mode !== mode ||
        decoded.collect_id
      ) {
        throw new BadRequestException('Request Fordge || Invaid Sign');
      }

      if (!Object.values(PaymentMode).includes(mode)) {
        throw new BadRequestException('Invalid Payment Mode');
      }

      if (
        mode === 'NB' &&
        !Object.values(EasebuzzBankCode).includes(net_banking?.bank_code)
      ) {
        throw new BadRequestException('Invalid Input for bank code');
      }

      if (!Object.values(PaymentMode).includes(mode)) {
        throw new BadRequestException('Invalid Payment Mode');
      }

      if (
        mode === PaymentMode.WALLET &&
        !Object.values(EasebuzzWallets).includes(wallet?.bank_code)
      ) {
        throw new BadRequestException('Invalid Wallet Code');
      }

      if (
        mode == PaymentMode.PAY_LATER &&
        !Object.values(EasebuzzPayLater).includes(pay_later?.bank_code)
      ) {
        throw new BadRequestException('Invalid Pay_Later Code');
      }

      if (
        mode == PaymentMode.UPI &&
        !Object.values(UpiModes).includes(upi?.mode)
      ) {
        throw new BadRequestException('Invalid mode for UPI');
      }

      if (!Object.values(PaymentMode).includes(mode)) {
        throw new BadRequestException('Invalid Payment Mode');
      }

      if (
        mode === 'NB' &&
        Object.values(EasebuzzBankCode).includes(net_banking?.bank_code)
      ) {
        if (!Object.values(EasebuzzBankCode).includes(net_banking?.bank_code)) {
          throw new BadRequestException('Invalid Input for bank code');
        }
      }

      if (
        mode === PaymentMode.WALLET &&
        !Object.values(EasebuzzWallets).includes(wallet.bank_code)
      ) {
        throw new BadRequestException('Invalid Wallet Code');
      }

      if (
        mode == PaymentMode.PAY_LATER &&
        !Object.values(EasebuzzPayLater).includes(pay_later?.bank_code)
      ) {
        throw new BadRequestException('Invalid Pay_Later Code');
      }

      const token = jwt.sign(
        { school_id, amount },
        process.env.JWT_SECRET_FOR_API_KEY,
      );
      const data = {
        school_id,
        trustee_id,
        token,
        mode,
        collect_id,
        amount,
        net_banking: { bank_code: net_banking?.bank_code },
        card: {
          enc_card_number: card?.enc_card_number,
          enc_card_holder_name: card?.enc_card_holder_name,
          enc_card_cvv: card?.enc_card_cvv,
          enc_card_expiry_date: card?.enc_card_expiry_date,
        },
        wallet,
        pay_later,
        upi,
      };

      const config = {
        method: 'post',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-seamless/initiate-payment`,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data,
      };
      const { data: paymentRes } = await axios.request(config);
      const responseUrl = paymentRes.url;
      if (mode === 'UPI') {
        if (upi?.mode == UpiModes.QR) {
          return res.send(paymentRes);
        } else if (upi.mode === UpiModes.VPA) {
          return res.send(paymentRes);
        }
      }
      return res.send(paymentRes);
    } catch (e) {
      console.log(e);
      if (e.response?.data?.message) {
        throw new BadRequestException(e.response?.data?.message);
      }
      throw new BadRequestException(e.message);
    }
  }

  @Post('/settlements-recon/v2')
  @UseGuards(ErpGuard)
  async settlementReconV2(
    @Body()
    body: {
      school_id: string;
      sign: string;
      settlement_date: string;
      limit: number;
      cursor?: string;
      utr?: string;
    },
  ) {
    try {
      const { school_id, sign, settlement_date, cursor, utr, limit } = body;

      if (!school_id || !sign || !settlement_date) {
        throw new BadRequestException('Required Parameter missing');
      }

      const settlemt_date = settlement_date;

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new NotFoundException('school not found');
      }

      const decoded = this.jwtService.verify(sign, { secret: school.pg_key });
      if (
        decoded.school_id !== school_id ||
        decoded.settlement_date !== settlement_date
      ) {
        throw new ForbiddenException('request forged');
      }
      // Start of day in UTC
      const settlementStartDate = new Date(
        Date.UTC(
          Number(settlemt_date.split('-')[0]), // year
          Number(settlemt_date.split('-')[1]) - 1, // month (0-indexed)
          Number(settlemt_date.split('-')[2]), // day
          0,
          0,
          0,
          0,
        ),
      );

      // End of day in UTC
      const settlementEndDate = new Date(
        Date.UTC(
          Number(settlemt_date.split('-')[0]),
          Number(settlemt_date.split('-')[1]) - 1,
          Number(settlemt_date.split('-')[2]),
          23,
          59,
          59,
          999,
        ),
      );

      const settlements = await this.settlementModel.find({
        settlementDate: { $gte: settlementStartDate, $lte: settlementEndDate },
        schoolId: new Types.ObjectId(school_id),
      });
      if (settlements.length === 0) {
        throw new BadRequestException('No Settlement Found for this Date');
      }

      let response: any[] = [];

      for (const settlementInfo of settlements) {
        const {
          utrNumber,
          fromDate,
          tillDate,
          settlementDate,
          schoolId,
          settlementAmount,
          adjustment,
          settlementInitiatedOn,
          clientId,
        } = settlementInfo;

        let gateway: String =
          await this.erpService.getSettlementGateway(settlementInfo);
        if (school.easebuzz_id) {
          gateway = 'EDVIRON_EASEBUZZ_PARTNER';
        }
        console.log(gateway);

        const settlementsRecon: any = {
          utrNumber,
          fromDate,
          tillDate,
          settlement_date: settlementDate,
          school_id: schoolId,
          settlementAmount,
          adjustment,
          settlement_initiated_on: settlementInitiatedOn,
          transactions: [],
          refunds: [],
        };

        const transactionsRecon: any[] = [];
        const refundsRecon: any[] = [];
        if (gateway === 'CASHFREE') {
          console.log('Cashfree settlements');

          const token = this.jwtService.sign(
            { utrNumber, client_id: clientId },
            { secret: process.env.PAYMENTS_SERVICE_SECRET },
          );

          const paginationData = { cursor, limit: 1000 };
          const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/cashfree/settlements-transactions?token=${token}&utr=${utrNumber}&client_id=${clientId}`,
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            data: paginationData,
          };

          let settlements_transactions: any[] = [];
          try {
            const { data } = await axios.request(config);
            settlements_transactions = data.settlements_transactions || [];
          } catch (err) {
            console.error('Error fetching transactions:', err);
            settlements_transactions = [];
          }

          for (const tx of settlements_transactions) {
            if (tx.event_type === 'PAYMENT') {
              let additional_fields = null;
              try {
                additional_fields =
                  JSON.parse(tx.additional_data)?.additional_fields || null;
              } catch (err) {
                additional_fields = null;
              }

              transactionsRecon.push({
                order_amount: tx.order_amount,
                transaction_amount: tx.event_amount,
                settlement_amount: tx.event_settlement_amount,
                collect_id: tx.order_id,
                custom_order_id: tx.custom_order_id,
                transaction_time: tx.event_time,
                order_time: tx.order_time,
                bank_ref: tx.payment_utr, // Fixed typo
                payment_mode: tx.payment_group, // Fixed typo
                payment_details: tx.payment_details,
                status: tx.event_status,
                additional_data: additional_fields,
                payment_id: tx.payment_id,
                student_details: {
                  student_id: tx.student_id,
                  student_name: tx.student_name,
                  student_email: tx.student_email,
                  student_phone_no: tx.student_phone_no,
                },
                split_info: tx.split,
              });
            }

            if (tx.event_type === 'REFUND') {
              const refundInfo = await this.trusteeService.getRefundInfo(
                tx.order_id,
                schoolId.toString(),
              );
              if (!refundInfo || refundInfo.length === 0) continue;

              for (const refund of refundInfo) {
                refundsRecon.push({
                  refund_id: refund._id,
                  collect_id: refund.order_id,
                  custom_order_id: tx.custom_order_id,
                  refund_amount: refund.refund_amount,
                  order_amount: refund.order_amount,
                  split_refund_details: refund.split_refund_details,
                });
              }
            }
          }

          settlementsRecon.transactions = transactionsRecon;
          settlementsRecon.refunds = refundsRecon;
        }
        if (gateway === 'EASEBUZZ') {
          console.log('Easebuzz');

          if (
            school.isEasebuzzNonPartner &&
            !school.easebuzz_non_partner?.easebuzz_key &&
            !school.easebuzz_non_partner?.easebuzz_salt &&
            !school.easebuzz_non_partner?.easebuzz_submerchant_id
          ) {
            return;
          }

          const previousSettlementDate2 =
            settlementInfo.settlementDate.toISOString();
          const tempPrev = previousSettlementDate2.split('T')[0];
          const partsPrev = tempPrev.split('-');
          const formattedPrev = `${partsPrev[2]}-${partsPrev[1]}-${partsPrev[0]}`;
          // e.g. 06-09-2025

          const end = new Date(settlementInfo.settlementDate); // clone instead of referencing
          end.setDate(end.getDate() + 2);

          // console.log(settlementsRecon, 'settlementsRecon');
          const endSettlementDate = end.toISOString();
          const tempEnd = endSettlementDate.split('T')[0];
          const partsEnd = tempEnd.split('-');
          const formattedEnd = `${partsEnd[2]}-${partsEnd[1]}-${partsEnd[0]}`;
          // e.g. 06-09-2025
          const paginatioNPage = 1;
          const tokenPayload = {
            submerchant_id: school.easebuzz_non_partner.easebuzz_submerchant_id,
          };

          const token = await this.jwtService.sign(tokenPayload, {
            secret: process.env.PAYMENTS_SERVICE_SECRET,
          });
          const data = {
            submerchant_id: school.easebuzz_non_partner.easebuzz_submerchant_id,
            easebuzz_key: school.easebuzz_non_partner.easebuzz_key,
            easebuzz_salt: school.easebuzz_non_partner.easebuzz_salt,
            start_date: formattedPrev,
            end_date: formattedEnd,
            page_size: 1000,
            token,
            utr: settlementInfo.utrNumber,
          };

          const config = {
            method: 'post',
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/settlement-recon/v3`,
            headers: {
              'Content-Type': 'application/json',
              accept: 'application/json',
            },
            data,
          };

          const { data: ezbres } = await axios.request(config);
          for (const tx of ezbres.transactions) {
            let additional_fields = null;
            try {
              additional_fields =
                JSON.parse(tx.additional_data)?.additional_fields || null;
            } catch (err) {
              additional_fields = null;
            }
            transactionsRecon.push({
              order_amount: tx.order_amount,
              transaction_amount: tx.event_amount,
              settlement_amount: tx.event_settlement_amount,
              collect_id: tx.order_id,
              custom_order_id: tx.custom_order_id,
              transaction_time: tx.event_time,
              order_time: tx.order_time,
              bank_ref: tx.payment_utr, // Fixed typo
              payment_mode: tx.payment_group, // Fixed typo
              payment_details: tx.payment_details,
              status: tx.event_status,
              additional_data: additional_fields,
              payment_id: tx.payment_id,
              student_details: {
                student_id: tx.student_id,
                student_name: tx.student_name,
                student_email: tx.student_email,
                student_phone_no: tx.student_phone_no,
              },
              split_info: tx.split,
            });
          }

          // transactionsRecon.push(ezbres)
          settlementsRecon.transactions = transactionsRecon;
          settlementsRecon.refunds = refundsRecon;
        }
        if (gateway === 'RAZORPAY') {
          const razropay_secret = school?.razorpay?.razorpay_secret;
          const razorpay_id = settlementInfo.razorpay_id;
          const transactions =
            await this.trusteeService.getRazorpayTransactionForSettlement(
              utrNumber,
              razorpay_id,
              razropay_secret,
              1000,
              cursor,
              0,
              settlementInfo.fromDate,
            );

          // transactionsRecon.push(transactions.settlements_transactions)
          for (const tx of transactions.settlements_transactions) {
            let additional_fields = null;
            try {
              additional_fields =
                JSON.parse(tx.additional_data)?.additional_fields || null;
            } catch (err) {
              additional_fields = null;
            }

            transactionsRecon.push({
              order_amount: tx.order_amount,
              transaction_amount: tx.event_amount,
              settlement_amount: tx.event_settlement_amount,
              collect_id: tx.order_id,
              custom_order_id: tx.custom_order_id,
              transaction_time: tx.event_time,
              order_time: tx.order_time || null,
              bank_ref: tx.payment_utr,
              payment_mode: tx.payment_group,
              payment_details: tx.payment_details,
              status: tx.event_status,
              additional_data: additional_fields,
              payment_id: tx.entity_id,
              student_details: {
                student_id: tx.student_id,
                student_name: tx.student_name,
                student_email: tx.student_email,
                student_phone_no: tx.student_phone_no,
              },
              split_info: tx.split || [],
            });
            // transactionsRecon.push(transactionsRecon)
          }
          settlementsRecon.transactions = transactionsRecon;
        }
        if (gateway === 'EDVIRON_EASEBUZZ_PARTNER') {
          console.log('Easebuzz Partner');

          const previousSettlementDate2 =
            settlementInfo.settlementDate.toISOString();
          const tempPrev = previousSettlementDate2.split('T')[0];
          const partsPrev = tempPrev.split('-');
          const formattedPrev = `${partsPrev[2]}-${partsPrev[1]}-${partsPrev[0]}`;
          // e.g. 06-09-2025

          const end = new Date(settlementInfo.settlementDate); // clone instead of referencing
          end.setDate(end.getDate() + 2);

          // console.log(settlementsRecon, 'settlementsRecon');
          const endSettlementDate = end.toISOString();
          const tempEnd = endSettlementDate.split('T')[0];
          const partsEnd = tempEnd.split('-');
          const formattedEnd = `${partsEnd[2]}-${partsEnd[1]}-${partsEnd[0]}`;
          // e.g. 06-09-2025
          const paginatioNPage = 1;
          const tokenPayload = {
            submerchant_id: school.easebuzz_id,
          };

          const token = await this.jwtService.sign(tokenPayload, {
            secret: process.env.PAYMENTS_SERVICE_SECRET,
          });
          const data = {
            submerchant_id: school.easebuzz_id,
            easebuzz_key: school.easebuzz_non_partner?.easebuzz_key || 'NA',
            easebuzz_salt: school.easebuzz_non_partner?.easebuzz_salt || 'NA',
            start_date: formattedPrev,
            end_date: formattedEnd,
            page_size: 1000,
            token,
            utr: settlementInfo.utrNumber,
          };

          const config = {
            method: 'post',
            url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/easebuzz/settlement-recon/v3`,
            headers: {
              'Content-Type': 'application/json',
              accept: 'application/json',
            },
            data,
          };

          const { data: ezbres } = await axios.request(config);

          for (const tx of ezbres.transactions) {
            let additional_fields = null;
            try {
              additional_fields =
                JSON.parse(tx.additional_data)?.additional_fields || null;
            } catch (err) {
              additional_fields = null;
            }
            transactionsRecon.push({
              order_amount: tx.order_amount,
              transaction_amount: tx.event_amount,
              settlement_amount: tx.event_settlement_amount,
              collect_id: tx.order_id,
              custom_order_id: tx.custom_order_id,
              transaction_time: tx.event_time,
              order_time: tx.order_time,
              bank_ref: tx.payment_utr, // Fixed typo
              payment_mode: tx.payment_group, // Fixed typo
              payment_details: tx.payment_details,
              status: tx.event_status,
              additional_data: additional_fields,
              payment_id: tx.payment_id,
              student_details: {
                student_id: tx.student_id,
                student_name: tx.student_name,
                student_email: tx.student_email,
                student_phone_no: tx.student_phone_no,
              },
              split_info: tx.split,
            });
          }

          // transactionsRecon.push(ezbres)
          settlementsRecon.transactions = transactionsRecon;
          settlementsRecon.refunds = refundsRecon;
        }
        // console.log({dste:settlementInfo.settlementDate});

        settlementsRecon.settlement_date = settlementInfo.settlementDate;
        response.push(settlementsRecon);
      }

      return response;
    } catch (e) {
      console.log(e);
      throw new BadRequestException(e.message);
    }
  }

  @Post('update-pg-credentials')
  async updatePg(
    @Body()
    body: {
      school_id: string;
      gateway: GATEWAY;
      pg_key?: string;
      cashfree?: {
        client_id: string;
      };
      easebuzz?: {
        easebuzz_key: string;
        easebuzz_salt: string;
        easebuzz_submerchant_id: string;
        easebuzz_email: string;
      };
      razorpay?: {
        razorpay_key_id: string;
        razorpay_secret: string;
        razorpay_mid: string;
        razorpay_account: string;
        seamless: boolean; // if true insert in razorpay_seamless else in razorpay
      };
    },
  ) {
    try {
      const { school_id, gateway, pg_key, cashfree, easebuzz, razorpay } = body;

      if (!school_id || !gateway) {
        throw new BadRequestException('school_id and gateway are required');
      }

      const school = await this.trusteeSchoolModel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) {
        throw new BadRequestException('School not found');
      }

      if (!school.pg_key && !pg_key) {
        throw new BadRequestException(
          'Pg Key is required for first-time setup',
        );
      }
      if (pg_key && school.pg_key) {
        throw new BadRequestException('Pg Key Already Exists');
      }
      // update object to hold changes
      const updateData: any = {};
      if (pg_key) updateData.pg_key = pg_key;

      switch (gateway) {
        case GATEWAY.CASHFREE:
          if (!cashfree?.client_id) {
            throw new BadRequestException('Cashfree client_id is required');
          }
          updateData.client_id = cashfree.client_id;
          updateData.client_secret = '0';
          break;

        case GATEWAY.EASEBUZZ:
          if (
            !easebuzz?.easebuzz_key ||
            !easebuzz?.easebuzz_salt ||
            !easebuzz?.easebuzz_submerchant_id ||
            !easebuzz?.easebuzz_email
          ) {
            throw new BadRequestException(
              'Easebuzz fields missing — require easebuzz_key, easebuzz_salt, easebuzz_submerchant_id, easebuzz_email',
            );
          }

          updateData.easebuzz_non_partner = {
            easebuzz_key: easebuzz.easebuzz_key,
            easebuzz_salt: easebuzz.easebuzz_salt,
            easebuzz_submerchant_id: easebuzz.easebuzz_submerchant_id,
            easebuzz_merchant_email: easebuzz.easebuzz_email,
          };
          updateData.isEasebuzzNonPartner = true;
          break;

        case GATEWAY.RAZORPAY:
          if (
            !razorpay?.razorpay_key_id ||
            !razorpay?.razorpay_secret ||
            !razorpay?.razorpay_mid ||
            !razorpay?.razorpay_account ||
            razorpay.seamless === undefined ||
            razorpay.seamless === null
          ) {
            throw new BadRequestException(
              'Razorpay fields missing — require razorpay_key_id, razorpay_secret, razorpay_mid, razorpay_account, seamless flag',
            );
          }

          const razorpayPayload = {
            razorpay_key_id: razorpay.razorpay_key_id,
            razorpay_secret: razorpay.razorpay_secret,
            razorpay_mid: razorpay.razorpay_mid,
            razorpay_account: razorpay.razorpay_account,
          };

          if (razorpay.seamless) {
            updateData.razorpay_seamless = razorpayPayload;
          } else {
            updateData.razorpay = razorpayPayload;
          }
          break;

        default:
          throw new BadRequestException('Invalid Gateway');
      }

      const updated = await this.trusteeSchoolModel.findByIdAndUpdate(
        school._id,
        { $set: updateData },
        { new: true },
      );
      if (!updated) {
        throw new BadRequestException('Failed to update PG credentials');
      }
      return {
        success: true,
        message: `${gateway} credentials updated successfully in ${school.school_name}`,
        data: updated,
      };
    } catch (e) {
      console.log(e);
      if (e.response?.data?.message) {
        throw new BadRequestException(e.response?.data?.message);
      }
      throw new BadRequestException(e.message || 'Something went wrong');
    }
  }

  @Post('transaction-report')
  async getTransactionReportt(
    @Body()
    body: {
      school_id: string;
      trustee_id?: string;
      sign?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      page?: string;
      limit?: string;
      isCustomSearch?: boolean;
      isCollectNow?: boolean;
      isQRCode?: boolean;
      searchFilter?: string;
      searchParams?: string;
      payment_modes?: string[];
      gateway?: string[];
    },
  ) {
    let {
      startDate,
      endDate,
      trustee_id,
      sign,
      status,
      school_id,
      page,
      limit,
      isCustomSearch,
      isCollectNow,
      isQRCode,
      searchFilter,
      searchParams,
      payment_modes,
      gateway,
    } = body;
    try {
      console.log(school_id);

      let decoded = this.jwtService.verify(sign, {
        secret: process.env.JWT_SECRET_FOR_TRUSTEE_AUTH,
      });

      if (decoded.id !== trustee_id) {
        throw new BadRequestException('request Fordge');
      }
      let id = trustee_id;
      console.log(id, trustee_id, 'csafds');
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
          isCollectNow,
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
          let additional_data = item.additional_data || '';
          if (additional_data === '') {
            additional_data = {};
          } else {
            additional_data = JSON.parse(item.additional_data);
          }
          // console.log(additional_data);

          return {
            ...item,
            merchant_name:
              merchant_ids_to_merchant_map[item.merchant_id]?.school_name ||
              'NA',
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
            currency: item.currency || 'INR',
            school_id: item.merchant_id,
            school_name:
              merchant_ids_to_merchant_map[item.merchant_id]?.school_name ||
              'NA',
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
      console.log(error, 'response');
      if (error?.response?.data?.message) {
        throw new BadRequestException(error?.response?.data?.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Get('get-trustee-id')
  async getTrusteeId(
    @Query('school_id') school_id : string
  ){
    try {
      const school = await this.trusteeSchoolModel.findOne({
        school_id : new Types.ObjectId(school_id)
      })
      if(!school){
        throw new BadRequestException('school not found')
      } 
      const trustee = await this.trusteeModel.findById(school.trustee_id)

      if(!trustee){
        throw new BadRequestException('trustee not found')
      }

      return {
        trustee_id : trustee._id.toString()
      }
      
    } catch (error) {
      throw new BadRequestException(error.message)
    }
  }
}

export enum chequeStatus {
  SUCCESS = 'SUCCESS',
  BOUNCE = 'BOUNCE',
}
