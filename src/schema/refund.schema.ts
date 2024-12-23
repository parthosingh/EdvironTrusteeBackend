import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import { PlatformCharge } from './school.schema';

export enum refund_status {
  INITIATED = 'INITIATED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DELETED='DELETED BY USER',
  PROCESSING='PROCESSING',
  AUTO_REFUND_INITIATED='AUTO_REFUND_INITIATED'
}

@ObjectType()
@Schema({ timestamps: true })
export class RefundRequest {

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  order_id: ObjectId;

  @Prop()
  @Field(() =>String, {defaultValue:refund_status.INITIATED})
  status: refund_status;

  @Prop()
  @Field(() => Number, { nullable: true })
  refund_amount: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  order_amount: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  transaction_amount: number;

  @Prop()
  @Field(() => Number, { nullable: true })
  commission_amount: number;

  @Prop()
  @Field(() => String, { nullable: true })
  reason: string;

  @Prop()
  @Field(() => String, { nullable: true })
  custom_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  gateway: string;

  @Prop()
  @Field(() => String, { nullable: true })
  gatway_refund_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  additonalInfo: string;
}

export const RefundRequestSchema = SchemaFactory.createForClass(RefundRequest);
