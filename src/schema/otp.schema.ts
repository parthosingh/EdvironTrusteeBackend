import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId, Types } from 'mongoose';

@Schema({ timestamps: true })
export class OTP extends Document {
  @Prop({})
  @Field(() => String)
  otp: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({})
  @Field(() => String, {nullable:true})
  type: string;

  @Prop({})
  @Field(() => String, {nullable:true})
  email: string;

  @Prop({required: true})
  @Field(() => Date)
  expiresAt: Date;

  // Add other properties as needed
}

export const OTPSchema = SchemaFactory.createForClass(OTP);

OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

