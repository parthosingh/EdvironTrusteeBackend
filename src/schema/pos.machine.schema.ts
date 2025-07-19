import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId, Types } from 'mongoose';
import { registerEnumType } from '@nestjs/graphql';

export enum PosMachineType {
  PAYTM = 'PAYTM_POS',
  MOSAMBEE = 'MOSAMBEE_POS',
}

export enum Status {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  INACTIVE = 'INACTIVE',
}

@ObjectType()
export class MachineDetail {
  @Prop()
  @Field(() => String, { nullable: true })
  device_mid: string;

  @Prop()
  @Field(() => String, { nullable: true })
  merchant_key: string;

  @Prop()
  @Field(() => String, { nullable: true })
  Device_serial_no: string;

  @Prop()
  @Field(() => String, { nullable: true })
  device_tid: string;

  @Prop()
  @Field(() => String, { nullable: true })
  channel_id: string;

  @Prop()
  @Field(() => String, { nullable: true })
  device_id: string;
}

@ObjectType()
@Schema({ timestamps: true })
export class PosMachine {
  @Prop({ type: Types.ObjectId, ref: 'TrusteeSchool' })
  @Field(() => ID)
  school_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Trustee' })
  @Field(() => ID)
  trustee_id: Types.ObjectId;

  @Prop({ enum: PosMachineType })
  @Field(() => PosMachineType)
  machine_name: PosMachineType;

  @Prop({})
  @Field(() => MachineDetail)
  machine_details: MachineDetail;

  @Prop()
  @Field(() => String, { nullable: true })
  firmware_version: string;

  @Prop({ enum: Status })
  @Field(() => Status, { nullable: true })
  status: Status;

  @Prop()
  @Field(() => Date, { nullable: true })
  installation_date?: Date;

  @Prop()
  @Field(() => Date, { nullable: true })
  last_maintenance_at?: Date;
}

export const PosMachineSchema = SchemaFactory.createForClass(PosMachine);
