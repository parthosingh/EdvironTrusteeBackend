import { Body, Controller, Post, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, ObjectId, Types } from 'mongoose';
import { refund_status, RefundRequest } from 'src/schema/refund.schema';
import { WebhookLogs } from 'src/schema/webhook.schema';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    @InjectModel(WebhookLogs.name)
    private webhooksLogsModel: mongoose.Model<WebhookLogs>,
    @InjectModel(RefundRequest.name)
    private refundRequestModel: mongoose.Model<RefundRequest>,
  ) {}
  @Post('/easebuzz/refund')
  async easebuzzRefundWebhook(@Body() body: any,@Res() res: any) {
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
      type_id:refund_id,
      body: details,
      status: 'SUCCESS',
    }).save();

    try {
      const refundRequest = await this.refundRequestModel.findById(collect_id);
      if (!refundRequest) {
        console.log(`Refund request not Found`);
      }
      let status = refund_status.INITIATED;
      if (easebuzz_refund_status === 'accepted' || easebuzz_refund_status === 'refunded') {
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
      type_id:refund_id,
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


