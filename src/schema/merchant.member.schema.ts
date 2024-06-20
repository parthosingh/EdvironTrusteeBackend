import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

export enum Access {
  ADMIN = 'admin',
  MANAGEMENT = 'management',
}

@ObjectType()
@Schema({ timestamps: true })
export class MerchantMember {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  merchant_id: ObjectId;

  @Prop({})
  @Field(() => String)
  name: string;

  @Prop({})
  @Field(() => String)
  email: string;

  @Prop({})
  @Field(() => String)
  phone_number: string;

  @Field(() => String)
  @Prop({ required: true, enum: Access })
  access: string;

  @Field(() => String)
  @Prop({ required: true })
  password_hash: string;
}

export const MerchantMemberSchema =
  SchemaFactory.createForClass(MerchantMember);

// bcrypt code for hashing password salt = 10
MerchantMemberSchema.pre('save', async function (next) {
  const merchant: any = this;

  // Hash the password only if it has been modified or is new
  if (!merchant.isModified('password_hash')) {
    return next();
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(merchant.password_hash, saltRounds);

    merchant.password_hash = hash;
    next();
  } catch (error) {
    return next(error);
  }
});
