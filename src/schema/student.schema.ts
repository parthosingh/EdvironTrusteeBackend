import { Field } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { ObjectId } from 'mongoose';
import * as bcrypt from 'bcrypt';

@Schema({ timestamps: true })
export class StudentDetail {
    @Field()
    @Prop({})
    student_id: string;

    @Field()
    @Prop({})
    student_name: string;

    @Field()
    @Prop({})
    trustee_id: string;

    @Field()
    @Prop({})
    school_id: string;

    @Field()
    @Prop({})
    student_email: string;

    @Field()
    @Prop({})
    student_number: string;

    @Field()
    @Prop({ required: false })
    student_class: string;

    @Field()
    @Prop({ required: false })
    section: string;

    @Field()
    @Prop({ required: false })
    gender: string;

    @Field()
    @Prop({ required: false })
    additional_info: string;

    @Field(() => String) // Define the field in GraphQL schema
    @Prop({  }) // Define the field in Mongoose schema
    password_hash: string;
}

export type StudentDetails = StudentDetail & Document;
export const StudentDetailSchema = SchemaFactory.createForClass(StudentDetail);

StudentDetailSchema.pre('save', async function (next) {
  const student: any = this;

  // Hash the password only if it has been modified or is new
  if (!student.isModified('password_hash')) {
    return next();
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(student.password_hash, saltRounds);
    student.password_hash = hash;
    next();
  } catch (error) {
    return next(error);
  }
});
