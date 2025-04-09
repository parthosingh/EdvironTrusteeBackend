import { Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId, Types } from 'mongoose';
export enum Events {
  JUNIOR_DEVS = 'JUNIOR_DEVS',
  SENIOR_DEVS = 'SENIOR_DEVS',
  MANAGEMENT = 'MANAGEMENT',
  OBSERVERS = 'OBSERVERS',
  GATEWAYS = 'GATEWAYS',
  DISPUTE = 'DISPUTE',
  TRUSTEE_DISPUTE = 'TRUSTEE_DISPUTE',
  TRUSTEE = 'TRUSTEE',
  SCHOOL = 'SCHOOL',
}

@Schema({ timestamps: true })
export class EmailEvent {
 @Prop({ enum: Events })
  @Field(() => String)
  event_name: string;

  @Prop({ type: [String] })
  @Field(() => String)
  emails: string[];

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;
}

export const EmailEventSchema = SchemaFactory.createForClass(EmailEvent);
