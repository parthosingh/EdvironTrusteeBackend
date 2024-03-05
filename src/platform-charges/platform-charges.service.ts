import { ConflictException, Get, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { TrusteeSchool, rangeCharge } from "src/schema/school.schema";
import { Trustee } from "src/schema/trustee.schema";

@Injectable()
export class PlatformChargeService {
    constructor(
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>,
        @InjectModel(TrusteeSchool.name)
        private trusteeSchoolModel: mongoose.Model<TrusteeSchool>,
    ) { }

    async AddPlatformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String,
        range_charge: rangeCharge
    ) {
        try {
            const platformCharges = await this.trusteeSchoolModel.findOne({ _id: trusteeSchoolId });

            if (!platformCharges) throw new Error("Trustee school not found");

            platformCharges.platform_charges.forEach((platformCharge) => {
                if (platformCharge.platform_type === platform_type && platformCharge.payment_mode === payment_mode) {
                    console.log(platformCharge);
                    throw new ConflictException('This payment method already present');
                }
            })

            const res = await this.trusteeSchoolModel.findOneAndUpdate(
                { _id: trusteeSchoolId },
                {
                    $push: {
                        platform_charges: {
                            platform_type,
                            payment_mode,
                            range_charge
                        }
                    }
                },
                { returnDocument: "after" }
            )

            return { platform_charges: res.platform_charges };
        }
        catch (err) {
            throw new Error(err);
        }
    }

    async deletePlatformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String
    ) {
        try {
            const platformCharges = await this.trusteeSchoolModel.findOne({ _id: trusteeSchoolId });

            if (!platformCharges) throw new Error("Trustee school not found");

            let isFound = 0;
            platformCharges.platform_charges.forEach((platformCharge) => {
                if (platformCharge.platform_type === platform_type && platformCharge.payment_mode === payment_mode) {
                    isFound = 1;
                }
            })

            if (!isFound) throw new Error("Payment method not present")

            const res = await this.trusteeSchoolModel.findOneAndUpdate(
                { _id: trusteeSchoolId },
                {
                    $pull: {
                        "platform_charges": {
                            "platform_type": platform_type,
                            "payment_mode": payment_mode
                        }
                    }
                },
                { returnDocument: "after" }
            )

            return res;
        }
        catch (err) {
            throw new Error(err);
        }
    }

    async platformCharge(
        trusteeSchoolId: String,
        platform_type: String,
        payment_mode: String,
        amount: Number
    ) {
        try {
            const platformCharges = await this.trusteeSchoolModel.findOne({ _id: trusteeSchoolId });

            if (!platformCharges) throw new Error("Trustee school not found");
            if (!platformCharges.platform_charges) throw new Error("Charges not set");

            let ranges = null;

            platformCharges.platform_charges.forEach((platformCharge) => {
                if (platformCharge.platform_type === platform_type && platformCharge.payment_mode === payment_mode) {
                    ranges = platformCharge.range_charge;
                }
            })

            if (!ranges) throw new Error("Payment method not present")

            let platformCharge = 0;
            ranges.forEach((range) => {
                if (!range.upto || range.upto >= amount) {
                    platformCharge = range.charge
                }
            })

            return platformCharge;
        }
        catch (err) {
            throw new Error(err);
        }
    }

    async getAllTrustee() {
        try {
            const trustees = await this.trusteeModel.find({}, {_id: 1, name: 1});
            console.log(trustees);
            return {trustees: trustees};
        }
        catch (err) {
            throw new Error(err);
        }
    }

    async getAllTrusteeSchool(trusteeId: String){
        try{
            const schools = await this.trusteeSchoolModel.find({trustee_id: trusteeId}, {school_id: 1, school_name: 1, platform_charges: 1});
            return {schools: schools};
        }
        catch(err){
            throw new Error(err);
        }
    }
}