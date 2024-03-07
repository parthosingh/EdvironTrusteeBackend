import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema({timestamps:true})
export class SettlementReport extends Document {
 
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

  @Prop({ required: true, type: String})
  @Field(() => String)
  status: string;

  @Prop({ required: true, type: String})
  @Field(() => String)
  utrNumber: string;

  @Prop({ required: true, type: Date })
  @Field(() => Date)
  settlementDate: Date;

  @Prop({ required: true, type: String })
  @Field(() => String)
  merchantId: string;
}

export const SettlementSchema = SchemaFactory.createForClass(SettlementReport);
