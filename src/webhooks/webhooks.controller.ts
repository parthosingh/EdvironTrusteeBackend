import {
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
      const refundRequest = await this.refundRequestModel.findById(collect_id);
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
      refundRequest.gateway = 'CASHFREE';
      refundRequest.gatway_refund_id = refund_id;
      refundRequest.additonalInfo = easebuzz_refund_status;
      await refundRequest.save();

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
      const merchant_id = body.data.merchant.merchant_id;
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
      body:details,
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
}

// {
//     "status": "0",
//     //cancontain"0"or"1".If"0" means"data"parametercontainserrormessagesomeerror.if"1",  means"data"parametercontainspayoutdata
//       "data": {
//       "hash": "f9d519857d1a102ad04809fdd6d32a19ca5c448d0ee909e6b46552e4b7aede4496c4fad2aef16f3709b3ac13c47d54c2ec45c606b3d0ae4c589976e976fa63bd",
//       "txnid": "Lq8JvtoIBM",
//       "easepayid": "DTPQ8SVS0H",
//       "refund_id": "RSR9QR844I",
//       "refund_amount": 1,
//       "refund_status": "accepted",
//       //canbe: "queued","accepted", "refunded"
//       "transaction_date": "2018-05-26 14:36:48.000000",
//       "transaction_type": "Netbanking",
//       "transaction_amount": 2,
//       "refund_request_date": "2018-05-28 17:03:18.798735"
//     }
//   }

// {
//     "data":{
//  "refund":{
//           "cf_refund_id":11325632,
//           "cf_payment_id":789727431,
//           "refund_id":"refund_sampleorder0413",
//           "order_id":"sampleorder0413",
//           "refund_amount":2.00,
//           "refund_currency":"INR",
//           "entity":"Refund",
//           "refund_type":"MERCHANT_INITIATED",
//           "refund_arn":"205907014017",
//           "refund_status":"SUCCESS",
//           "status_description":"Refund processed successfully",
//           "created_at":"2022-02-28T12:54:25+05:30",
//           "processed_at":"2022-02-28T13:04:27+05:30",
//           "refund_charge":0,
//           "refund_note":"Test",
//           "refund_splits":[
//              {
//                 "merchantVendorId":"sampleID12345",
//                 "amount":1,
//                 "percentage":null
//              },
//              {
//                 "merchantVendorId":"otherVendor",
//                 "amount":1,
//                 "percentage":null
//              }
//           ],
//           "metadata":null,
//           "refund_mode":"STANDARD"
//        }
//     },
//     "event_time":"2022-02-28T13:04:28+05:30",
//     "type":"REFUND_STATUS_WEBHOOK"
//  }
