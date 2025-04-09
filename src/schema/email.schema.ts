import { Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId, Types } from 'mongoose';
export enum EmailGroupType {
  JUNIOR_DEVS = 'JUNIOR_DEVS',
  SENIOR_DEVS = 'SENIOR_DEVS',
  MANAGEMENT = 'MANAGEMENT',
  OBSERVERS = 'OBSERVERS',
  GATEWAYS = 'GATEWAYS',
  DISPUTE = 'DISPUTE',
  TRUSTEE_DISPUTE='TRUSTEE_DISPUTE',
  TRUSTEE='TRUSTEE',
  SCHOOL='SCHOOL',
}

@Schema({ timestamps: true })
export class EmailGroup {
  @Prop({  })
  @Field(() => String)
  group_name: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: [String] })
  @Field(() => String)
  emails: string[];

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  event_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({})
  @Field(() => Boolean, { defaultValue: false })
  isCommon: boolean;
}

export const EmailGroupSchema = SchemaFactory.createForClass(EmailGroup);
