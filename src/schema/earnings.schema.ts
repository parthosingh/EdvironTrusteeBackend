import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@ObjectType()
@Schema({ timestamps: true })
export class Earnings extends Document {
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
  earnings_amount: number;

  @Field()
  @Prop()
  payment_mode: string;

  @Field()
  @Prop()
  platform_type: string;
}

export const EarningsSchema = SchemaFactory.createForClass(Earnings);
