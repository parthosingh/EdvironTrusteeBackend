import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document, ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@ObjectType() // Define GraphQL object type
@Schema({ timestamps: true })
export class OnboarderERP extends Document {
  @Field()
  @Prop({ required: true })
  name: string;

  @Field()
  @Prop({ required: true, unique: true })
  email_id: string;

  @Field(() => String) // Define the field in GraphQL schema
  @Prop({ required: true }) // Define the field in Mongoose schema
  password_hash: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  head_trustee: ObjectId;

  @Field()
  @Prop()
  phone_number: string;

  @Field(() => String, { nullable: true, defaultValue: null })
  @Prop()
  brand_name: string;

  @Field()
  @Prop()
  logo: string;
}

export const OnboarderERPSchema = SchemaFactory.createForClass(OnboarderERP);

// bcrypt code for hashing password salt = 10
OnboarderERPSchema.pre('save', async function (next) {
  const onboarder: any = this;

  // Hash the password only if it has been modified or is new
  if (!onboarder.isModified('password_hash')) {
    return next();
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(onboarder.password_hash, saltRounds);

    onboarder.password_hash = hash;
    next();
  } catch (error) {
    return next(error);
  }
});
