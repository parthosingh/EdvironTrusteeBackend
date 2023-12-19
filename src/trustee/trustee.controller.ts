import { Trustee } from './schema/trustee.schema';
import * as jwt from 'jsonwebtoken'
import { JwtPayload } from 'jsonwebtoken';
import { Controller,Post,Get, Body, BadRequestException, ConflictException, Query } from '@nestjs/common';
import { TrusteeService } from './trustee.service';


@Controller('trustee')
export class TrusteeController {
    constructor (
        private trusteeService:TrusteeService
        ){}

    @Get()
    async findTrustee():Promise<Trustee[]>{
        return this.trusteeService.findTrustee()
    }
 

    @Post()
    async createTrustee(
        @Body()
        token
    ):Promise<Trustee>{
        try{
            
            
            
            const info: JwtPayload = jwt.verify(token.data,process.env.PRIVATE_TRUSTEE_KEY) as JwtPayload;
            const credential = await this.trusteeService.createTrustee(info);
            return credential
             
        }catch(e){
            
            if(e.response.statusCode === 409){
                throw new ConflictException(e.message)
            }
            throw new BadRequestException(e.message)  
        }
    }
    
    // constructor (private trusteeService:TrusteeService){}

 @Get('payment-link')
    async genratePaymentLink(
        @Query('phone_number') 
        phone_number: string 
    ){
        
        
        const link = this.trusteeService.genrateLink(phone_number)
        return link
    }
}