import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongoose';
import { Document, Types } from 'mongoose';
import { Trustee, TrusteeSchema } from './trustee.schema';

@ObjectType()
export class ReconTransactionInfo {
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
  custom_id: string;
  @Prop()
  @Field(() => Number, { nullable: true })
  order_amount: number;
  @Prop()
  @Field(() => Boolean, { nullable: true })
  inSettlements: boolean;
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
  @Prop({ required: true, type: Date })
  @Field(() => Date)
  fromDate: Date;

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  tillDate: Date;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  settlementAmount: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  totaltransactionAmount: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  merchantOtherAdjustment: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  merchantAdjustment: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  splitTransactionAmount: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  splitSettlementAmount: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  refundSum: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  vendor_refund_sum: number;

  @Prop()
  @Field(() => Number,{ nullable: true })
  payment_service_tax: number;

  @Prop()
  @Field(() => Number,{ nullable: true })
  payment_service_charge: number;

  @Prop()
  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  extraInSettlement: ReconTransactionInfo[];

  @Prop()
  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  extraInTransaction: ReconTransactionInfo[];

  @Prop()
  @Field(() => [ReconRefundInfo], { defaultValue: [] })
  refunds: ReconRefundInfo[];

  @Prop()
  @Field(() => [VendorRefunds], { defaultValue: [] })
  vendors_refunds: VendorRefunds[];

  @Prop()
  @Field(() => [vendorTransactionReconInfo], { defaultValue: [] })
  vendors_transactions: vendorTransactionReconInfo[];

  @Prop()
  @Field(() => [SettlementsTransactionsRecon], { defaultValue: [] })
  settlements_transactions: SettlementsTransactionsRecon[];

  @Prop()
  @Field(() => [DurationTransactions], { defaultValue: [] })
  duration_transactions: DurationTransactions[];

  @Prop()
  @Field(() => [otherAdjustments], { defaultValue: [] })
  other_adjustments: otherAdjustments[];

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  settlementDate: Date;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Trustee' })
  @Field(() => ID)
  trustee: ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'TrusteeSchool' })
  @Field(() => ID)
  schoolId: ObjectId;

  @Field(() => String, { nullable: true })
  @Prop({ required: true, type: String })
  school_name: string;

  @Field(() => String, { nullable: true })
  @Prop({ required: true, type: String })
  utrNumber: string;
}

export const ReconciliationSchema =
  SchemaFactory.createForClass(Reconciliation);
