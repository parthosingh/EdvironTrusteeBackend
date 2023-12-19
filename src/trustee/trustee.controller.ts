import { Trustee } from './schema/trustee.schema';
import * as jwt from 'jsonwebtoken'
import { JwtPayload } from 'jsonwebtoken';
import { Controller,Post,Get, Body, BadRequestException, ConflictException, Query, UseGuards, Req, UnauthorizedException,  NotFoundException, Param  } from '@nestjs/common';
import { TrusteeService } from './trustee.service';
import {JwtService} from '@nestjs/jwt'
import { TrusteeGuard } from './trustee.guard';


@Controller('trustee')
export class TrusteeController {
    constructor (
        private trusteeService:TrusteeService,
        private readonly jwtService: JwtService
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