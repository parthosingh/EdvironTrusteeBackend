import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, ObjectId, Types } from 'mongoose';
import { refund_status, RefundRequest } from 'src/schema/refund.schema';
import { TrusteeSchool } from 'src/schema/school.schema';
import { Trustee } from 'src/schema/trustee.schema';
import { VendorsSettlement } from 'src/schema/vendor.settlements.schema';
import { Vendors } from 'src/schema/vendors.schema';
import { WebhookLogs } from 'src/schema/webhook.schema';
import axios, { AxiosError } from 'axios';
import * as jwt from 'jsonwebtoken';
import { Disputes } from 'src/schema/disputes.schema';
import { TempSettlementReport } from 'src/schema/tempSettlements.schema';

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
  ) {}

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
    const {
      txnid,
      easepayid,
      refund_id,
      refund_amount,
      transaction_date,
      transaction_type,
      merchant_refund_id,
      chargeback_description,
    } = body.data;

    let collect_id = txnid;
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
  }

  @Post('/cashfree/refund')
  async cashfreeRefundWebhook(@Body() body: any, @Res() res: any) {
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

      console.log('called');
      res.status(200).send('OK');
    } catch (e) {
      console.error('Error saving webhook logs', e);
    }
  } 
  @Post('cashfree/settlements')
  async cashfreeSettlements(@Body() body: any, @Res() res: any) {
    try {
      const details = JSON.stringify(body);
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
      console.log(body.merchant);
      
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
      
      const saveSettlements=await this.TempSettlementReportModel.findOneAndUpdate(
        {utrNumber: utr},
        {
          $set: {
            settlementAmount: settlement_amount,
            adjustment: adjustment,
            netSettlementAmount: amount_settled,
            fromDate: new Date(payment_from),
            tillDate: new Date(payment_till),
            status: status,
            utrNumber: utr,
            settlementDate: new Date(settled_on),
            clientId: merchant_id,
            trustee: merchant.trustee_id,
            schoolId: merchant.school_id,

          }
        },
        {
          upsert: true,
          new: true,
        },
      )
      console.log(saveSettlements);
      if (!webhook_urls) {
        return res.status(200).send('OK');
      }
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
      return res.status(200).send('OK');
    } catch (e) {
      console.error('Error saving webhook logs', e);
    }
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
      console.error('Error saving webhook logs', e);
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
      console.log('fetching data');

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
          },
        },
        { upsert: true, new: true },
      );
      if (resolved_at) {
        dispute.dispute_resolved_at_date = new Date(resolved_at);
        await dispute.save();
      }
      res.status(200).send('OK');
    } catch (e) {
      console.log(e.message);
    }
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
