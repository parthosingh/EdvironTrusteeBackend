import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@ObjectType()
@Schema({ timestamps: true })
export class Capture extends Document {
  @Field(() => ID)
  _id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Field({ nullable: true })
  @Prop({ nullable: true })
  collect_id: string;

  @Field({ nullable: true })
  @Prop()
  custom_order_id: string;

  @Field({ nullable: true })
  @Prop()
  order_amount: Number;

  @Field({ nullable: true })
  @Prop()
  payment_amount: Number;

  @Field({ nullable: true })
  @Prop()
  action: string;

  @Field({ nullable: true })
  @Prop()
  capture_status: string;

  @Field({ nullable: true })
  @Prop()
  capture_start_date: Date;

  @Field({ nullable: true })
  @Prop()
  capture_end_date: Date;

  @Field({ nullable: true })
  @Prop()
  approve_by: Date;

  @Field({ nullable: true })
  @Prop()
  action_reference: string;

  @Field({ nullable: true })
  @Prop()
  capture_amount: number;

  @Field({ nullable: true })
  @Prop()
  is_captured: boolean;

  @Field({ nullable: true })
  @Prop()
  error_details: string;

  @Field({ nullable: true })
  @Prop()
  auth_id: string;

  @Field({ nullable: true })
  @Prop()
  bank_reference: string;
}

export const CaptureSchema = SchemaFactory.createForClass(Capture);
