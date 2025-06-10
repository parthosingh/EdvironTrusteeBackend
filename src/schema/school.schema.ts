import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

export enum charge_type {
  FLAT = 'FLAT',
  PERCENT = 'PERCENT',
}

export enum MinKycStatus {
  MIN_KYC_APPROVED = 'MIN_KYC_APPROVED',
  MIN_KYC_PENDING = 'MIN_KYC_PENDING',
  MIN_KYC_REJECTED = 'MIN_KYC_REJECTED',
}

export enum FullKycStatus {
  FULL_KYC_APPROVED = 'FULL_KYC_APPROVED',
  FULL_KYC_PENDING = 'FULL_KYC_PENDING',
  FULL_KYC_REJECTED = 'FULL_KYC_PENDING',
}

export enum MerchantStatus {
  NOT_INITIATED = 'Not Initiated',
  DOCUMENTS_UNDER_REVIEW = 'Documents under review',
  DOCUMENTS_REJECTED = 'Documents Rejected',
  DOCUMENTS_UPLOADED = 'Documents Uploaded',
  KYC_APPROVED = 'KYC Approved',
}

interface I_NTT_DATA {
  nttdata_id: string;
  nttdata_secret: string;
  nttdata_hash_req_key: string;
  nttdata_hash_res_key: string;
  nttdata_res_salt: string;
  nttdata_req_salt: string;
}

@ObjectType()
export class I_Worldline {
  @Field(() => String)
  merchant_code: string;

  @Field(() => String)
  encryption_key: string;

  @Field(() => String)
  encryption_iV: string;
}

registerEnumType(MinKycStatus, {
  name: 'MinKycStatus',
  description: 'Status of min kyc',
});
registerEnumType(FullKycStatus, {
  name: 'FullKycStatus',
  description: 'Status of full kyc',
});
registerEnumType(MerchantStatus, {
  name: 'MerchantStatus',
  description: 'Status of Merchant',
});

@ObjectType()
export class rangeCharge {
  @Field(() => Number, { nullable: true })
  upto: number;

  @Field(() => String)
  charge_type: charge_type;

  @Field(() => Number)
  charge: number;
}

@ObjectType()
export class PlatformCharge {
  @Field(() => String)
  platform_type: string;

  @Field(() => String)
  payment_mode: string;

  @Field(() => [rangeCharge], { defaultValue: [] })
  range_charge: rangeCharge[];
}


export enum DisabledModes {
  CARDLESS = "cardless",
  PAY_LATER = "pay_later",
  WALLET="wallet",
  NET_BANKING="net_banking",
  UPI="upi",
  CREDIT_CARD="credit_card",
  DEBIT_CARD="debit_card",
  CARD='card'
}

@ObjectType()
export class bank_Details {
  @Field(() => String, { nullable: true })
  @Prop()
  account_holder_name: string;

  @Field(() => String, { nullable: true })
  @Prop()
  account_number: string;

  @Field(() => String, { nullable: true })
  @Prop()
  ifsc_code: string;

  @Field(() => String, { nullable: true })
  @Prop()
  beneficiary_bank_and_address: string;
}

@ObjectType()
export class gatewaysEmails{
  @Field(() => String, { nullable: true })
  @Prop()
  cashfree: string;

  @Field(() => String, { nullable: true })
  @Prop()
  easebuzz: string;

  @Field(() => String, { nullable: true })
  @Prop()
  razorpay: string;

  @Field(() => String, { nullable: true })
  @Prop()
  pay_u: string;
}


@ObjectType()
export class isNotificationOn{
  @Field(() => Boolean, { nullable: true })
  @Prop({ default: false })
  for_transaction: Boolean;

  @Field(() => Boolean, { nullable: true })
  @Prop({ default: false })
  for_refund: Boolean;

  @Field(() => Boolean, { nullable: true })
  @Prop({ default: false })
  for_settlement: Boolean;
}

@ObjectType()
@Schema({ timestamps: true })
export class TrusteeSchool {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({})
  @Field(() => String)
  school_name: string;

  @Prop({})
  @Field(() => String)
  client_id: string;

  @Prop({})
  @Field(() => String)
  client_secret: string;

  @Prop({})
  @Field(() => String)
  pg_key: string;

  @Prop({})
  @Field(() => String)
  merchantId: string;

  @Prop({})
  @Field(() => String, { nullable: true })
  residence_state: string;

  @Prop({})
  @Field(() => bank_Details, { nullable: true })
  bank_details: bank_Details;

  @Prop({})
  @Field(() => gatewaysEmails, { nullable: true })
  gatewaysMail: gatewaysEmails;

  @Prop()
  @Field(() => isNotificationOn, { nullable: true })
  isNotificationOn: isNotificationOn;

  @Prop({})
  @Field(() => String, { nullable: true })
  gstIn: string;

  @Prop({})
  @Field(() => String)
  merchantName: string;

  @Prop({})
  @Field(() => String)
  merchantEmail: string;

  @Prop({ enum: MerchantStatus, default: MerchantStatus.NOT_INITIATED })
  @Field(() => MerchantStatus)
  merchantStatus: MerchantStatus;

  @Prop({ enum: MinKycStatus, default: MinKycStatus.MIN_KYC_PENDING })
  @Field(() => MinKycStatus)
  pgMinKYC: MinKycStatus;

  @Prop({ enum: FullKycStatus, default: FullKycStatus.FULL_KYC_PENDING })
  @Field(() => FullKycStatus)
  pgFullKYC: FullKycStatus;

  @Prop({ type: [String], required: true, enum: DisabledModes, default: [], })
  @Field(() => [String])
  disabled_modes: DisabledModes[];

  @Prop()
  @Field(() => [PlatformCharge], { defaultValue: [] })
  platform_charges: PlatformCharge[];

  @Prop({})
  @Field(() => String)
  email: string;

  @Prop()
  @Field(() => String)
  password_hash: string;

  @Prop({})
  @Field(() => String)
  phone_number: string;

  @Prop({})
  @Field(() => String)
  vendor_id: string;

  @Prop({})
  @Field(() => String)
  easebuzz_id: string;

  @Prop({})
  @Field(() => String)
  ccavenue_merchant_id: string;

  @Prop({})
  @Field(() => String)
  ccavenue_access_code: string;

  @Prop({})
  @Field(() => String)
  ccavenue_working_key: string;

  @Prop({})
  @Field(() => Boolean, { defaultValue: false })
  isCcavenue: boolean;

  @Prop({})
  @Field(() => Boolean, { defaultValue: false })
  isVendor: boolean;

  @Prop({})
  @Field(() => Boolean, { defaultValue: false })
  isAdjustment: boolean;

  @Prop({})
  @Field(() => Number)
  minAdjustmnentAmount: number;

  @Prop({})
  @Field(() => Number)
  maxAdjustmnentAmount: number;

  @Prop({})
  @Field(() => Number)
  targetAdjustmnentAmount: number;

  @Prop({})
  @Field(() => Number, { defaultValue: 0 })
  adjustedAmount: number;

  @Prop({})
  @Field(() => String)
  adjustment_vendor_id: string;

  @Prop({})
  @Field(() => Boolean, { defaultValue: false })
  advanceAdjustment: boolean;

  
  @Prop({})
  @Field(() => Boolean, { defaultValue: false })
  isVBAActive: boolean;

  @Field({ nullable: true })
  @Prop()
  logo: string;

  @Prop({})
  @Field(() => String)
  super_admin_name: string;

  @Prop({})
  @Field(() => String)
  smartgateway_merchant_id: string;

  @Prop({})
  @Field(() => String)
  smart_gateway_api_key: string;

  @Prop({})
  @Field(() => String)
  smartgateway_customer_id: string;

  @Prop({})
  @Field(() => String)
  hdfc_razorpay_id: string;

  @Prop({})
  @Field(() => String)
  hdfc_razorpay_secret: string;

  @Prop({})
  @Field(() => String)
  hdfc_razorpay_mid: string;

  @Prop({})
  @Field(() => String)
  pay_u_key: string;

  @Prop({})
  @Field(() => String)
  pay_u_salt: string;

   @Prop({})
  @Field(() => String)
  easebuzz_split_label: string;

  @Prop({
    required: false,
    type: {
      nttdata_id: { type: String, required: false, default: null },
      nttdata_secret: { type: String, required: false, default: null },
      nttdata_hash_req_key: { type: String, required: false, default: null },
      nttdata_hash_res_key: { type: String, required: false, default: null },
      nttdata_res_salt: { type: String, required: false, default: null },
      nttdata_req_salt: { type: String, required: false, default: null },
    },
    _id: false,
  })
  ntt_data: I_NTT_DATA;
  
  @Prop({})
  @Field(() => I_Worldline, { nullable: true })
  worldline: I_Worldline;


  @Field()
  @Prop()
  easebuzz_school_label: string;

  @Prop({})
  @Field(() => String)
  cf_x_client_id: string;

  @Prop({})
  @Field(() => String)
  cf_x_client_secret: string;

  
  @Prop({})
  @Field(() => String,{ nullable: true })
  kyc_mail: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SchoolSchema = SchemaFactory.createForClass(TrusteeSchool);

// bcrypt code for hashing password salt = 10
SchoolSchema.pre('save', async function (next) {
  const school: any = this;

  // Hash the password only if it has been modified or is new
  if (!school.isModified('password_hash')) {
    return next();
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(school.password_hash, saltRounds);

    school.password_hash = hash;
    next();
  } catch (error) {
    return next(error);
  }
});
