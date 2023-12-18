import { Controller,Post,Get, Body, BadRequestException, ConflictException, Query, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TrusteeService } from './trustee.service';
import { Trustee } from './schema/trustee.schema'; 
import { Types } from "mongoose"
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken'


@Controller('trustee')
export class TrusteeController {
    constructor (private trusteeService:TrusteeService){}


    
    @Get()
    async findTrustee(
        @Query('page') page:number,
        @Query('pageSize') pageSize:number
        ){
            return this.trusteeService.findTrustee(page,pageSize)
        }
        
        

    @Post('assign-school')
    async assignSchool(
        @Body()
        token:{token:string}
    ){
        try{  

            const data: JwtPayload = jwt.verify(token.token, process.env.PRIVATE_TRUSTEE_KEY) as JwtPayload;
            const trusteeId =  new Types.ObjectId(data.trustee_id);
            const trustee = await this.trusteeService.findOneTrustee(trusteeId)
            
            if(!trustee){
                throw new NotFoundException('trustee not found')
            }
            
            return await this.trusteeService.assignSchool(data.school_id,data.trustee_id,data.school_name)
            }catch(error){
                
                
                if(error.response.statusCode === 403){
                    throw new ForbiddenException(error.message)
                }
                 
                throw new BadRequestException(error.message)
            }
    }

}