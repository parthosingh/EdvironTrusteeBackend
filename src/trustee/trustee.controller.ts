import { Controller,Post,Get, Body, BadRequestException, ConflictException, Param, UseGuards, Request, Req } from '@nestjs/common';
import { TrusteeService } from './trustee.service';

@Controller('trustee')
export class TrusteeController {
    constructor (private trusteeService:TrusteeService){}

    @Post(':school_id/gen-school-token')
    async generateSchoolToken(
        @Body()
        body:{password: string},
        @Param() 
        param : {school_id: string},
        @Req() req
    ){
        req.user = '657c8eb0de948adeb738b0f5';
        try{
            
            const schoolToken = await this.trusteeService.generateSchoolToken(param.school_id,body.password, req.user);
            return schoolToken;
        }catch(error){
            console.log(error);
            throw error
        }
    }
    
    
}