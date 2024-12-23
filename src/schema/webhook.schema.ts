import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId,Types } from 'mongoose';

@Schema({ timestamps: true })
export class WebhookLogs extends Document {
  @Prop({})
  @Field(() => String)
  type: string;

  @Prop({})
  @Field(() => String)
  gateway: string;

  @Prop({type: Types.ObjectId})
  @Field(() => ID)
  order_id: ObjectId;

  @Prop({type: Types.ObjectId})
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({type: Types.ObjectId})
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({})
  @Field(() => String)
  type_id: string;

  @Prop({})
  @Field(() => String)
  body: string;

  @Prop({})
  @Field(() => String)
  res: string;

  @Prop({})
  @Field(() => String)
  error: string;

  @Prop({})
  @Field(() => String)
  status: string;

  // Add other properties as needed
}

export const WebhookLogsSchema = SchemaFactory.createForClass(WebhookLogs);
