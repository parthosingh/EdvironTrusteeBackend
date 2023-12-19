import { Trustee } from './schema/trustee.schema';
import * as jwt from 'jsonwebtoken'
import { JwtPayload } from 'jsonwebtoken';
import { Controller,Post,Get, Body, BadRequestException, ConflictException, Query, UseGuards, Req, UnauthorizedException,  NotFoundException, Param, ForbiddenException  } from '@nestjs/common';
import { TrusteeService } from './trustee.service';
import {JwtService} from '@nestjs/jwt'
import { TrusteeGuard } from './trustee.guard';
import { Types } from "mongoose"


@Controller('trustee')
export class TrusteeController {
    constructor (
        private trusteeService:TrusteeService,
        private readonly jwtService: JwtService
        ){}


 

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
    

 @Get('payment-link')
    async genratePaymentLink(
        @Query('phone_number') 
        phone_number: string 
    ){
        
         
        
        const link = this.trusteeService.genrateLink(phone_number)
        return link
    }

 @Get('get-user')
    async validateApiKey(@Req() req): Promise<{ payload: any }> {
      try {
        // If the request reaches here, the token is valid
        const authorizationHeader = req.headers.authorization;
        const token = authorizationHeader.split(' ')[1];
  
        const trustee = await this.trusteeService.validateApiKey(token);
  
        return trustee;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(error.message);
        } else {
          throw new UnauthorizedException(error.message);
        }
      }
}
  
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
  
   @Post(':school_id/gen-school-token')
    async generateSchoolToken(
        @Body()
        body:{password: string},
        @Param() 
        param : {school_id: string},
        @Req() req
    ){
//         req.user = '657c8eb0de948adeb738b0f5';
        try{
            
            const schoolToken = await this.trusteeService.generateSchoolToken(param.school_id,body.password, req.user);
            return schoolToken;
        }catch(error){
            console.log(error);
            throw error
        }
    }

    
}