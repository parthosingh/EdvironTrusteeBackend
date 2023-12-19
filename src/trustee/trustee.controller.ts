import { NotFoundException, Param, Get, Controller, Post, Body, BadRequestException, UnauthorizedException, Req } from '@nestjs/common';
import { TrusteeService } from './trustee.service';
import * as JWT from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken'
import {JwtService} from '@nestjs/jwt'



@Controller('trustee')
export class TrusteeController {
    constructor (
        private trusteeService:TrusteeService,
        private readonly jwtService: JwtService
        ){}

    @Get('validate')
    async validateApiKey(
      @Req() req,
    ):Promise<{payload: any}> {

      try {
        const authorizationHeader = req.headers.authorization;

        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Invalid Authorization header format');
        }

        const token = authorizationHeader.split(' ')[1];

        const trustee = await this.trusteeService.validateApiKey(token);
      return trustee;
      } catch (error) {
        if(error instanceof NotFoundException){
          throw new NotFoundException(error.message)
        } else {
          throw new UnauthorizedException(error.message);
        }
      }
    }  
}