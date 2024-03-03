import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';


@ObjectType()
export class rangeCharge {
  @Field(() => Number, {nullable: true})
  upto: Number

  @Field(() => Number)
  charge: Number
}

@ObjectType()
export class PlatformCharge {
  @Field(() => String)
  platform_type: String

  @Field(() => String)
  payment_mode: String

  @Field(() => [rangeCharge], {nullable: true})
  range_charge: rangeCharge[]
}

@ObjectType()
@Schema({ timestamps: true })
export class TrusteeSchool {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Prop({})
  @Field(() => String)
  school_name: string;

  @Prop({})
  @Field(() => String)
  client_id: string;

  @Prop({})
  @Field(() => String)
  client_secret: string;

  @Prop({})
  @Field(() => String)
  pg_key: string;
  
  @Prop({})
  @Field(() => String)
  merchantId: string;

  @Prop({})
  @Field(() => String)
  merchantName: string;

  @Prop({})
  @Field(() => String)
  merchantEmail: string;

  @Prop({})
  @Field(() => String)
  merchantStatus: string;

  @Prop({})
  @Field(() => String)
  pgMinKYC: string;

  @Prop({})
  @Field(() => String)
  pgFullKYC: string;

  @Prop({required: true, default: []})
  @Field(() => [String])
  disabled_modes: string[];

  @Prop()
  @Field(() => [PlatformCharge], {defaultValue: []})
  platform_charges: PlatformCharge[]
}

export const SchoolSchema = SchemaFactory.createForClass(TrusteeSchool);
