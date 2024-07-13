import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@ObjectType()
@Schema({ timestamps: true })
export class Commission extends Document {
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
  platform_type: string;
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);
