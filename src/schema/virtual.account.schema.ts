import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId, Types } from 'mongoose';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StudentDetails {
  @Field(() => String)
  student_id: string;

  @Field(() => String)
  student_email: string;

  @Field(() => String)
  student_number: string;

  @Field(() => String)
  student_name: string;
}

@ObjectType()
@Schema({ timestamps: true })
export class VirtualAccount {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop()
  @Field(() => String, { nullable: true })
  collect_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  student_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  student_email: string;

  @Prop()
  @Field(() => String, { nullable: true })
  student_number: string;

  @Prop()
  @Field(() => String, { nullable: true })
  notification_group: string;

  @Prop()
  @Field(() => String, { nullable: true })
  student_name: string;

  @Prop()
  @Field(() => String, { nullable: true })
  virtual_account_number: string;

  @Prop()
  @Field(() => String, { nullable: true })
  virtual_account_ifsc: string;

  @Field()
  @Prop()
  min_amount: number;

  @Field()
  @Prop()
  max_amount: number;

  @Prop()
  @Field(() => String, { nullable: true })
  virtual_account_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  status: string;

  @Prop()
  @Field(() => String, { nullable: true })
  account_number: string;

  @Prop()
  @Field(() => String, { nullable: true })
  ifsc_code: string;

  @Prop()
  @Field(() => String, { nullable: true })
  gateway: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VirtualAccountSchema =
  SchemaFactory.createForClass(VirtualAccount);
