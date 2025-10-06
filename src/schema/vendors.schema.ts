import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { bankDetails } from './trustee.schema';

@ObjectType()
export class kyc_details {
  @Field(() => String, { nullable: true })
  @Prop()
  account_type: string;

  @Field(() => String, { nullable: true })
  @Prop()
  business_type: string;

  @Field(() => String, { nullable: true })
  @Prop()
  uidai: string;

  @Field(() => String, { nullable: true })
  @Prop()
  gst: string;
  @Field(() => String, { nullable: true })
  @Prop()
  cin: string;

  @Field(() => String, { nullable: true })
  @Prop()
  pan: string;

  @Field(() => String, { nullable: true })
  @Prop()
  chequeUrl: string;

  @Field(() => String, { nullable: true })
  @Prop()
  passport_number: string;
}

@ObjectType()
export class vendorBankDetails {
  @Field(() => String, { nullable: true })
  @Prop()
  account_holder: string;

  @Field(() => String, { nullable: true })
  @Prop()
  account_number: string;

  @Field(() => String, { nullable: true })
  @Prop()
  ifsc: string;
}


// export enum GATEWAY {
//   CASHFREE = 'CASHFREE',
//   EASEBUZZ = 'EASEBUZZ',
//   WORLDLINE = 'WORLDLINE',
// }


export enum GATEWAY {
  CASHFREE = 'CASHFREE',
  EASEBUZZ = 'EASEBUZZ',
  WORLDLINE = 'WORLDLINE',
  RAZORPAY='RAZORPAY'
}

@ObjectType()
export class razorpayVendor {
  @Field(() => String, { nullable: true })
  @Prop()
  account: string
  ifsc: string;
}

@ObjectType()
@Schema({ timestamps: true })
export class Vendors extends Document {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Field()
  @Prop()
  client_id: string;

  @Field()
  @Prop()
  name: string;

  @Field()
  @Prop()
  vendor_id: string;

  @Field()
  @Prop()
  easebuzz_vendor_id: string;

  @Prop({})
  @Field(()=> razorpayVendor,{nullable:true})
  razorpayVendor:razorpayVendor

  @Field()
  @Prop()
  email: string;

  @Field()
  @Prop()
  cheque: string;

  @Field()
  @Prop()
  phone: string;

  @Field()
  @Prop()
  status: string;

  @Field()
  @Prop()
  schedule_option: number;

  @Prop({})
  @Field(() => vendorBankDetails, { nullable: true })
  bank_details: vendorBankDetails;

  @Field()
  @Prop()
  worldline_vendor_id: string;

  @Field()
  @Prop()
  worldline_vendor_name: string;

  @Prop({})
  @Field(() => kyc_details, { nullable: true })
  kyc_info: kyc_details;

  @Prop({ type: [String], enum: GATEWAY, default: [] })
  @Field(() => [String], { nullable: true })
  gateway: GATEWAY[];
}

export const VendorsSchema = SchemaFactory.createForClass(Vendors);

const u = {
  id: 'evt_V2_ebdf7fe0f8994efa9e89666b2c069a30',
  date_created: '2025-05-12T06:36:41Z',
  content: {
    order: {
      udf4: '',
      emi_details: {
        bank: null,
        monthly_payment: null,
        interest: null,
        conversion_details: null,
        principal_amount: null,
        additional_processing_fee_info: null,
        tenure: null,
        subvention_info: [],
        emi_type: null,
        processed_by: null,
      },
      udf8: '',
      udf3: '',
      udf6: '',
      offers: [],
      status: 'NEW',
      order_expiry: '2025-05-12T06:51:40Z',
      id: 'ordeh_102d0dffc04543bfbcfc0e2497770462',
      return_url: 'https://dev-payments.edviron.com/smartgateway/callback',
      last_updated: '2025-05-12T06:36:40Z',
      conflicted: false,
      metadata: {
        order_expiry: '2025-05-12T06:51:40Z',
        payment_page_client_id: 'hdfcmaster',
        payment_links: {
          mobile:
            'https://smartgatewayuat.hdfcbank.com/payment-page/order/ordeh_102d0dffc04543bfbcfc0e2497770462',
          web: 'https://smartgatewayuat.hdfcbank.com/payment-page/order/ordeh_102d0dffc04543bfbcfc0e2497770462',
          iframe:
            'https://smartgatewayuat.hdfcbank.com/payment-page/order/ordeh_102d0dffc04543bfbcfc0e2497770462',
        },
        merchant_payload: {
          displayBusinessAs: 'SHAHABAD PARISH SOCIETY',
          customerEmail: 'test@mail.com',
          customerPhone: 8604613494,
        },
        payment_page_sdk_payload: {
          firstName: 'John',
          displayBusinessAs: 'SHAHABAD PARISH SOCIETY',
          currency: 'INR',
          customerEmail: 'test@mail.com',
          customerPhone: 8604613494,
          service: 'in.juspay.hyperpay',
          description: 'Testing HDFC Smartgateway',
          lastName: 'wick',
          amount: 1,
          action: 'paymentPage',
          collectAvsInfo: false,
        },
      },
      currency: 'INR',
      date_created: '2025-05-12T06:36:40Z',
      udf2: '',
      payment_links: {
        mobile:
          'https://smartgatewayuat.hdfcbank.com/payment-page/order/ordeh_102d0dffc04543bfbcfc0e2497770462',
        web: 'https://smartgatewayuat.hdfcbank.com/payment-page/order/ordeh_102d0dffc04543bfbcfc0e2497770462',
        iframe:
          'https://smartgatewayuat.hdfcbank.com/payment-page/order/ordeh_102d0dffc04543bfbcfc0e2497770462',
      },
      customer_email: 'test@mail.com',
      customer_phone: '8604613494',
      udf5: '',
      status_id: 10,
      merchant_id: 'SG2572',
      udf9: '',
      amount: 1,
      refunded: false,
      order_id: '682196f8c9c5d71b48eb1f68',
      udf7: '',
      additional_info: {},
      udf10: '',
      effective_amount: 1,
      product_id: '',
      customer_id: 'test-customer',
      amount_refunded: 0,
      udf1: '',
    },
  },
  event_name: 'ORDER_CREATED',
};
