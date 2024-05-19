import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import { PlatformCharge, rangeCharge } from './school.schema';

@ObjectType()
@Schema({ timestamps: true })
export class BaseMdr {
  @Prop()
  @Field(() => [PlatformCharge], { defaultValue: [] })
  platform_charges: PlatformCharge[];

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop()
  @Field(() => String)
  comment: string;
}

export const BaseMdrSchema = SchemaFactory.createForClass(BaseMdr);
