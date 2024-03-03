import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { TrusteeSchool, rangeCharge } from "src/schema/school.schema";

@Injectable()
export class PlatformChargeService {
    constructor(
        @InjectModel(TrusteeSchool.name)
        private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    ){}

    async AddPlatformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String,
        range_charge: rangeCharge
    ){
        try{
            const platformCharges = await this.trusteeSchoolModel.findOne({_id: trusteeSchoolId});

            if(!platformCharges) throw new Error("Trustee school not found");

            platformCharges.platform_charges.forEach((platformCharge) => {
                if(platformCharge.platform_type === platform_type && platformCharge.payment_mode === payment_mode){
                    console.log(platformCharge);
                    throw new Error('This payment method already present');
                }
            })

            console.log("tarun");


            const res = await this.trusteeSchoolModel.updateOne(
                {_id: trusteeSchoolId},
                {$push: {platform_charges: {
                    platform_type,
                    payment_mode,
                    range_charge
                }}},
                {returnDocument: "after"}
            )

            return res;
        }
        catch(err){
            throw new Error(err);
        }
    }

    async deletePlatformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String
    ){
        try{
            const platformCharges = await this.trusteeSchoolModel.findOne({_id: trusteeSchoolId});

            if(!platformCharges) throw new Error("Trustee school not found");

            let isFound = 0;
            platformCharges.platform_charges.forEach((platformCharge) => {
                if(platformCharge.platform_type === platform_type && platformCharge.payment_mode === payment_mode){
                    isFound = 1;
                }
            })

            if(!isFound) throw new Error("Payment method not present")

            const res = await this.trusteeSchoolModel.updateOne(
                {_id: trusteeSchoolId},
                {$pull: {"platform_charges": {
                    "platform_type": platform_type,
                    "payment_mode": payment_mode}}
                },
                {returnDocument: "after"}
            )

            return res;
        }
        catch(err){
            throw new Error(err);
        }  
    }

    async platformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String,
        amount: Number
    ){
        try{
            const platformCharges = await this.trusteeSchoolModel.findOne({_id: trusteeSchoolId});

            if(!platformCharges) throw new Error("Trustee school not found");
            if(!platformCharges.platform_charges) throw new Error("Charges not set");

            let ranges = null;
        
            platformCharges.platform_charges.forEach((platformCharge) => {
                if(platformCharge.platform_type === platform_type && platformCharge.payment_mode === payment_mode){
                    ranges = platformCharge.range_charge;
                }
            })

            if(!ranges) throw new Error("Payment method not present")

            let platformCharge = 0;
            ranges.forEach((range) => {
                if(!range.upto || range.upto >= amount){
                    platformCharge = range.charge
                }
            })

            return platformCharge;
        }
        catch(err){
            throw new Error(err);
        }  
    }
}