import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

export enum charge_type {
  FLAT = 'FLAT',
  PERCENT = 'PERCENT',
}


export enum MinKycStatus {
  MIN_KYC_APPROVED  = 'MIN_KYC_APPROVED',
  MIN_KYC_PENDING = 'MIN_KYC_PENDING',
  MIN_KYC_REJECTED = 'MIN_KYC_REJECTED',
}

export enum FullKycStatus {
  FULL_KYC_APPROVED  = 'FULL_KYC_APPROVED',
  FULL_KYC_PENDING = 'FULL_KYC_PENDING',
  FULL_KYC_REJECTED = 'FULL_KYC_PENDING',
}

export enum MerchantStatus {
  NOT_INITIATED  = 'Not Initiated',
  DOCUMENTS_UNDER_REVIEW = 'Documents under review',
  DOCUMENTS_REJECTED = 'Documents Rejected',
  DOCUMENTS_UPLOADED = 'Documents Uploaded',
  KYC_APPROVED = 'KYC Approved'
}

registerEnumType(MinKycStatus, {
  name: 'MinKycStatus',
  description: 'Status of min kyc',
});
registerEnumType(FullKycStatus, {
  name: 'FullKycStatus',
  description: 'Status of full kyc',
});
registerEnumType(MerchantStatus, {
  name: 'MerchantStatus',
  description: 'Status of Merchant',
});


@ObjectType()
export class rangeCharge {
  @Field(() => Number, { nullable: true })
  upto: number;

  @Field(() => String)
  charge_type: charge_type;

  @Field(() => Number)
  charge: number;
}

@ObjectType()
export class PlatformCharge {
  @Field(() => String)
  platform_type: string;

  @Field(() => String)
  payment_mode: string;

  @Field(() => [rangeCharge], { defaultValue: [] })
  range_charge: rangeCharge[];
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

  @Prop({enum:MerchantStatus,default:MerchantStatus.NOT_INITIATED})
  @Field(() => MerchantStatus)
  merchantStatus: MerchantStatus;

  @Prop({enum:MinKycStatus, default:MinKycStatus.MIN_KYC_PENDING})
  @Field(() => MinKycStatus)
  pgMinKYC: MinKycStatus;

  @Prop({enum:FullKycStatus, default:FullKycStatus.FULL_KYC_PENDING})
  @Field(() => FullKycStatus)
  pgFullKYC: FullKycStatus;

  @Prop({ required: true, default: [] })
  @Field(() => [String])
  disabled_modes: string[];

  @Prop()
  @Field(() => [PlatformCharge], { defaultValue: [] })
  platform_charges: PlatformCharge[];

  @Prop({})
  @Field(() => String)
  email: string;

  @Prop()
  @Field(() => String)
  password_hash: string;

  @Prop({})
  @Field(() => String)
  phone_number: string;

  @Prop({})
  @Field(() => String)
  super_admin_name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SchoolSchema = SchemaFactory.createForClass(TrusteeSchool);

// bcrypt code for hashing password salt = 10
SchoolSchema.pre('save', async function (next) {
  const school: any = this;

  // Hash the password only if it has been modified or is new
  if (!school.isModified('password_hash')) {
    return next();
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(school.password_hash, saltRounds);

    school.password_hash = hash;
    next();
  } catch (error) {
    return next(error);
  }
});
