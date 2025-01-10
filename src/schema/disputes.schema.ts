import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@ObjectType()
@Schema({ timestamps: true })
export class Disputes extends Document {

  @Field(() => ID)
  _id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;
  
  @Field({nullable: true})
  @Prop({nullable: true})
  collect_id: string;

  @Field({nullable: true})
  @Prop()
  custom_order_id: string;

  @Field({nullable: true})
  @Prop()
  dispute_id: string;

  @Field({nullable: true})
  @Prop()
  dispute_type: string;

  @Field({nullable: true})
  @Prop()
  reason_description: string;

  @Field({nullable: true})
  @Prop()
  dispute_amount: Number;

  @Field({nullable: true})
  @Prop()
  order_amount: Number;

  @Field({nullable: true})
  @Prop()
  payment_amount: Number;

  @Field({nullable: true})
  @Prop()
  dispute_created_date: Date;
  
  @Field({nullable: true})
  @Prop()
  dispute_updated_date: Date;

  @Field({nullable: true})
  @Prop()
  dispute_respond_by_date: Date;

  @Field({nullable: true})
  @Prop()
  dispute_resolved_at_date: Date;

  @Field({nullable: true})
  @Prop()
  dispute_status: string;

  @Field({nullable: true})
  @Prop()
  dispute_remark: string;

  @Field({nullable: true})
  @Prop()
  platform_type: string;

  @Field({nullable: true})
  @Prop()
  remarks: string;
  
}

export const DisputesSchema = SchemaFactory.createForClass(Disputes);
