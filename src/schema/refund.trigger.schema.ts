import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum RefundDelayType {
  IMMEDIATE = 'IMMEDIATE',
  AFTER_24_HOURS = 'AFTER_24_HOURS',
  T_PLUS_1_9AM = 'T_PLUS_1_9AM',
}

registerEnumType(RefundDelayType, {
  name: 'RefundDelayType',
});

@ObjectType()
@Schema({ timestamps: true })
export class RefundTrigger extends Document {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: Types.ObjectId;

  @Prop({ type: String })
  @Field(() => String)
  schoolName: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: Types.ObjectId;

  @Field(() => RefundDelayType)
  @Prop({
    type: String,
    enum: RefundDelayType,
    default: RefundDelayType.IMMEDIATE,
  })
  delay_type: RefundDelayType;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export const RefundTriggerSchema = SchemaFactory.createForClass(RefundTrigger);
