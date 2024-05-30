import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import { PlatformCharge } from './school.schema';

export enum mdr_status {
  INITIATED = 'INITIATED',
  PROCESSING = 'UNDER REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@ObjectType()
@Schema({ timestamps: true })
export class RequestMDR {
  @Prop()
  @Field(() => [PlatformCharge], { defaultValue: [] })
  platform_charges: PlatformCharge[];

  @Prop()
  @Field(() => [String])
  school_id: string[];

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop()
  @Field(() => String, { defaultValue: mdr_status.INITIATED })
  status: mdr_status;

  @Prop()
  @Field(() => String, { nullable: true })
  comment: string;

  @Prop()
  @Field(() => String, { nullable: true })
  description: string;

  _id: ObjectId;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export const RequestMDRSchema = SchemaFactory.createForClass(RequestMDR);
