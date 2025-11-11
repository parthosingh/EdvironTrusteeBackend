import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CommissionWithGstDto, CommissionWithoutGstDto, EarningBreakup, MdrAmountStoreDto, MdrStoreDto } from './commission.schema';

@ObjectType()
export class CommissionGstDto {
  @Field(() => Number)
  erp_commission_gst: number;

  @Field(() => Number, { nullable: true }) //Edviron buying rates - trustee base rate
  edviron_earning_base_gst: number;

  @Field(() => Number, { nullable: true }) // Trustee final rates - school final rate(in payments backend)
  edviron_earning_school_gst: number;

  @Field(() => Number, { nullable: true }) // edviron_earning_base + edviron_earning_school | without GST
  edviron_earning_gst: number;

  @Field(() => Number, { nullable: true }) // erp_commission + edviron_earning | without GST
  total_commission_gst: number;
}

@ObjectType()
@Schema({ timestamps: true })
export class CommissionEarning extends Document {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  collect_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Field()
  @Prop()
  commission_amount: number;

  @Field({ defaultValue: 'Commission' })
  @Prop()
  commission_namae: string;

  @Field()
  @Prop()
  payment_mode: string;

  @Field()
  @Prop()
  gateway: string;

  @Field()
  @Prop()
  platform_type: string;

  @Field(() => MdrStoreDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  mdr: MdrStoreDto;

  @Field(() => MdrAmountStoreDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  mdr_amount: MdrAmountStoreDto;

  @Field(() => CommissionWithoutGstDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  commission_without: CommissionWithoutGstDto;

   @Field(() => CommissionGstDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  commission_gst: CommissionGstDto;

  @Field(() => CommissionWithGstDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  commission_with_gst: CommissionWithGstDto;

  @Field(() => EarningBreakup, { nullable: true })
  @Prop({ type: Object, nullable: true })
  earning_breakup: EarningBreakup;
}

export const CommissionEarningSchema = SchemaFactory.createForClass(CommissionEarning);
