import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongoose';
import { Document, Types } from 'mongoose';
import { Trustee, TrusteeSchema } from './trustee.schema';

@ObjectType()
export class ReconTransactionInfo {
  @Field(() => String, { nullable: true })
  collect_id: string;

  @Field(() => String, { nullable: true })
  createdAt: string;

  @Field(() => String, { nullable: true })
  updatedAt: string;

  @Field(() => String, { nullable: true })
  payment_time: string;

  @Field(() => String, { nullable: true })
  custom_id: string;

  @Field(() => Number, { nullable: true })
  order_amount: number;
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

  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  extraInSettlement: ReconTransactionInfo[];

  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  extraInTransaction: ReconTransactionInfo[];

  @Field(() => [ReconTransactionInfo], { defaultValue: [] })
  refunds: ReconTransactionInfo[];

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  settlementDate: Date;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Trustee' })
  @Field(() => ID)
  trustee: ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'TrusteeSchool' })
  @Field(() => ID)
  schoolId: ObjectId;
}

export const ReconciliationSchema =
  SchemaFactory.createForClass(Reconciliation);
