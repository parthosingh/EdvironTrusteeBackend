import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Document } from 'mongoose';
import { ObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

@ObjectType()
export class EarningBreakup {
  @Field(() => Number, { nullable: true }) //Edviron buying Rate from gateway
  edviron_buying_rate: number;

  @Field(() => Number, { nullable: true }) //Trustee Base Rate set by Edviron
  trustee_base_rate: number;

  @Field(() => Number, { nullable: true }) //School Final Rate set by Trustee
  school_final_rate: number;

  @Field(() => Number, { nullable: true }) //Final Charges saved on pg backend
  pg_final_rates: number;

  @Field(() => Number, { nullable: true }) //GST on PG Charges 18%
  gst_on_pg_charges: number;

  @Field(() => Number, { nullable: true }) //Edviron buying rates - trustee base rate
  edviron_earning_base: number;

  @Field(() => Number, { nullable: true }) // Trustee final rates - school final rate(in payments backend)
  edviron_earning_school: number;

  @Field(() => Number, { nullable: true }) // edviron_earning_base + edviron_earning_school | without GST
  edviron_earning: number;

  @Field(() => Number, { nullable: true }) // Edviron earning with GST
  edviron_earning_with_gst: number;

  @Field(() => Number, { nullable: true }) // Edviron earning with GST
  order_amount: number;

  @Field(() => Number, { nullable: true }) // Edviron earning with GST
  transaction_amount: number;

}

@ObjectType()
export class CommissionWithoutGstDto {
  @Field(() => Number)
  erp_commission_without_gst: number;

  @Field(() => Number, { nullable: true }) //Edviron buying rates - trustee base rate
  edviron_earning_base_without_gst: number;

  @Field(() => Number, { nullable: true }) // Trustee final rates - school final rate(in payments backend)
  edviron_earning_school_without_gst: number;

  @Field(() => Number, { nullable: true }) // edviron_earning_base + edviron_earning_school | without GST
  edviron_earning_without_gst: number;

  @Field(() => Number, { nullable: true }) // erp_commission + edviron_earning | without GST
  total_commission_without_gst: number;
}

@ObjectType()
export class CommissionWithGstDto {
  @Field(() => Number)
  erp_commission_with_gst: number;

  @Field(() => Number, { nullable: true }) //Edviron buying rates - trustee base rate
  edviron_earning_base_with_gst: number;

  @Field(() => Number, { nullable: true }) // Trustee final rates - school final rate(in payments backend)
  edviron_earning_school_with_gst: number;

  @Field(() => Number, { nullable: true }) // edviron_earning_base + edviron_earning_school | without GST
  edviron_earning_with_gst: number;

  @Field(() => Number, { nullable: true }) // erp_commission + edviron_earning | without GST
  total_commission_with_gst: number;
}

@ObjectType()
export class CommissionGSTDto {
  @Field(() => Number)
  gst_erp_commission: number;

  @Field(() => Number, { nullable: true }) //Edviron buying rates - trustee base rate
  gst_edviron_earning_base: number;

  @Field(() => Number, { nullable: true }) // Trustee final rates - school final rate(in payments backend)
  gst_edviron_earning_school: number;

  @Field(() => Number, { nullable: true }) // edviron_earning_base + edviron_earning_school | without GST
  gst_edviron_earning: number;

  @Field(() => Number, { nullable: true }) // erp_commission + edviron_earning | without GST
  gst_total_commission: number;
}



@ObjectType()
export class MdrDto {
  @Field(() => String)
  charges_type: string;

  @Field(() => Number)
  platform_charges: number;
}

@ObjectType()
export class MdrStoreDto {
  @Field(() => MdrDto,{nullable:true})
  edviron_buying_mdr: MdrDto;

  @Field(() => MdrDto,{nullable:true})
  school_base_mdr: MdrDto;

  @Field(() => MdrDto,{nullable:true})
  school_final_mdr: MdrDto;

  @Field(() => MdrDto,{nullable:true})
  pg_final_mdr: MdrDto;
}

@ObjectType()
export class MdrAmountStoreDto {
  @Field(() => Number)
  edviron_buying_mdr_amount: number;

  @Field(() => Number)
  school_base_mdr_amount: number;

  @Field(() => Number)
  school_final_mdr_amount: number;

  @Field(() => Number)
  pg_final_mdr_amount: number;
}

@ObjectType()
@Schema({ timestamps: true })
export class Commission extends Document {
  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  school_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  collect_id: ObjectId;

  @Prop({ type: Types.ObjectId })
  @Field(() => ID)
  trustee_id: ObjectId;

  @Field()
  @Prop()
  commission_amount: number;

  @Field({ defaultValue: 'Commission' })
  @Prop()
  commission_namae: string;

  @Field()
  @Prop()
  payment_mode: string;

  @Field()
  @Prop()
  platform_type: string;

  @Field(() => MdrStoreDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  mdr: MdrStoreDto;

  @Field(() => MdrAmountStoreDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  mdr_amount: MdrAmountStoreDto;

  @Field(() => CommissionWithoutGstDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  commission_without: CommissionWithoutGstDto;

  @Field(() => CommissionWithGstDto, { nullable: true })
  @Prop({ type: Object, nullable: true })
  commission_with_gst: CommissionWithGstDto;

  @Field(() => EarningBreakup, { nullable: true })
  @Prop({ type: Object, nullable: true })
  earning_breakup: EarningBreakup;
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);
