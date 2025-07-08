import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ApiKeyLogs extends Document {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  user_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({})
  @Field(() => String)
  otp: string;

  @Prop({})
  @Field(() => String)
  email: string;

  @Prop({})
  @Field(() => String)
  time: string;

  @Prop({})
  @Field(() => String)
  ip: string;

  @Prop({})
  @Field(() => String)
  role: string;

  // Add other properties as needed
}

export const ApiKeyLogsSchema = SchemaFactory.createForClass(ApiKeyLogs);
