import { Controller,Post,Get, Body, BadRequestException, ConflictException, Param, UseGuards, Request } from '@nestjs/common';
import { TrusteeService } from './trustee.service';

@Controller('trustee')
export class TrusteeController {
    constructor (private trusteeService:TrusteeService){}

    @Post('create-school')
    async createSchool(
        @Body()
        body:{name: string; phone_number: string, email: string, school_name: string},

        @Request() req
    ){

        if(!body.name || !body.phone_number || !body.email || !body.school_name)
        {
            throw new BadRequestException('Fill all fields')
        }

        try{
            
            const school = await this.trusteeService.createSchool(body.phone_number, body.name, body.email, body.school_name, req.user);
            return school;
        }catch(error){
            console.log(error.response);
            if(error.response.statusCode === 409){
                throw new ConflictException(error.message)
            }
            throw new BadRequestException(error.message)
        }
    }
    
}