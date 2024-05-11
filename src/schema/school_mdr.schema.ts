import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import { PlatformCharge, charge_type, rangeCharge } from './school.schema';


@ObjectType()
@Schema({ timestamps: true })
export class SchoolMdr {
  @Prop()
  @Field(() => [PlatformCharge])
  mdr2: PlatformCharge[];

  @Prop({ type: Types.ObjectId, ref: 'School' })
  @Field(() => ID)
  school_id: ObjectId;
}

export const SchoolMdrSchema = SchemaFactory.createForClass(SchoolMdr);
