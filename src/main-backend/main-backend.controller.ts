import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MainBackendService } from './main-backend.service';
import { JwtPayload } from 'jsonwebtoken';
import { Trustee } from '../schema/trustee.schema';
import mongoose, { Types } from 'mongoose';

@Controller('main-backend')
export class MainBackendController {

  constructor(
    private mainBackendService: MainBackendService,
    private readonly jwtService: JwtService,
  ) { }

  @Post('create-trustee')
  async createTrustee(
    @Body()
    body,
  ): Promise<string> {
    try {
      const info: JwtPayload = this.jwtService.verify(
        body.data,
        { secret: process.env.JWT_SECRET_FOR_INTRANET }
      );


      const trustee = await this.mainBackendService.createTrustee(info)


      const trusteeToken = this.jwtService.sign({ credential: trustee }, {
        secret: process.env.JWT_SECRET_FOR_INTRANET
      })


      return trusteeToken
    } catch (e) {
      if (e.response && e.response.statusCode === 409) {
        throw new ConflictException(e.message);
      }
      throw new BadRequestException(e.message);
    }
  }

<<<<<<< HEAD
    @Get('find-all-trustee')
    async findTrustee(
      @Query('token') token: string,
    ) {
      
      const paginationInfo:JwtPayload=this.jwtService.verify(token,{secret:process.env.JWT_SECRET_FOR_INTRANET},) as JwtPayload
      const trustee  = this.jwtService.sign(await this.mainBackendService.findTrustee(paginationInfo.page, paginationInfo.pageSize),{secret:process.env.JWT_SECRET_FOR_INTRANET})
      return trustee;
    } 
<<<<<<< HEAD
  
=======
>>>>>>> 8a24b2c (secure get all trustee endpoint)
  
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
=======
  @Get('find-all-trustee')
  async findTrustee(
    @Query('token') token: string,
  ) {
>>>>>>> bb3daa3 (Update school pg key (#47))

    const paginationInfo: JwtPayload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET_FOR_INTRANET },) as JwtPayload
    const trustee = this.jwtService.sign(await this.mainBackendService.findTrustee(paginationInfo.page, paginationInfo.pageSize), { secret: process.env.JWT_SECRET_FOR_INTRANET })
    return trustee;
  }

  // use this for temp testing to genrate jwt that comes from edviron backend

  // @Post('get-jwt')
  // async getJwt(
  //   @Body()
  //   body: { school_name: string, school_id: string, trustee_id: string, client_id: string, client_secret: string, merchantId: string, merchantName: string, merchantEmail: string, merchantStatus: string, pgMinKYC: string, pgFullKYC: string }
  // ) {

  //   const token = this.jwtService.sign(body, { secret: process.env.JWT_SECRET_FOR_INTRANET })

  //   return token
  // }

  @Post('assign-trustee-to-school')
  async assignSchool(
    @Body() body: { token: string },
  ) {
    try {

      const data: JwtPayload = await this.jwtService.verify(
        body.token,
        { secret: process.env.JWT_SECRET_FOR_INTRANET },
      )
      const requiredFields = [
        'school_name',
        'school_id',
        'trustee_id',
        'client_id',
        'client_secret',
        'merchantId',
        'merchantName',
        'merchantEmail',
        'merchantStatus',
        'pgMinKYC',
        'pgFullKYC',
      ];
  
      const missingFields = requiredFields.filter(field => !data[field]);
  
      if (missingFields.length > 0) {
        throw new BadRequestException(`Missing fields: ${missingFields.join(', ')}`);
      }
          
      const info = {
        school_name: data.school_name,
        school_id: data.school_id,
        trustee_id: data.trustee_id,
        client_id: data.client_id,
        client_secret: data.client_secret,
        merchantId: data.merchantId,
        merchantName: data.merchantName,
        merchantEmail: data.merchantEmail,
        merchantStatus: data.merchantStatus,
        pgMinKYC: data.pgMinKYC,
        pgFullKYC: data.pgFullKYC
      }
      const school = await this.mainBackendService.updateSchoolInfo(info)
      const response = {
        school_id: school.updatedSchool.school_id,
        school_name: school.updatedSchool.school_name,
        trustee:{
          name:school.trustee.name,
          id:school.trustee._id,
        },
        msg: `${school.updatedSchool.school_name} is Updated`
      }

      const responseToken = this.jwtService.sign(response, { secret: process.env.JWT_SECRET_FOR_INTRANET })

      return responseToken
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        throw new NotFoundException(error.response.message)
      }else if(error.response &&  error.response.statusCode === 409 ){
        throw new ConflictException(error.response.message)
      }
      throw new BadRequestException(error.message)

    }
  }

}
