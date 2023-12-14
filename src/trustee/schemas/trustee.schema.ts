import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as bcrypt from 'bcrypt';

@Schema({ timestamps: true })
export class Trustee {
  @Prop({})
  name: string;

  @Prop({})
  email_id: string;

  @Prop({})
  password_hash: string;
  @Prop({})
  school_limit: number
  
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
