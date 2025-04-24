import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';
import { refund_status, RefundRequest } from '../schema/refund.schema';
import { TrusteeSchool } from '../schema/school.schema';
import { Trustee } from '../schema/trustee.schema';
import { VendorsSettlement } from '../schema/vendor.settlements.schema';
import { Vendors } from '../schema/vendors.schema';
import { WebhookLogs } from '../schema/webhook.schema';
import axios, { AxiosError } from 'axios';
import * as jwt from 'jsonwebtoken';
import { DisputeGateways, Disputes } from '../schema/disputes.schema';
import { TempSettlementReport } from '../schema/tempSettlements.schema';
import { SettlementReport } from '../schema/settlement.schema';
import { EmailService } from '../email/email.service';
import { generateErrorEmailTemplate } from '../email/templates/error.template';
import { TrusteeService } from '../trustee/trustee.service';
import {
  getAdminEmailTemplate,
  getCustomerEmailTemplate,
} from '../email/templates/dipute.template';
import { PdfService } from '../pdf-service/pdf-service.service';
import { DISPUT_INVOICE_MAIL_GATEWAY } from '../utils/email.group';
import { EmailGroup, EmailGroupType } from '../schema/email.schema';
import { EmailEvent, Events } from '../schema/email.events.schema';
import { string1To1000 } from 'aws-sdk/clients/customerprofiles';

export enum DISPUTES_STATUS {
  DISPUTE_CREATED = 'DISPUTE_CREATED',
  DISPUTE_UPDATED = 'DISPUTE_UPDATED',
  DISPUTE_CLOSED = 'DISPUTE_CLOSED',
}
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @InjectModel(WebhookLogs.name)
    private webhooksLogsModel: mongoose.Model<WebhookLogs>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
    @InjectModel(VendorsSettlement.name)
    private venodrsSettlementmodel: mongoose.Model<VendorsSettlement>,
    @InjectModel(Vendors.name)
    private venodrsModel: mongoose.Model<Vendors>,
    @InjectModel(TrusteeSchool.name)
    private TrusteeSchoolmodel: mongoose.Model<TrusteeSchool>,
    @InjectModel(Trustee.name)
    private TrusteeModel: mongoose.Model<Trustee>,
    @InjectModel(Disputes.name)
    private DisputesModel: mongoose.Model<Disputes>,
    @InjectModel(TempSettlementReport.name)
    private TempSettlementReportModel: mongoose.Model<TempSettlementReport>,
    @InjectModel(SettlementReport.name)
    private SettlementReportModel: mongoose.Model<SettlementReport>,
    @InjectModel(EmailGroup.name)
    private EmailGroupModel: mongoose.Model<EmailGroup>,
    @InjectModel(EmailEvent.name)
    private EmailEventModel: mongoose.Model<EmailEvent>,
    private emailService: EmailService,
    private trusteeService: TrusteeService,
    private readonly pdfService: PdfService,
  ) { }

  demoData = {
    data: {
      settlement: {
        adjustment: 0,
        amount_settled: 366150,
        payment_amount: 366150,
        payment_from: '2024-12-21T02:41:51+05:30',
        payment_till: '2024-12-22T23:57:10+05:30',
        reason: null,
        remarks: null,
        service_charge: 0,
        service_tax: 0,
        settled_on: '2024-12-23T13:52:38+05:30',
        settlement_amount: 366150,
        settlement_charge: 0,
        settlement_id: 111939000,
        settlement_initiated_on: '2024-12-23T13:52:38+05:30',
        settlement_tax: 0,
        settlement_type: 'NORMAL_SETTLEMENT',
        status: 'SUCCESS',
        utr: 'UTIBR72024122300097378',
      },
    },
    event_time: '2024-12-23T13:52:38+05:30',
    merchant: { merchant_id: 'CF_943d6a8b-b575-4418-8fa9-0466b83e9bbd' },
    type: 'SETTLEMENT_SUCCESS',
  };
  @Post('/easebuzz/refund')
  async easebuzzRefundWebhook(@Body() body: any, @Res() res: any) {
    try {
      const data = JSON.parse(body.data);
      const {
        txnid,
        easepayid,
        refund_id,
        refund_amount,
        transaction_date,
        transaction_type,
        merchant_refund_id,
        chargeback_description,
      } = data;

      let collect_id = txnid;
      console.log(data);

      await new this.webhooksLogsModel({
        type: 'Refund Webhook',
        order_id: collect_id || 'ezbcalled',
        status: 'CALLED',
        gateway: 'EASEBUZZ',
        type_id: refund_id,
        body: JSON.stringify(body),
      }).save();

      if (collect_id.startsWith('upi_')) {
        collect_id = collect_id.replace('upi_', '');
      }

      console.log('updated collect id: ' + collect_id);

      const details = JSON.stringify(body.data);
      const easebuzz_refund_status = body.data.refund_status;
      await new this.webhooksLogsModel({
        type: 'Refund Webhook',
        order_id: collect_id,
        gateway: 'EASEBUZZ',
        type_id: refund_id,
        body: details,
        status: 'SUCCESS',
      }).save();

      try {
        const refundRequest =
          await this.refundRequestModel.findById(merchant_refund_id);
        if (!refundRequest) {
          console.log(`Refund request not Found`);
        }
        let status = refund_status.INITIATED;
        if (
          easebuzz_refund_status === 'accepted' ||
          easebuzz_refund_status === 'refunded'
        ) {
          status = refund_status.APPROVED;
        }
        refundRequest.status = status;
        refundRequest.gateway = 'EASEBUZZ';
        refundRequest.gatway_refund_id = refund_id;
        refundRequest.additonalInfo = easebuzz_refund_status;
        await refundRequest.save();

        try {
          const trustee_id = refundRequest.trustee_id;
          const trustee = await this.TrusteeModel.findById(trustee_id);
          if (!trustee) {
            throw new BadRequestException('Trustee not found');
          }
          const refundWebhookUrl = trustee.refund_webhook_url;
          if (!refundWebhookUrl) {
            res.status(200).send('OK');
          }
          const payload = {
            refund_id,
            refund_amount,
            status_description: chargeback_description,
            school_id: refundRequest.school_id.toString(),
            order_id: refundRequest.order_id.toString(),
          };
          const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: refundWebhookUrl,
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            data: payload,
          };
          try {
            const response = await axios.request(config);
            const res = JSON.stringify(response.data) || 'NA';
            await this.webhooksLogsModel.create({
              type: 'ERP_REFUND_WEBHOOK_SUCCESS',
              gateway: 'EAZEBUZZ',
              status: 'SUCCESS',
              res,
              trustee_id: refundRequest.trustee_id,
              school_id: refundRequest.school_id,
            });
          } catch (e) {
            await this.webhooksLogsModel.create({
              type: 'ERP_REFUND_WEBHOOK_ERROR',
              error: e.message,
              status: 'FAILED',
              gateway: 'EAZEBUZZ',
              trustee_id: refundRequest.trustee_id,
              school_id: refundRequest.school_id,
            });
          }
          return res.status(200).send('OK');
        } catch (err) {
          console.log('Error sending ERP webhooks', err);
        }

        res.status(200).send('OK');
      } catch (e) {
        await new this.webhooksLogsModel({
          type: 'Refund Webhook',
          order_id: collect_id || 'ezbcalled',
          status: 'Failed to save webhook',
        }).save();
        console.log(e.message);
      }
    } catch (e) {
      const emailSubject = `Error in EASEBUZZ REFUND WEBHOOK "@Post('easebuzz/refund')"`;
      const errorDetails = {
        environment: process.env.NODE_ENV || 'PRODUCTION',
        service: 'EASEBUZZ',
        data: body,
        timestamp: new Date().toISOString(),
      };
      const emailBody = generateErrorEmailTemplate(
        e,
        errorDetails,
        emailSubject,
      );
      this.emailService.sendErrorMail(emailSubject, emailBody);
      console.error('Error saving webhook logs', e);
      throw new InternalServerErrorException(
        e.message || 'Something Went Wrong',
      );
    }
  }

  @Post('/cashfree/refund')
  async cashfreeRefundWebhook(@Body() body: any, @Res() res: any) {
    try {
      const {
        refund_id,
        order_id,
        refund_amount,
        status_description,
        cf_refund_id,
      } = body.data.refund;

      const cf_refund_status = body.data.refund.refund_status;
      const details = JSON.stringify(body);
      await new this.webhooksLogsModel({
        type: 'Refund Webhook',
        order_id: order_id,
        gateway: 'CASHFREE',
        type_id: refund_id,
        body: details,
        status: 'SUCCESS',
      }).save();

      try {
        const refundRequest = await this.refundRequestModel.findById(refund_id);
        if (!refundRequest) {
          console.log(`Refund request not Found`);
        }
        let status = refund_status.INITIATED;
        if (cf_refund_status === 'SUCCESS') {
          status = refund_status.APPROVED;
        }
        refundRequest.status = status;
        refundRequest.gateway = 'CASHFREE';
        refundRequest.gatway_refund_id = cf_refund_id;
        refundRequest.additonalInfo = status_description;
        await refundRequest.save();

        // Sending ERP webhooks
        try {
          const trustee_id = refundRequest.trustee_id;
          const trustee = await this.TrusteeModel.findById(trustee_id);
          if (!trustee) {
            throw new BadRequestException('Trustee not found');
          }
          const refundWebhookUrl = trustee.refund_webhook_url;
          if (!refundWebhookUrl) {
            res.status(200).send('OK');
          }
          const payload = {
            refund_id,
            refund_amount,
            status_description,
            school_id: refundRequest.school_id.toString(),
            order_id: refundRequest.order_id.toString(),
          };
          const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: refundWebhookUrl,
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            data: payload,
          };
          try {
            const response = await axios.request(config);
            const res = JSON.stringify(response.data) || 'NA';
            await this.webhooksLogsModel.create({
              type: 'ERP_REFUND_WEBHOOK_SUCCESS',
              gateway: 'CASHFREE',
              status: 'SUCCESS',
              res,
              trustee_id: refundRequest.trustee_id,
              school_id: refundRequest.school_id,
            });
          } catch (e) {
            await this.webhooksLogsModel.create({
              type: 'ERP_REFUND_WEBHOOK_ERROR',
              error: e.message,
              status: 'FAILED',
              gateway: 'CASHFREE',
              trustee_id: refundRequest.trustee_id,
              school_id: refundRequest.school_id,
            });
          }
          return res.status(200).send('OK');
        } catch (e) {
          console.log('Error sending ERP webhooks', e);
        }

        res.status(200).send('OK');
      } catch (e) {
        console.error('Error saving webhook logs', e);
      }
    } catch (e) {
      const emailSubject = `Error in CASHFREE REFUND WEBHOOK "@Post('cashfree/refund')"`;
      const errorDetails = {
        environment: process.env.NODE_ENV || 'PRODUCTION',
        service: 'CASHFREE',
        data: body,
        timestamp: new Date().toISOString(),
      };
      const emailBody = generateErrorEmailTemplate(
        e,
        errorDetails,
        emailSubject,
      );
      this.emailService.sendErrorMail(emailSubject, emailBody);
      console.error('Error saving webhook logs', e);
      throw new InternalServerErrorException(
        e.message || 'Something Went Wrong',
      );
    }
  }

  @Post('easebuzz/settlements')
  async eassebuzzSettlements(@Body() body: any, @Res() res: any) {
    try {
      const details = JSON.stringify(body);
      await new this.webhooksLogsModel({
        type: 'SETTLEMENTS',
        gateway: 'EASEBUZZ',
        // type_id:body.data.hash,
        body: details,
        status: 'SUCCESS',
      }).save();
      const info = body.data;
      const data = JSON.parse(info);
      data.submerchant_payouts.map(async (payout) => {
        const merchant = await this.TrusteeSchoolmodel.findOne({
          easebuzz_id: payout.submerchant_id,
        });
        if (!merchant) {
          console.log(
            `Merchant not found for easebuzz_id: ${payout.submerchant_id}`,
          );
          return;
        }
        const easebuzzDate = new Date(payout.submerchant_payout_date);
        const saveSettlements =
          await this.SettlementReportModel.findOneAndUpdate(
            { utrNumber: payout.bank_transaction_id },
            {
              $set: {
                settlementAmount: payout.payout_amount + payout.refund_amount,
                adjustment: payout.refund_amount,
                netSettlementAmount: payout.payout_amount,
                fromDate: new Date(
                  easebuzzDate.getTime() - 24 * 60 * 60 * 1000,
                ),
                tillDate: new Date(
                  easebuzzDate.getTime() - 24 * 60 * 60 * 1000,
                ),
                settlementInitiatedOn: new Date(payout.submerchant_payout_date),
                status: 'SUCCESS',
                utrNumber: payout.bank_transaction_id,
                settlementDate: new Date(payout.submerchant_payout_date),
                clientId: payout.submerchant_id || 'NA',
                trustee: merchant.trustee_id,
                schoolId: merchant.school_id,
                remarks: 'NA',
              },
            },
            {
              upsert: true,
              new: true,
            },
          );
      });
      console.log('called');
      res.status(200).send('OK');
    } catch (e) {
      const emailSubject = `Error in EASEBUZZ SETTLEMENT WEBHOOK "@Post('easebuzz/settlements')"`;
      const errorDetails = {
        environment: process.env.NODE_ENV || 'PRODUCTION',
        service: 'EASEBUZZ',
        data: body,
        timestamp: new Date().toISOString(),
      };
      const emailBody = generateErrorEmailTemplate(
        e,
        errorDetails,
        emailSubject,
      );
      this.emailService.sendErrorMail(emailSubject, emailBody);
      console.error('Error saving webhook logs', e);
      throw new InternalServerErrorException(
        e.message || 'Something Went Wrong',
      );
    }
  }

  @Post('cashfree/settlements')
  async cashfreeSettlements(@Body() body: any, @Res() res: any) {
    try {
      console.log('cashfree settlement');
      const details = JSON.stringify(body);
      //  saving logs
      await new this.webhooksLogsModel({
        type: 'SETTLEMENTS',
        gateway: 'CASHFREE',
        // type_id:body.data.hash,
        body: details,
        status: 'SUCCESS',
      }).save();

      const { settlement } = body.data;
      const {
        adjustment,
        amount_settled,
        payment_amount,
        payment_from,
        payment_till,
        reason,
        remarks,
        service_charge,
        service_tax,
        settled_on,
        settlement_amount,
        settlement_charge,
        settlement_id,
        settlement_initiated_on,
        settlement_tax,
        settlement_type,
        status,
        utr,
      } = settlement;

      const payload = {
        adjustment,
        amount_settled,
        payment_amount,
        payment_from,
        payment_till,
        service_charge,
        service_tax,
        settled_on,
        settlement_amount,
        settlement_charge,
        settlement_id,
        settlement_initiated_on,
        status,
        utr,
      };
      // console.log(body.merchant);

      const merchant_id = body.merchant.merchant_id;
      const merchant = await this.TrusteeSchoolmodel.findOne({
        client_id: merchant_id,
      });

      if (!merchant) {
        throw new Error('Merchnat not Found');
      }

      const trustee = await this.TrusteeModel.findById(merchant.trustee_id);
      if (!trustee) {
        throw new Error('Trustee not Found');
      }
      const webhook_urls = trustee.settlement_webhook_url;

      const saveSettlements = await this.SettlementReportModel.findOneAndUpdate(
        { utrNumber: utr },
        {
          $set: {
            settlementAmount: payment_amount,
            adjustment: adjustment,
            netSettlementAmount: amount_settled,
            fromDate: new Date(payment_from),
            tillDate: new Date(payment_till),
            settlementInitiatedOn: new Date(settlement_initiated_on),
            status: status,
            utrNumber: utr,
            settlementDate: new Date(settled_on),
            clientId: merchant_id || 'NA',
            trustee: merchant.trustee_id,
            schoolId: merchant.school_id,
            remarks: remarks || 'NA',
          },
        },
        {
          upsert: true,
          new: true,
        },
      );

      if (webhook_urls) {
        const config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: webhook_urls,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          data: payload,
        };
        try {
          const response = await axios.request(config);
          const res = JSON.stringify(response.data) || 'NA';
          await this.webhooksLogsModel.create({
            type: 'ERP_SETTLEMENTS_WEBHOOK_SUCCESS',
            gateway: 'CASHFREE',
            status: 'SUCCESS',
            res,
            trustee_id: merchant.trustee_id,
            school_id: merchant.school_id,
          });
          //  Save ERP WEbhooks LOgs in Payments backend here.
        } catch (e) {
          await this.webhooksLogsModel.create({
            type: 'ERP_SETTLEMENTS_WEBHOOK_ERROR',
            error: e.message,
            status: 'FAILED',
            gateway: 'CASHFREE',
            trustee_id: merchant.trustee_id,
            school_id: merchant.school_id,
          });
        }
      }

      // saving reconcilation data
      if (status === 'SUCCESS') {
        console.log('Success');

        setTimeout(
          async () => {
            console.log('40 min delay');
            try {
              const settlementDate = await this.formatDate(settled_on);
              const paymentFromDate = await this.formatDate(payment_from);
              const paymentTillDate = await this.formatDate(payment_till);
              await this.trusteeService.reconSettlementAndTransaction(
                merchant.trustee_id.toString(),
                merchant.school_id.toString(),
                settlementDate,
                paymentFromDate,
                paymentTillDate,
                payment_from,
                payment_till,
                settled_on,
              );
            } catch (e) {
              console.log(e.message);
              console.log('error in recon save');
              // ADD mailer here
            }
          },
          40 * 60 * 1000,
        ); // 40 min delay
      }
      console.log('returning transaction');

      return res.status(200).send('OK');
    } catch (e) {
      const emailSubject = `Error in CASHFREE SETTLEMENT WEBHOOK "@Post('cashfree/settlements')"`;
      const errorDetails = {
        environment: process.env.NODE_ENV || 'PRODUCTION',
        service: 'CASHFREE',
        data: body,
        timestamp: new Date().toISOString(),
      };
      const emailBody = generateErrorEmailTemplate(
        e,
        errorDetails,
        emailSubject,
      );
      this.emailService.sendErrorMail(emailSubject, emailBody);
      console.error('Error saving webhook logs', e);
      throw new InternalServerErrorException(
        e.message || 'Something Went Wrong',
      );
    }
  }

  async formatDate(dateString: string) {
    return dateString.split('T')[0];
  }

  @Post('cashfree/vendor-settlements')
  async cashfreeVendorSettlements(@Body() body: any, @Res() res: any) {
    try {
      const details = JSON.stringify(body);
      const webhooklogs = await new this.webhooksLogsModel({
        type: 'VENDOR_SETTLEMENTS',
        gateway: 'CASHFREE',
        // type_id:body.data.hash,
        body: details,
        status: 'SUCCESS',
      }).save();
      const { data: vendorSettlement } = body;

      const {
        utr,
        vendor_id,
        settled_on,
        settlement_amount,
        adjustment,
        payment_from,
        payment_till,
        vendor_transaction_amount,
        settlement_id,
        settlement_initiated_on,
        status,
        amount_settled,
      } = vendorSettlement.settlement;
      // console.log(vendorSettlement, 'logs');

      if (!utr) {
        webhooklogs.error = `UTR missing for ${settlement_id}`;
        webhooklogs.status = 'SETTLEMENT_ERROR';
        await webhooklogs.save();
        return res.status(400).send('Invalid UTR');
      }

      webhooklogs.type_id = vendor_id;
      await webhooklogs.save();
      const client_id = body.merchant.merchant_id || null;

      const checkVendors = await this.venodrsModel.findOne({ vendor_id });
      const school = await this.TrusteeSchoolmodel.findOne({
        school_id: checkVendors.school_id,
      });
      const school_name = school.school_name;
      if (!checkVendors) {
        webhooklogs.error = `Error in Finding Venodrs for ${vendor_id}`;
        webhooklogs.status = 'SETTLEMENT_ERROR';
        webhooklogs.type_id = settlement_id;
        await webhooklogs.save();
        // throw new NotFoundException(`Vendor Not Found ${vendor_id}`);
        return res.status(404).send('Vendor Not Found ');
      }
      console.log(new Date(settled_on), 'date');
      const settlementDate = new Date(settled_on);
      const newSettlement = await this.venodrsSettlementmodel.findOneAndUpdate(
        { settlement_id: settlement_id.toString() },
        {
          $set: {
            school_id: checkVendors.school_id,
            trustee_id: checkVendors.trustee_id,
            client_id,
            utr,
            vendor_id,
            adjustment,
            settlement_amount: amount_settled,
            net_settlement_amount: settlement_amount,
            vendor_transaction_amount,
            payment_from: new Date(payment_from),
            payment_till: new Date(payment_till),
            settled_on: settlementDate,
            settlement_id,
            settlement_initiated_on: new Date(settlement_initiated_on),
            status,
            school_name,
            vendor_name: checkVendors.name,
          },
        },
        {
          upsert: true,
          new: true,
        },
      );

      res.status(200).send('OK');
    } catch (e) {
      const emailSubject = `Error in CASHFREE VENDOR SETTLEMENT WEBHOOK "@Post('cashfree/vendor-settlements')"`;
      const errorDetails = {
        environment: process.env.NODE_ENV || 'PRODUCTION',
        service: 'CASHFREE',
        data: body,
        timestamp: new Date().toISOString(),
      };
      const emailBody = generateErrorEmailTemplate(
        e,
        errorDetails,
        emailSubject,
      );
      this.emailService.sendErrorMail(emailSubject, emailBody);
      console.error('Error saving webhook logs', e);
      throw new InternalServerErrorException(
        e.message || 'Something Went Wrong',
      );
    }
  }

  @Post('cashfree/vendor-status')
  async cashfreeVendorStatus(@Body() body: any, @Res() res: any) {
    try {
      const details = JSON.stringify(body);
      const webhooklogs = await new this.webhooksLogsModel({
        type: 'VENDOR_STATUS',
        gateway: 'CASHFREE',
        // type_id:body.data.hash,
        body: details,
        status: 'SUCCESS',
      }).save();

      // const

      res.status(200).send('OK');
    } catch (e) {
      console.log(e);

      console.error('Error saving webhook logs', e.message);
    }
  }

  @Post('/test-webhooks')
  async testWebhooks(@Body() body: any, @Res() res: any) {
    const details = JSON.stringify(body);
    await new this.webhooksLogsModel({
      body: details,
      type: 'TEST_WEBHOOKS',
    }).save();

    return res.status(200).send('OK');
  }

  @Get('test')
  async testSettlement() {
    const startDate = new Date('2024-11-10'); // Start of 15th
    const endDate = new Date('2024-11-17'); // End of 17th

    const data = await this.webhooksLogsModel.find({
      createdAt: {
        $gte: startDate, // Greater than or equal to startDate
        $lte: endDate, // Less than or equal to endDate
      },
    });

    return data;
  }

  // Dispute Webhooks
  @Post('cashfree/dispute-webhooks')
  async cashfreeDisputeWebhooks(@Body() body: any, @Res() res: any) {
    const details = JSON.stringify(body);
    const webhooklogs = await new this.webhooksLogsModel({
      body: details,
    }).save();
    try {
      const {
        dispute_id,
        dispute_type,
        reason_code,
        reason_description,
        dispute_amount,
        created_at,
        updated_at,
        respond_by,
        resolved_at,
        dispute_status,
        cf_dispute_remarks,
      } = body.data.dispute;

      const { order_id } = body.data.order_details;
      const webhook_type = body.data.type;
      webhooklogs.collect_id = order_id;
      await webhooklogs.save();
      const token = jwt.sign(
        { collect_request_id: order_id },
        process.env.PAYMENTS_SERVICE_SECRET,
      );
      const orderDetailsConfig = {
        method: 'get',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/erp-transaction-info?collect_request_id=${order_id}&token=${token}`,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };

      const { data: response } = await axios.request(orderDetailsConfig);
      const transactionInfo = response[0];
      const custom_order_id = transactionInfo.custom_order_id || 'NA';
      const school_id = transactionInfo.school_id;
      const school = await this.TrusteeSchoolmodel.findOne({
        school_id: new Types.ObjectId(school_id),
      });
      if (!school) {
        throw new BadRequestException('School not found');
      }

      const dispute = await this.DisputesModel.findOneAndUpdate(
        { dispute_id },
        {
          $set: {
            school_id: new Types.ObjectId(school_id),
            trustee_id: school.trustee_id,
            collect_id: order_id,
            custom_order_id,
            dispute_type,
            reason_description,
            dispute_amount,
            order_amount: transactionInfo.order_amount,
            payment_amount: transactionInfo.transaction_amount,
            dispute_created_date: new Date(created_at),
            dispute_updated_date: new Date(updated_at),
            dispute_respond_by_date: new Date(respond_by),
            dispute_status,
            dispute_remark: cf_dispute_remarks,
            // dispute_resolved_at_date: new Date(resolved_at),
            // resolved_at,
            // cf_dispute_remarks,
            gateway: DisputeGateways.CASHFREE,
          },
        },
        { upsert: true, new: true },
      );
      if (dispute_status === 'DISPUTE_CREATED') {
        // const trusteeEmail = await this.TrusteeModel.findById(
        //   school.trustee_id,
        // );
        const subject = `A dispute has been raised against transaction id: ${dispute.collect_id}`;
        const innerMailTemp = getAdminEmailTemplate(dispute, false);
        // const userMailTemp = getCustomerEmailTemplate(
        //   dispute,
        //   school.school_name,
        //   false,
        // );
        this.emailService.sendErrorMail(subject, innerMailTemp);

        // this.emailService.sendMailToTrustee(subject, userMailTemp, [trusteeEmail.email_id]);

        const gatewayMailSubject = `Dispute invoice against transaction id: ${dispute.collect_id}`;

        const gatewayMailData = {
          transactionId: transactionInfo.collect_id,
          custom_order_id: transactionInfo.custom_order_id || 'NA',
          disputeStatus: transactionInfo.dispute_status,
          date: new Date(transactionInfo.payment_time).toLocaleDateString(
            'en-IN',
            { timeZone: 'Asia/Kolkata' },
          ),
          schoolName: school.school_name,
          amount: transactionInfo.transaction_amount,
          bank_reference: transactionInfo.bank_reference,
          student_details: transactionInfo?.additional_data
            ? JSON.parse(transactionInfo.additional_data)
            : {},
          payment_method: transactionInfo.payment_method,
          payment_details: transactionInfo.details,
          gateway: dispute.gateway,
        };

        this.pdfService.generatePDF(gatewayMailData).then((pdf: any) => {
          this.emailService.sendMailWithAttachment(
            gatewayMailSubject,
            `<h3> Please find the attached invoice againest dispute case id: ${dispute.dispute_id} </h3>`,
            DISPUT_INVOICE_MAIL_GATEWAY,
            `receipt_${gatewayMailData.transactionId}.pdf`,
            pdf,
          );
        });
      }
      if (resolved_at) {
        dispute.dispute_resolved_at_date = new Date(resolved_at);
        await dispute.save();
        // const trusteeEmail = await this.TrusteeModel.findById(
        //   school.trustee_id,
        // );
        const subject = `A dispute has been resolved against transaction id: ${dispute.collect_id}`;
        const innerMailTemp = getAdminEmailTemplate(dispute, false);
        // const userMailTemp = getCustomerEmailTemplate(
        //   dispute,
        //   school.school_name,
        //   false,
        // );
        this.emailService.sendErrorMail(subject, innerMailTemp);

        // this.emailService.sendMailToTrustee(subject, userMailTemp, [trusteeEmail.email_id]);
      }

      res.status(200).send('OK');
    } catch (e) {
      console.log(e.message);
    }
  }

  @Post('easebuzz/dispute-webhooks')
  async easebuzzDisputeWebhooks(@Body() body: any, @Res() res: any) {
    try {
      const details = JSON.stringify(body);
      const webhooklogs = await new this.webhooksLogsModel({
        body: details,
      }).save();

      // try{
      //   const {school_id}=body
      //   const emails=await this.getMails(
      //     'DISPUTE',
      //     school_id
      //   )
      //   const subject = `A dispute has been raised against transaction id: ${dispute.collect_id}`;
      //   const innerMailTemp = getAdminEmailTemplate(dispute, false);
      //   // const userMailTemp = getCustomerEmailTemplate(
      //   //   dispute,
      //   //   school.school_name,
      //   //   false,
      //   // );
      //   this.emailService.sendErrorMail(subject, innerMailTemp);
      // }catch(e){}

      const {
        dispute_id,
        dispute_type,
        created_at,
        updated_at,
        Case_id,
        dispute_amount,
        status,
        deadline,
      } = body.data;
      let { transaction_id } = body.data;

      if (transaction_id.startsWith('upi_')) {
        transaction_id = transaction_id.replace('upi_', '');
      }

      webhooklogs.collect_id = transaction_id;
      await webhooklogs.save();

      const token = jwt.sign(
        { collect_request_id: transaction_id },
        process.env.PAYMENTS_SERVICE_SECRET,
      );

      const orderDetailsConfig = {
        method: 'get',
        url: `${process.env.PAYMENTS_SERVICE_ENDPOINT}/edviron-pg/erp-transaction-info?collect_request_id=${transaction_id}&token=${token}`,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };

      const { data: response } = await axios.request(orderDetailsConfig);
      const transactionInfo = response[0];
      const custom_order_id = transactionInfo.custom_order_id || 'NA';
      const school_id = transactionInfo.school_id;

      const school = await this.TrusteeSchoolmodel.findOne({
        school_id: new Types.ObjectId(school_id),
      });

      if (!school) {
        throw new BadRequestException('School not found');
      }

      const dispute = await this.DisputesModel.findOneAndUpdate(
        { dispute_id },
        {
          set: {
            school_id: new Types.ObjectId(school_id),
            trustee_id: school.trustee_id,
            collect_id: transaction_id,
            custom_order_id,
            dispute_type,
            reason_description: dispute_type,
            dispute_amount,
            case_id: Case_id,
            order_amount: transactionInfo.order_amount,
            payment_amount: transactionInfo.transaction_amount,
            dispute_created_date: new Date(created_at),
            dispute_updated_date: new Date(updated_at),
            dispute_respond_by_date: new Date(deadline),
            dispute_status: status,
            dispute_remark: 'NA',
            gateway: DisputeGateways.EASEBUZZ,
          },
        },
        { upsert: true, new: true },
      );
      if (status === 'OPEN') {
        // const trusteeEmail = await this.TrusteeModel.findById(
        //   school.trustee_id,
        // );
        const subject = `A dispute has been raised against transaction id: ${transaction_id}`;
        const innerMailTemp = getAdminEmailTemplate(dispute, false);
        // const userMailTemp = getCustomerEmailTemplate(
        //   dispute,
        //   school.school_name,
        //   false,
        // );
        this.emailService.sendErrorMail(subject, innerMailTemp);

        // this.emailService.sendMailToTrustee(subject, userMailTemp, [trusteeEmail.email_id]);

        const gatewayMailSubject = `Dispute invoice against transaction id: ${transaction_id}`;

        const gatewayMailData = {
          transactionId: transactionInfo.collect_id,
          custom_order_id: transactionInfo.custom_order_id || 'NA',
          disputeStatus: transactionInfo.dispute_status,
          date: new Date(transactionInfo.payment_time).toLocaleDateString(
            'en-IN',
            { timeZone: 'Asia/Kolkata' },
          ),
          schoolName: school.school_name,
          amount: transactionInfo.transaction_amount,
          bank_reference: transactionInfo.bank_reference,
          student_details: transactionInfo?.additional_data
            ? JSON.parse(transactionInfo.additional_data)
            : {},
          payment_method: transactionInfo.payment_method,
          payment_details: transactionInfo.details,
          gateway: dispute.gateway,
        };

        this.pdfService.generatePDF(gatewayMailData).then((pdf: any) => {
          this.emailService.sendMailWithAttachment(
            gatewayMailSubject,
            `<h3> Please find the attached invoice againest dispute case id: ${dispute.case_id} </h3>`,
            DISPUT_INVOICE_MAIL_GATEWAY,
            `receipt_${gatewayMailData.transactionId}.pdf`,
            pdf,
          );
        });
      }
      if (status === 'CLOSED') {
        dispute.dispute_resolved_at_date = new Date(updated_at);
        await dispute.save();
        // const trusteeEmail = await this.TrusteeModel.findById(
        //   school.trustee_id,
        // );
        const subject = `A dispute has been resolved against transaction id: ${transaction_id}`;
        const innerMailTemp = getAdminEmailTemplate(dispute, false);
        // const userMailTemp = getCustomerEmailTemplate(
        //   dispute,
        //   school.school_name,
        //   false,
        // );
        this.emailService.sendErrorMail(subject, innerMailTemp);

        // this.emailService.sendMailToTrustee(subject, userMailTemp, [trusteeEmail.email_id]);
      }
      res.status(200).send('OK');
    } catch (error) {
      const emailSubject = `Error in EASEBUZZ DISPUTE WEBHOOK "@Post('easebuzz/dispute-webhooks')"`;
      const errorDetails = {
        environment: process.env.NODE_ENV || 'PRODUCTION',
        service: 'EASEBUZZ',
        data: body,
        timestamp: new Date().toISOString(),
      };
      const emailBody = generateErrorEmailTemplate(
        error,
        errorDetails,
        emailSubject,
      );
      this.emailService.sendErrorMail(emailSubject, emailBody);
      throw new BadRequestException(error.message);
    }
  }

  @Post('create-event')
  async createEvent(@Body() body: { name: Events }) {
    try {
      console.log(body.name);

      const event = await this.EmailEventModel.findOne({
        event_name: body.name,
      });
      console.log(event);

      event;
      if (event) {
        throw new ConflictException('Event Already present ' + body.name);
      }
      const newEvent = await this.EmailEventModel.create({
        event_name: body.name,
      });

      return newEvent;
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @Post('create-group')
  async createGroup(
    @Body()
    body: {
      school_id: string;
      group_name: string;
      emails: [string];
      event_id: string;
      isCommon: boolean;
    },
  ) {
    const { school_id, group_name, emails, event_id, isCommon } = body;
    if (isCommon) {
      const event = await this.EmailEventModel.findById(event_id);
      if (!event) {
        throw new NotFoundException('Event not found');
      }
      const group = await this.EmailGroupModel.create({
        group_name,
        emails,
        event_id: new Types.ObjectId(event_id),
        isCommon,
      });

      return group;
    }
    const school = await this.TrusteeSchoolmodel.findOne({
      school_id: new Types.ObjectId(school_id),
    });
    if (!school) {
      throw new NotFoundException('school not found');
    }
    const event = await this.EmailEventModel.findById(event_id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    const group = await this.EmailGroupModel.create({
      group_name,
      school_id: new Types.ObjectId(school_id),
      emails,
      event_id: new Types.ObjectId(event_id),
      trustee_id: school.trustee_id,
      isCommon,
    });

    return group;
  }

  async getMails(event_name: string, school_id: string) {
    try {
      const event = await this.EmailEventModel.findOne({
        event_name: event_name,
      });
      const groups = await this.EmailEventModel.find({
        $or: [
          {
            event_id: event._id,
            school_id: new Types.ObjectId(school_id),
            isCommon: false,
          },
          {
            event_id: event._id,
            isCommon: true,
          },
        ],
      })
        .select('emails')
        .exec();
      // Flatten and remove duplicates
      const emails = [...new Set(groups.flatMap((group) => group.emails))];
      return emails;
    } catch (e) { }
  }

  @Post('pay-u/refunds')
  async payuRefundWebhook(@Body() body: any, @Res() res: any){
    try{
      await new this.webhooksLogsModel({
        type: 'Refund Webhook',
        status: 'CALLED',
        gateway: 'EDVIRON_PAY-U',
        body: 'data',
      }).save();
    }catch(e){
      console.log(`Error in Saving refund`);
    }
    const data = JSON.stringify(body);
    // const {txnid, mihpayid} = data
    // let collect_id = txnid;
    await new this.webhooksLogsModel({
      type: 'Refund Webhook',
      // order_id: 'payu-pg',
      status: 'CALLED',
      gateway: 'EDVIRON_PAY-U',
      // type_id: "payu typeid",
      body: data,
    }).save();
    return res.status(200).send('OK');
  }

  @Post('pay-u/settlements')
  async payuSettlementWebhook(@Body() body: any, @Res() res: any){
    const data = JSON.stringify(body.data);
    // const {txnid, mihpayid} = data
    // let collect_id = txnid;
    await new this.webhooksLogsModel({
      type: 'SETTLEMENTS',
      gateway: 'EDVIRON_PAY-U',
      // type_id:body.data.hash,
      body: data,
      status: 'CALLED',
    }).save();
    return res.status(200).send('OK');
  }

  @Post('pay-u/disputes')
  async payuDisputesWebhook(@Body() body: any, @Res() res: any){
    const data = JSON.stringify(body.data);
    await new this.webhooksLogsModel({
      type: 'Disputes',
      gateway: 'EDVIRON_PAY-U',
      body: data,
      status: 'CALLED',
    }).save();
    return res.status(200).send('OK');
  }

  @Get('/dummy')
  async dummy(){
    const res="{\"rows\":1,\"message\":\"1 Settlements found for the 2025-04-22T00:00 and 2025-04-23T00:00\",\"status\":1,\"result\":[{\"settlementId\":\"12678458202504221245\",\"settlementCompletedDate\":\"2025-04-22 15:03:13\",\"settlementAmount\":\"16198.64\",\"merchantId\":12678458,\"utrNumber\":\"AXISCN0964297088\",\"transaction\":[{\"action\":\"capture\",\"payuId\":\"23244908014\",\"requestId\":\"16733631193\",\"transactionAmount\":\"1.00\",\"merchantServiceFee\":\"0.00000\",\"merchantServiceTax\":\"0.00000\",\"merchantNetAmount\":\"-0.18\",\"sgst\":\"0.00000\",\"cgst\":\"0.00000\",\"igst\":\"0.00000\",\"merchantTransactionId\":\"680613d78218d3a8c036fed4\",\"mode\":\"UPI\",\"paymentStatus\":\"captured\",\"transactionDate\":\"2025-04-21 15:16:01\",\"requestDate\":\"2025-04-21 15:16:24\",\"requestedAmount\":\"1.00\",\"bankName\":\"INTENT\",\"offerServiceFee\":\"0.00\",\"offerServiceTax\":\"0.00\",\"forexAmount\":\"0.00\",\"discount\":\"0.00\",\"additionalTdrFee\":\"1.00\",\"totalServiceTax\":\"0.18000\",\"transactionCurrency\":\"INR\",\"settlementCurrency\":\"INR\",\"totalProcessingFee\":\"1.00000\",\"additionalTdrTax\":\"0.18\"},{\"action\":\"capture\",\"payuId\":\"23250070064\",\"requestId\":\"16737918929\",\"transactionAmount\":\"16200.00\",\"merchantServiceFee\":\"0.00000\",\"merchantServiceTax\":\"0.00000\",\"merchantNetAmount\":\"16198.82\",\"sgst\":\"0.00000\",\"cgst\":\"0.00000\",\"igst\":\"0.00000\",\"merchantTransactionId\":\"6806781a8218d3a8c03772ff\",\"mode\":\"UPI\",\"paymentStatus\":\"captured\",\"transactionDate\":\"2025-04-21 22:23:47\",\"requestDate\":\"2025-04-21 22:24:10\",\"requestedAmount\":\"16200.00\",\"bankName\":\"INTENT\",\"offerServiceFee\":\"0.00\",\"offerServiceTax\":\"0.00\",\"forexAmount\":\"0.00\",\"discount\":\"0.00\",\"additionalTdrFee\":\"1.00\",\"totalServiceTax\":\"0.18000\",\"transactionCurrency\":\"INR\",\"settlementCurrency\":\"INR\",\"totalProcessingFee\":\"1.00000\",\"additionalTdrTax\":\"0.18\"}]}]}"

    return JSON.parse(res)
  }
}

// Dispute payload
const payloadTest = {
  data: {
    dispute: {
      dispute_id: '433475257',
      dispute_type: 'CHARGEBACK',
      reason_code: '4855',
      reason_description: 'Goods or Services Not Provided',
      dispute_amount: 4500,
      created_at: '2023-06-15T21:16:03+05:30',
      updated_at: '2023-06-15T21:16:51+05:30',
      respond_by: '2023-06-18T00:00:00+05:30',
      resolved_at: '2023-06-15T21:16:51.682836678+05:30',
      dispute_status: 'CHARGEBACK_MERCHANT_WON',
      cf_dispute_remarks: 'Chargeback won by merchant',
    },
    order_details: {
      order_id: 'order_1944392D4jHtCeVPPdTXkaUwg5cfnujQe',
      order_amount: 4500,
      order_currency: 'INR',
      cf_payment_id: 885457437,
      payment_amount: 4500,
      payment_currency: 'INR',
    },
    customer_details: {
      customer_name: 'Dileep Kumar s',
      customer_phone: '8000000000',
      customer_email: 'dileep@gmail.com',
    },
  },
  event_time: '2023-06-15T21:17:14+05:30',
  type: 'DISPUTE_CLOSED',
};
