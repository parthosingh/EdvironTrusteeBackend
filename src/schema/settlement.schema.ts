import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongoose';
import { Document, Types } from 'mongoose';
import { Trustee, TrusteeSchema } from './trustee.schema';

@ObjectType()
@Schema({ timestamps: true })
export class SettlementReport {
  @Prop({ required: true, type: Number })
  @Field(() => Number)
  settlementAmount: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  adjustment: number;

  @Prop({ required: true, type: Number })
  @Field(() => Number)
  netSettlementAmount: number;

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  fromDate: Date;

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  tillDate: Date;

  @Prop({ required: false, type: Date })
  @Field(() => Date,{nullable: true})
  settlement_initiated_on: Date;

  @Prop({ required: true, type: String })
  @Field(() => String)
  status: string;

  @Prop({ required: true, type: String, unique: true })
  @Field(() => String)
  utrNumber: string;

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  settlementDate: Date;

  @Prop({ required: true, type: String })
  @Field(() => String)
  clientId: string;

  @Prop({ type: String })
  @Field(() => String, { nullable: true })
  remarks: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Trustee' })
  @Field(() => ID)
  trustee: ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'TrusteeSchool' })
  @Field(() => ID)
  schoolId: ObjectId;
}

export const SettlementSchema = SchemaFactory.createForClass(SettlementReport);

const t = {
  data: {
    settlement: {
      adjustment: -1,
      amount_settled: 0,
      payment_amount: 1,
      payment_from: '2025-02-06T09:47:10+05:30',
      payment_till: '2025-02-06T09:47:10+05:30',
      reason: null,
      remarks:
        'Insufficient amount to settle. Eligible amount to initiate the settlement is greater than Rs 1.',
      service_charge: 0,
      service_tax: 0,
      settled_on: '2025-02-07T18:24:23+05:30',
      settlement_amount: 1,
      settlement_charge: 0,
      settlement_id: 124531763,
      settlement_initiated_on: null,
      settlement_tax: 0,
      settlement_type: 'NORMAL_SETTLEMENT',
      status: 'SUCCESS',
      utr: 'PGZ124531763',
    },
  },
  event_time: '2025-02-07T18:24:23+05:30',
  merchant: { merchant_id: 'CF_535ad4a4-2c80-4e6c-b3f5-d21bb0f2125b' },
  type: 'SETTLEMENT_SUCCESS',
};
