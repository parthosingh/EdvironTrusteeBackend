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

  @Prop()
  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  extraInSettlement: ReconTransactionInfo[];

  @Prop()
  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  extraInTransaction: ReconTransactionInfo[];

  @Prop()
  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  refunds: ReconTransactionInfo[];

  @Prop()
  @Field(() => [vendorTransactionReconInfo], { defaultValue: [] })
  vendors_transactions: vendorTransactionReconInfo[];

  @Prop()
  @Field(() => [SettlementsTransactionsRecon], { defaultValue: [] })
  settlements_transactions: SettlementsTransactionsRecon[];

  @Prop()
  @Field(() => [DurationTransactions], { defaultValue: [] })
  duration_transactions: DurationTransactions[];

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
}

export const ReconciliationSchema =
  SchemaFactory.createForClass(Reconciliation);
