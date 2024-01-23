import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MainBackendService } from './main-backend.service';
import { JwtPayload } from 'jsonwebtoken';
import { Trustee } from 'src/schema/trustee.schema';
import mongoose, { Types } from 'mongoose';

@Controller('main-backend')
export class MainBackendController {

    constructor(
        private mainBackendService: MainBackendService,
        private readonly jwtService: JwtService,
      ) {}

    @Post('create-trustee')
    async createTrustee(
      @Body()
      body,
    ): Promise<string> {
      try {
        const info: JwtPayload = this.jwtService.verify(
          body.data,
          {secret:process.env.JWT_SECRET_FOR_INTRANET}
        );
        
        
      const trustee = await this.mainBackendService.createTrustee(info)
      

      const trusteeToken = this.jwtService.sign({ credential: trustee },{
        secret:process.env.JWT_SECRET_FOR_INTRANET
      })
     
      
      return trusteeToken
      } catch (e) {
        if (e.response && e.response.statusCode === 409) {
          throw new ConflictException(e.message);
        }
        throw new BadRequestException(e.message);
      }
    }

    @Get('find-all-trustee')
    async findTrustee(
      @Query('token') token: string,
    ) {
      
      const paginationInfo:JwtPayload=this.jwtService.verify(token,{secret:process.env.JWT_SECRET_FOR_INTRANET},) as JwtPayload
      const trustee  = this.jwtService.sign(await this.mainBackendService.findTrustee(paginationInfo.page, paginationInfo.pageSize),{secret:process.env.JWT_SECRET_FOR_INTRANET})
      return trustee;
    } 
  
  
    @Post('assign-school')
    async assignSchool(
      @Body()
      token: {
        token: string;
      },
    ) {
      try {
        const data = this.jwtService.verify(
          token.token,
          {secret:process.env.JWT_SECRET_FOR_INTRANET},
        ) 
        const assignSchool = await this.mainBackendService.assignSchool(
          data
        );
        
        const payload = {
          school_id:assignSchool.school_id,
          trustee_id:assignSchool.trustee_id,
          school_name:assignSchool.school_name,
        }

        const schooltoken = this.jwtService.sign(payload,{secret:process.env.JWT_SECRET_FOR_INTRANET})
        
          
          
        return schooltoken
      } catch (error) {
        
        if (error.response && error.response.statusCode === 403) {
          throw new ForbiddenException(error.message);
        }
  
        throw new BadRequestException(error.message);
      }
    }
}
