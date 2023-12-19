import { Controller,Post,Get, Body, BadRequestException, ConflictException, Query } from '@nestjs/common';
import { TrusteeService } from './trustee.service';

@Controller('trustee')
export class TrusteeController {
    constructor (private trusteeService:TrusteeService){}

 
@Post('section')
    async createSection(
        @Body()
        body:{school_id:string;data:{className:string,section:string}}
    ){
       
        try{
            
            const section = await this.trusteeService.createSection(body.school_id,body.data)
            return section
        }catch(error){ 
            
            if(error.response.statusCode === 409){
                throw new ConflictException(error.message)
            }
            throw new BadRequestException(error.message)
        }
    }

    
}