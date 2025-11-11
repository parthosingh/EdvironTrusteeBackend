import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CommissionService } from './commission.service';

@Controller('commission')
export class CommissionController {
    constructor(
        private commissionService: CommissionService,
        private databaseService: DatabaseService,
    ) { }

    @Get()
    async getCommissions() {
        
        return this.databaseService.gatewayRatesModel.find();
    }

    @Post('edv-commission')
    async getComms(
        @Body() body:{
            commission_id:string,
            gateway:string,
            amount:number
        }
    ){
        try{
            const result = await this.commissionService.updateCommission(body.commission_id, body.gateway);
            return result;
        }catch(e){
            throw new BadRequestException(e.message)
        }
    }

    
}
