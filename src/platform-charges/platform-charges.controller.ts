import { BadRequestException, Body, ConflictException, Controller, Get, Post, Query } from "@nestjs/common";
import { PlatformChargeService } from "./platform-charges.service";
import { InjectModel } from "@nestjs/mongoose";
import { TrusteeSchool } from "../schema/school.schema";
import mongoose from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { Trustee } from "../schema/trustee.schema";

@Controller('platform-charges')
export class PlatformChargesController {
    constructor(
        private readonly jwtService: JwtService,
        private readonly platformChargeService: PlatformChargeService,
        @InjectModel(Trustee.name)
        private trusteeModel: mongoose.Model<Trustee>,
        @InjectModel(TrusteeSchool.name)
        private readonly trusteeSchool: mongoose.Model<TrusteeSchool>
    ) { }

    @Post('add-platform-charges')
    async AddPlatformCharge(
        @Body()
        token: {
            token: string
        }
    ) {
        try {
            const body = this.jwtService.verify(token.token, { secret: process.env.JWT_SECRET_FOR_INTRANET });
            const {trusteeSchoolId, platform_type, payment_mode, range_charge} = body;

            const val = await this.platformChargeService.AddPlatformCharge(
                trusteeSchoolId,
                platform_type,
                payment_mode,
                range_charge
            );

            const payload = {
                platform_charges: val.platform_charges
            };

            const res = this.jwtService.sign(payload, { secret: process.env.JWT_SECRET_FOR_INTRANET });
            return res;
        }
        catch (err) {
            throw new ConflictException(err.message);
        }
    }

    @Post('delete-platform-charges')
    async deletePlatformCharge(
        @Body()
        token: {
            token: string
        }
    ) {
        try {
            const body = this.jwtService.verify(token.token, { secret: process.env.JWT_SECRET_FOR_INTRANET });
            const {trusteeSchoolId, platform_type, payment_mode} = body;

            const val = await this.platformChargeService.deletePlatformCharge(
                trusteeSchoolId,
                platform_type,
                payment_mode
            );

            const payload = {
                platform_charges: val.platform_charges
            };

            const res = this.jwtService.sign(payload, { secret: process.env.JWT_SECRET_FOR_INTRANET });
            return res;
        }
        catch (err) {
            throw new Error(err);
        }
    }

    @Get('final-amount-with-MDR')
    async finalAmountWithMDR(
        @Body()
        body
    ) {
        try {
            const { trusteeSchoolId, platform_type, payment_mode, amount } = body;
            return await this.platformChargeService.finalAmountWithMDR(trusteeSchoolId, platform_type, payment_mode, amount);
        }
        catch (err) {
            return err.message;
        }
    }


    @Get('alltrustee')
    async getAllTrusteeInSiglePage(){
        try{
            const data = await this.platformChargeService.getAllTrustee();
            const res = this.jwtService.sign(data, { secret: process.env.JWT_SECRET_FOR_INTRANET });
            return res;
        }
        catch(err){
            throw new Error(err);
        }
    }

    
    @Get("alltrusteeschool")
    async getAllTrusteeSchool(
        @Query('token') token: string
    ){
        try{
            const {trusteeId} = this.jwtService.verify(token, { secret: process.env.JWT_SECRET_FOR_INTRANET });
            const val = await this.platformChargeService.getAllTrusteeSchool(trusteeId)
            const res = this.jwtService.sign(val, { secret: process.env.JWT_SECRET_FOR_INTRANET });
            return res;
        }
        catch(err){
            throw new Error(err);
        }
    }
}