import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongoose';
import { Document, Types } from 'mongoose';
import { Trustee, TrusteeSchema } from './trustee.schema';
import { RefundRequest } from './refund.schema';

    const dummy={
                    "custom_order_id": "EDVIRON42025102900393300068",
                    "order_id": "690114ef5a77d55e79117b8c",
                    "event_status": "SUCCESS",
                    "event_settlement_amount": 20236,
                    "order_amount": 20236,
                    "event_amount": 20462.84,
                    "event_time": "2025-10-29T00:41:52+05:30",
                    "payment_group": "CREDIT_CARD",
                    "settlement_utr": "AXISCN1136869959",
                    "student_id": "150174186",
                    "school_name": "BALDWIN GIRLS HIGH SCHOOL",
                    "student_name": "RABIYA IRAM KHAN",
                    "student_email": "ARSHISTARZ@GMAIL.COM",
                    "student_phone_no": "9964123045",
                    "school_id": "67ea89a4498210d65b537832",
                    "additional_data": "{\"student_details\":{\"student_id\":\"150174186\",\"student_email\":\"ARSHISTARZ@GMAIL.COM\",\"student_name\":\"RABIYA IRAM KHAN\",\"student_phone_no\":\"9964123045\"},\"additional_fields\":{\"uid1\":\"150174186\",\"uid2\":\"9\",\"uid3\":\"4\",\"uid4\":\"98\",\"uid5\":\"0,3\",\"uid6\":\"8\",\"uid7\":\"9964123045\"}}",
                    "payment_id": "4509119263",
                    "__typename": "SettlementsTransactions"
                }

@ObjectType()
export class ReconTransactionInfoV2 {
  @Prop()
  @Field(() => String, { nullable: true })
  collect_id: string;
  @Prop()
  @Field(() => String, { nullable: true })
  createdAt: string;
  @Prop()
  @Field(() => String, { nullable: true })
  updatedAt: string;
  @Prop()
  @Field(() => String, { nullable: true })
  payment_time: string;
  @Prop()
  @Field(() => String, { nullable: true })
  custom_order_id: string;
  @Prop()
  @Field(() => Number, { nullable: true })
  order_amount: number;
  @Field(() => Number, { nullable: true })
  transaction_amount: number;
  @Prop()
  @Field(() => Boolean, { nullable: true })
  inSettlements: boolean;
  @Field(() => String, { nullable: true })
  additional_info: string;

  @Field(() => String, { nullable: true })
  event_type: string;

  @Field(() => [RefundRequest], { nullable: true })
  refunds: RefundRequest[]
}

@ObjectType()
export class ReconTransactionInfo {
  @Prop()
  @Field(() => String, { nullable: true })
  custom_order_id: string; // "EDVIRON42025102900393300068"

  @Prop()
  @Field(() => String, { nullable: true })
  order_id: string; // "690114ef5a77d55e79117b8c"

  @Prop()
  @Field(() => String, { nullable: true })
  event_status: string; // "SUCCESS"

  @Prop()
  @Field(() => Number, { nullable: true })
  event_settlement_amount: number; // 20236

  @Prop()
  @Field(() => Number, { nullable: true })
  order_amount: number; // 20236

  @Prop()
  @Field(() => Number, { nullable: true })
  event_amount: number; // 20462.84

  @Prop()
  @Field(() => String, { nullable: true })
  event_time: string; // "2025-10-29T00:41:52+05:30"

  @Prop()
  @Field(() => String, { nullable: true })
  payment_group: string; // "CREDIT_CARD"

  @Prop()
  @Field(() => String, { nullable: true })
  settlement_utr: string; // "AXISCN1136869959"

  @Prop()
  @Field(() => String, { nullable: true })
  student_id: string; // "150174186"

  @Prop()
  @Field(() => String, { nullable: true })
  school_name: string; // "BALDWIN GIRLS HIGH SCHOOL"

  @Prop()
  @Field(() => String, { nullable: true })
  student_name: string; // "RABIYA IRAM KHAN"

  @Prop()
  @Field(() => String, { nullable: true })
  student_email: string; // "ARSHISTARZ@GMAIL.COM"

  @Prop()
  @Field(() => String, { nullable: true })
  student_phone_no: string; // "9964123045"

  @Prop()
  @Field(() => String, { nullable: true })
  school_id: string; // "67ea89a4498210d65b537832"

  @Prop()
  @Field(() => String, { nullable: true })
  additional_data: string; // JSON string

  @Prop()
  @Field(() => String, { nullable: true })
  payment_id: string; // "4509119263"

  @Prop()
  @Field(() => String, { nullable: true })
  typename: string; // "__typename": "SettlementsTransactions"

  // optional common fields
  @Prop()
  @Field(() => String, { nullable: true })
  createdAt?: string;

  @Prop()
  @Field(() => String, { nullable: true })
  updatedAt?: string;

  // placeholder for additional event-type mapping or refunds if applicable
  @Field(() => [RefundRequest], { nullable: true })
  refunds?: RefundRequest[];
}


@ObjectType()
export class VendorSplit {
  @Prop()
  @Field(() => String, { nullable: true })
  vendor_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  vendor_name: string;

  @Prop()
  @Field(() => Number, { nullable: true })
  amount: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  percentage: number;
}

@ObjectType()
export class otherAdjustments {
  @Prop()
  @Field(() => Number, { nullable: true })
  event_amount: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  event_settlement_amount: number;

  @Prop()
  @Field(() => String, { nullable: true })
  event_time: string;

  @Prop()
  @Field(() => String, { nullable: true })
  settlement_utr: string;

  @Prop()
  @Field(() => String, { nullable: true })
  adjustment_remarks: string;
}

@ObjectType()
export class ReconRefundInfo {
  @Prop()
  @Field(() => String, { nullable: true })
  custom_order_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  collect_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  createdAt: string;

  @Prop()
  @Field(() => String, { nullable: true })
  updatedAt: string;

  @Prop()
  @Field(() => String, { nullable: true })
  payment_time: string;

  @Prop()
  @Field(() => Number, { nullable: true })
  order_amount: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  refund_amount: number;

  @Prop()
  @Field(() => Boolean, { nullable: true })
  inSettlements: boolean;

  @Field(() => Boolean, { nullable: true })
  isSplitRefund: boolean;

  @Prop()
  @Field(() => String, { nullable: true })
  utr: string;

  @Field(() => Boolean, { nullable: true })
  isChargeBack: boolean;
}

@ObjectType()
export class vendorTransactionReconInfo {
  @Prop()
  @Field(() => String, { nullable: true })
  collect_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  custom_order_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  vendorName: string;

  @Prop()
  @Field(() => Number, { nullable: true })
  splitAmount: number; // Use `number` instead of `Number`

  @Prop()
  @Field(() => Number, { nullable: true })
  order_amount: number;

  @Prop()
  @Field(() => String, { nullable: true })
  transactionTime: string;
}

@ObjectType()
export class SettlementsTransactionsRecon {
  @Field(() => String, { nullable: true })
  collect_id: string;

  @Field(() => Number, { nullable: true })
  order_amount: number;

  @Field(() => String, { nullable: true })
  payment_time: string;

  @Field(() => String, { nullable: true })
  event_type: string;

  @Field(() => String, { nullable: true })
  custom_order_id: string;

  @Field(() => String, { nullable: true })
  student_name: string;

  @Field(() => String, { nullable: true })
  student_phone_no: string;

  @Field(() => String, { nullable: true })
  student_email: string;

  @Field(() => String, { nullable: true })
  payment_group: string;
}

@ObjectType()
export class DurationTransactions {
  @Field(() => String, { nullable: true })
  collect_id: string;

  @Field(() => Number, { nullable: true })
  order_amount: number;

  @Field(() => String, { nullable: true })
  payment_time: string;

  @Field(() => String, { nullable: true })
  custom_order_id: string;

  @Field(() => String, { nullable: true })
  payment_method: string;

  @Field(() => String, { nullable: true })
  additional_data: string;

  @Prop()
  @Field(() => String, { nullable: true })
  createdAt: string;
  @Prop()
  @Field(() => String, { nullable: true })
  updatedAt: string;

  @Prop()
  @Field(() => [VendorSplit], { nullable: true })
  vendors_info: VendorSplit[];
}

@ObjectType()
export class VendorRefunds {
  @Field(() => String, { nullable: true })
  collect_id: string;

  @Field(() => String, { nullable: true })
  vendor_id: string;

  @Field(() => String, { nullable: true })
  vendor_name: string;

  @Field(() => Number, { nullable: true })
  refund_amount: number;

  @Field(() => Number, { nullable: true })
  split_amount: number;
}

@ObjectType()
@Schema({ timestamps: true })
export class Reconciliation {
  @Prop({ nullable: true, type: Date })
  @Field(() => Date)
  fromDate: Date;

  @Prop({ nullable: true, type: Date })
  @Field(() => Date)
  tillDate: Date;

  @Prop({ nullable: true, type: Number })
  @Field(() => Number, { nullable: true })
  settlementAmount: number;

  @Prop({ nullable: true, type: Number })
  @Field(() => Number, { nullable: true })
  totaltransactionAmount: number;

  @Prop({ nullable: true, type: Number })
  @Field(() => Number, { nullable: true })
  totalOrderAmount: number;

  @Prop({ nullable: true, type: Number })
  @Field(() => Number, { nullable: true })
  merchantOtherAdjustment: number;

  @Prop({ nullable: true, type: Number })
  @Field(() => Number, { nullable: true })
  totalAdjustmentAmount: number;

  @Prop({ nullable: true, type: Number })
  @Field(() => Number, { nullable: true })
  refundSum: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  payment_service_tax: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  payment_service_charge: number;

  @Prop()
  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  transactions: ReconTransactionInfo[];

  @Prop()
  @Field(() => [ReconRefundInfo], { defaultValue: [] })
  refunds: ReconRefundInfo[];

  @Prop()
  @Field(() => [ReconRefundInfo], { defaultValue: [] })
  chargeBacks: ReconRefundInfo[];

  @Prop()
  @Field(() => [otherAdjustments], { defaultValue: [] })
  other_adjustments: otherAdjustments[];

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  settlementDate: Date;

  @Prop({ required: false, type: Types.ObjectId, ref: 'Trustee' })
  @Field(() => ID)
  trustee: ObjectId;

  @Prop({ required: false, type: Types.ObjectId, ref: 'TrusteeSchool' })
  @Field(() => ID)
  schoolId: ObjectId;

  @Field(() => String, { nullable: true })
  @Prop({ required: false, type: String })
  school_name: string;

  @Field(() => String, { nullable: true })
  @Prop({ required: true, type: String })
  utrNumber: string;

  @Prop({ type: String })
  @Field(() => String, { nullable: true })
  remarks: string;
}

export const ReconciliationSchema =
  SchemaFactory.createForClass(Reconciliation);

