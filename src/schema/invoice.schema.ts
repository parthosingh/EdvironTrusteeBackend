import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import { bankDetails } from './trustee.schema';
export enum invoice_status {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@ObjectType()
export class sellerDetails {
  @Prop({})
  @Field(() => String)
  name: string;

  @Prop({})
  @Field(() => String)
  gst: string;

  @Prop({})
  @Field(() => String)
  residence_state: string;

  @Prop({})
  @Field(() => String)
  account_holder_name: string;

  @Prop({})
  @Field(() => String)
  account_number: string;

  @Prop({})
  @Field(() => String)
  ifsc_code: string;
}

@ObjectType()
export class buyerDetails {
  @Prop({})
  @Field(() => String)
  name: string;

  @Prop({})
  @Field(() => String)
  gst: string;

  @Prop({})
  @Field(() => String)
  address: string;

  @Prop({})
  @Field(() => String)
  placeOfSupply: string;
}

@ObjectType()
export class InvoiceData {
  @Field({ nullable: true })
  amount_without_gst: number;

  @Field({ nullable: true })
  tax: number;

  @Field({ nullable: true })
  total: number;
}

@ObjectType()
@Schema({ timestamps: true })
export class Invoice {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({})
  @Field(() => InvoiceData)
  invoice_details: InvoiceData;

  @Prop({})
  @Field(() => buyerDetails)
  buyer_details: buyerDetails;

  @Prop({})
  @Field(() => sellerDetails)
  seller_details: sellerDetails;

  @Prop({})
  @Field(() => String)
  invoice_status: invoice_status;

  @Prop({})
  @Field(() => String)
  invoice_date: string;

  @Prop({})
  @Field(() => String)
  invoice_no: string;

  @Prop({})
  @Field(() => String)
  hsn: string;

  @Prop({})
  @Field(() => String)
  note: string;

  @Prop({})
  @Field(() => String)
  duration: string;

  @Prop({})
  @Field(() => Number)
  amount: number;

  @Prop({})
  @Field(() => String)
  invoice_url: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
