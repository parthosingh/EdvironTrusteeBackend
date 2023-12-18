import { Schema,Prop, SchemaFactory } from "@nestjs/mongoose";
import { ObjectId, Types } from "mongoose";

@Schema({timestamps:true})
export class TrusteeSchool{
    @Prop({type: Types.ObjectId})
    school_id:ObjectId;

    @Prop({type: Types.ObjectId})
    trustee_id:ObjectId;

    @Prop({})
    school_name:string

    @Prop({})
    super_admin_id: string
} 


export const SchoolSchema = SchemaFactory.createForClass(TrusteeSchool)