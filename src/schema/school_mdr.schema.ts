import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import { PlatformCharge, charge_type, rangeCharge } from './school.schema';

const defaultCharges = [
  {
    platform_type: 'UPI',
    payment_mode: 'Others',
    range_charge: [
      { upto: 2000, charge_type: charge_type.FLAT, charge: 0 },
      { upto: null, charge_type: charge_type.FLAT, charge: 0 },
    ],
  },
  {
    platform_type: 'DebitCard',
    payment_mode: 'Others',
    range_charge: [
      { upto: 2000, charge_type: charge_type.FLAT, charge: 0 },
      { upto: null, charge_type: charge_type.FLAT, charge: 0 },
    ],
  },
  {
    platform_type: 'NetBanking',
    payment_mode: 'Others',
    range_charge: [
      { upto: 2000, charge_type: charge_type.FLAT, charge: 0 },
      { upto: null, charge_type: charge_type.FLAT, charge: 0 },
    ],
  },
  {
    platform_type: 'CreditCard',
    payment_mode: 'Others',
    range_charge: [
      { upto: 2000, charge_type: charge_type.FLAT, charge: 0 },
      { upto: null, charge_type: charge_type.FLAT, charge: 0 },
    ],
  },
  {
    platform_type: 'Wallet',
    payment_mode: 'Others',
    range_charge: [
      { upto: 2000, charge_type: charge_type.FLAT, charge: 0 },
      { upto: null, charge_type: charge_type.FLAT, charge: 0 },
    ],
  },
  {
    platform_type: 'PayLater',
    payment_mode: 'Others',
    range_charge: [
      { upto: 2000, charge_type: charge_type.FLAT, charge: 0 },
      { upto: null, charge_type: charge_type.FLAT, charge: 0 },
    ],
  },
  {
    platform_type: 'C ',
    payment_mode: 'Others',
    range_charge: [
      { upto: 2000, charge_type: charge_type.FLAT, charge: 0 },
      { upto: null, charge_type: charge_type.FLAT, charge: 0 },
    ],
  },
];
@ObjectType()
@Schema({ timestamps: true })
export class SchoolMdr {
  @Prop()
  @Field(() => [PlatformCharge], { defaultValue: defaultCharges })
  mdr2: PlatformCharge[];

  @Prop({ type: Types.ObjectId, ref: 'School' })
  @Field(() => ID)
  school_id: ObjectId;
}

export const BaseMdrSchema = SchemaFactory.createForClass(SchoolMdr);
