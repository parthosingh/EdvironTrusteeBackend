import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongoose';
import { Document, Types } from 'mongoose';

@ObjectType()
@Schema({timestamps:true})
export class TransactionInfo extends Document{
    @Prop({type:Types.ObjectId})
    @Field(()=>ID)
    collect_id:ObjectId

    @Prop({type:Types.ObjectId})
    @Field(()=>ID)
    trustee_id:ObjectId
    
    @Prop()
    @Field(()=>String)
    remarks:string
}

export const TransactionInfoSchema = SchemaFactory.createForClass(TransactionInfo)