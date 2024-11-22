import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { bankDetails } from './trustee.schema';

@ObjectType()
@Schema({ timestamps: true })
export class VendorsSettlement extends Document {
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
  utr: string;

  @Field()
  @Prop()
  vendor_id: string;

  @Prop()
  @Field(() => Number)
  adjustment: number;

  @Prop()
  @Field(() => Number)
  settlement_amount: number;

  @Prop()
  @Field(() => Number)
  vendor_transaction_amount: number;

  @Prop()
  @Field(() => Date)
  payment_from: Date;

  @Prop()
  @Field(() => Date)
  payment_till: Date;

  @Prop()
  @Field(() => Date)
  settled_on: Date;

  @Field()
  @Prop()
  settlement_id: string;

  @Field()
  @Prop()
  status: string;

  @Prop()
  @Field(() => Date)
  settlement_initiated_on: Date;
}

export const VendorsSettlementSchema =
  SchemaFactory.createForClass(VendorsSettlement);
