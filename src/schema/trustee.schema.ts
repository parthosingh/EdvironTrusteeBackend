import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field,ID } from '@nestjs/graphql';
import { Document, ObjectId,Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@ObjectType()
export class WebhookUrlType {
  @Prop() 
  @Field(() => Number)
  id: number;

  @Prop() 
  @Field(() => String)
  url: string;
}



@ObjectType()
export class bankDetails {
  @Field(() => String, { nullable: true })
  @Prop() 
  account_holder_name: string;

  @Field(() => String, { nullable: true })
  @Prop() 
  account_number: string;

  @Field(() => String, { nullable: true })
  @Prop() 
  ifsc_code: string;
}

@ObjectType() // Define GraphQL object type
@Schema({ timestamps: true })
export class Trustee extends Document {
  @Field()
  @Prop({ required: true })
  name: string;

  @Field()
  @Prop({ required: true, unique: true })
  email_id: string;

  @Field(() => String) // Define the field in GraphQL schema
  @Prop({ required: true }) // Define the field in Mongoose schema
  password_hash: string;

  @Field()
  @Prop({ default: 0 })
  school_limit: number;

  @Field()
  @Prop({ default: 0 })
  IndexOfApiKey: number;

  @Field()
  @Prop()
  phone_number: string;

  @Field({ nullable: true, defaultValue: null })
  @Prop()
  apiKey: string;

  @Prop({})
  @Field(() => String)
  vendor_id: string;

  @Field(() => String, { nullable: true, defaultValue: null })
  @Prop()
  onboarder_id: string;

  @Field(() => String, { nullable: true, defaultValue: null })
  @Prop()
  brand_name: string;

  @Field(() => [WebhookUrlType], { nullable: true })
  @Prop({ required: false })
  webhook_urls: WebhookUrlType[];

  @Prop({})
  @Field(() => String,{ nullable: true })
  gstIn: string;

  @Prop({})
  @Field(() => String,{ nullable: true })
  residence_state: string;

  @Prop({})
  @Field(() => bankDetails,{ nullable: true })
  bank_details: bankDetails;

  @Field()
  @Prop()
  logo: string;

  @Field()
  @Prop({ nullable: true })
  settlement_webhook_url: string;

  @Field()
  @Prop({ nullable: true })
  refund_webhook_url: string;

  @Prop({})
  @Field(() => Boolean,{defaultValue:false})
  isOnboarder: boolean;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  onboarder: ObjectId;


}

export const TrusteeSchema = SchemaFactory.createForClass(Trustee);

// bcrypt code for hashing password salt = 10
TrusteeSchema.pre('save', async function (next) {
  const trustee: any = this;

  // Hash the password only if it has been modified or is new
  if (!trustee.isModified('password_hash')) {
    return next();
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(trustee.password_hash, saltRounds);

    trustee.password_hash = hash;
    next();
  } catch (error) {
    return next(error);
  }
});
