import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field } from '@nestjs/graphql';
import { Document } from 'mongoose';
import bcrypt from 'bcrypt'

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
  phone_number: number;
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