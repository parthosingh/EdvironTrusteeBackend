import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongoose';
import { Document, Types } from 'mongoose';
import { Trustee, TrusteeSchema } from './trustee.schema';

@ObjectType()
@Schema({ timestamps: true })
export class TempSettlementReport {
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

  @Prop({ required: true, type: Types.ObjectId, ref: 'Trustee' })
  @Field(() => ID)
  trustee: ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'TrusteeSchool' })
  @Field(() => ID)
  schoolId: ObjectId;
}

export const TempSettlementReportSchema =
  SchemaFactory.createForClass(TempSettlementReport);

//
const d = {
  data: {
    settlement: {
      utr: 'AXISCN0884035614',
      reason: null,
      status: 'SUCCESS',
      remarks: null,
      adjustment: 0,
      settled_on: '2025-01-11T00:40:13+05:30',
      service_tax: 0,
      payment_from: '2025-01-09T01:48:09+05:30',
      payment_till: '2025-01-09T23:44:20+05:30',
      settlement_id: 116809361,
      amount_settled: 159219,
      payment_amount: 159219,
      service_charge: 0,
      settlement_tax: 0,
      settlement_type: 'NORMAL_SETTLEMENT',
      settlement_amount: 159219,
      settlement_charge: 0,
      settlement_initiated_on: '2025-01-10T18:28:03+05:30',
    },
  },
  type: 'SETTLEMENT_SUCCESS',
  merchant: { merchant_id: 'CF_046ae58d-59d8-4bf7-816d-b75a4b556a81' },
  event_time: '2025-01-11T00:40:13+05:30',
};
