import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Types, Schema as MongooseSchema, ObjectId } from 'mongoose';
import * as bcrypt from 'bcrypt';






@ObjectType()
@Schema({ timestamps: true })
export class SubTrustee {
  @Field(() => ID)
  _id: string;

  @Field(() => String)
  @Prop({ required: true })
  name: string;

  @Field(() => String)
  @Prop({ required: true })
  email?: string;

  @Field(() => String, { nullable: true })
  @Prop()
  phone?: string;

  @Field(() => String, { nullable: true })
  @Prop()
  logo?: string;

  @Field(() => String, { nullable: true })
  @Prop()
  role?: string;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Field(() => String) // Define the field in GraphQL schema
  @Prop({ required: true }) // Define the field in Mongoose schema
  password_hash: string;


  @Field(() => Date, { nullable: true })
  createdAt?: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date;
}

export const SubTrusteeSchema = SchemaFactory.createForClass(SubTrustee);


SubTrusteeSchema.pre('save', async function (next) {
  const subtrustee: any = this;

  // Hash the password only if it has been modified or is new
  if (!subtrustee.isModified('password_hash')) {
    return next();
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(subtrustee.password_hash, saltRounds);

    subtrustee.password_hash = hash;
    next();
  } catch (error) {
    return next(error);
  }
});