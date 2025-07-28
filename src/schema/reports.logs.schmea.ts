import { Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId, Types } from 'mongoose';
@Schema({ timestamps: true })
export class ReportsLogs extends Document {
  @Prop({ required: true })
  @Field(() => String)
  type: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({})
  @Field(() => String)
  error: string;

  @Prop({})
  @Field(() => String)
  status: string;

  @Prop({})
  @Field(() => String)
  url: string;

  @Prop({})
  @Field(() => String)
  start_date: string;

  @Prop({})
  @Field(() => String)
  end_date: string;
}

export const ReportsLogsSchema = SchemaFactory.createForClass(ReportsLogs);
