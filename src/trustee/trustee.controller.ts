import { Controller,Post,Get, Body, BadRequestException, ConflictException, Query } from '@nestjs/common';
import { TrusteeService } from './trustee.service';
import { Trustee } from './schemas/trustee.schema';
import { TrusteeModule } from './trustee.module';

@Controller('trustee')
export class TrusteeController {
    constructor (private trusteeService:TrusteeService){}

    
    

   
   @Get('payment-link')
    async genratePaymentLink(
        @Query('phone_number')
        phone_number: string
    ){
        const link = this.trusteeService.genrateLink(phone_number)
        return link
    }
}
