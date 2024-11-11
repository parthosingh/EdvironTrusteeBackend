import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { bankDetails } from './trustee.schema';

@ObjectType()
export class kyc_details {
  @Field(() => String, { nullable: true })
  @Prop()
  account_type: string;

  @Field(() => String, { nullable: true })
  @Prop()
  business_type: string;

  @Field(() => String, { nullable: true })
  @Prop()
  uidai: string;

  @Field(() => String, { nullable: true })
  @Prop()
  gst: string;
  @Field(() => String, { nullable: true })
  @Prop()
  cin: string;

  @Field(() => String, { nullable: true })
  @Prop()
  pan: string;

  @Field(() => String, { nullable: true })
  @Prop()
  chequeUrl: string;

  @Field(() => String, { nullable: true })
  @Prop()
  passport_number: string;
}

@ObjectType()
@Schema({ timestamps: true })
export class Vendors extends Document {
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
  name: string;

  @Field()
  @Prop()
  vendor_id: string;

  @Field()
  @Prop()
  email: string;

  @Field()
  @Prop()
  cheque: string;

  @Field()
  @Prop()
  phone: string;

  @Field()
  @Prop()
  status: string;

  @Field()
  @Prop()
  schedule_option: number;

  @Prop({})
  @Field(() => bankDetails, { nullable: true })
  bank_details: bankDetails;

  @Prop({})
  @Field(() => kyc_details, { nullable: true })
  kyc_info: kyc_details;
}

export const VendorsSchema = SchemaFactory.createForClass(Vendors);
