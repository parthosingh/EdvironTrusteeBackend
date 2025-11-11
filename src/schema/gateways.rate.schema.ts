import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ObjectId, Types } from 'mongoose';
import { PlatformCharge, rangeCharge } from './school.schema';


@ObjectType()
@Schema({ timestamps: true })
export class GatewayRates {
  @Prop()
  @Field(() => [PlatformCharge], { defaultValue: [] })
  platform_charges: PlatformCharge[];

 @Prop({required:true})
 @Field(()=>String)
 gateway: string;

  @Prop()
  @Field(() => String, { nullable: true })
  comment: string;
}

export const GatewayRatesSchema = SchemaFactory.createForClass(GatewayRates);
