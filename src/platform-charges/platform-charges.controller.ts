import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { PlatformChargeService } from "./platform-charges.service";
import { InjectModel } from "@nestjs/mongoose";
import { TrusteeSchool } from "src/schema/school.schema";
import mongoose from "mongoose";

@Controller('platform-charges')
export class PlatformChargesController {
    constructor(
        private readonly platformChargeService: PlatformChargeService,
        @InjectModel(TrusteeSchool.name)
        private readonly trusteeSchool: mongoose.Model<TrusteeSchool>
    ){}

    @Post('add-platform-charges')
    async AddPlatformCharge(
        @Body()
        body
    ){
        const {school_id, platform_type, payment_mode, range_charge} = body;
        try{
            return await this.platformChargeService.AddPlatformCharge(school_id, platform_type, payment_mode, range_charge);
        }
        catch(err){
            return err.message;
        }
    }

    @Post('delete-platform-charges')
    async deletePlatformCharge(
        @Body()
        body
    ){
        const {school_id, platform_type, payment_mode } = body;
        try{
            return await this.platformChargeService.deletePlatformCharge(school_id, platform_type, payment_mode);
        }
        catch(err){
            return err.message;
        }
    }

    @Get('platform-charge')
    async platformCharge(
        @Body()
        body
    ){
        try{
            const {school_id, platform_type, payment_mode, amount} = body;
            return await this.platformChargeService.platformCharge(school_id, platform_type, payment_mode, amount);
        }
        catch(err){
            return err.message;
        }
    }
}