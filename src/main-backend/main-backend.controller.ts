import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Post, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MainBackendService } from './main-backend.service';
import { JwtPayload } from 'jsonwebtoken';
import { Trustee } from 'src/schema/trustee.schema';
import { Types } from 'mongoose';

@Controller('main-backend')
export class MainBackendController {

    constructor(
        private mainBackendService: MainBackendService,
        private readonly jwtService: JwtService,
      ) {}

    @Post('create-trustee')
    async createTrustee(
      @Body()
      token,
    ): Promise<Trustee> {
      try {
        const info: JwtPayload = this.jwtService.verify(
          token.data,
          {secret:process.env.JWT_SECRET_FOR_INTRANET}
        );
        const credential = await this.mainBackendService.createTrustee(info);
        return credential;
      } catch (e) {
        if (e.response.statusCode === 409) {
          throw new ConflictException(e.message);
        }
        throw new BadRequestException(e.message);
      }
    }

    @Get('find-all-trustee')
    async findTrustee(
      @Query('page') page: number,
      @Query('pageSize') pageSize: number,
    ) {
      return this.mainBackendService.findTrustee(page, pageSize);
    }
  
    @Post('assign-school')
    async assignSchool(
      @Body()
      token: {
        token: string;
      },
    ) {
      try {
        const data: JwtPayload = this.jwtService.verify(
          token.token,
          {secret:process.env.JWT_SECRET_FOR_INTRANET},
        ) as JwtPayload;
        const trusteeId = new Types.ObjectId(data.trustee_id);
        const trustee = await this.mainBackendService.findOneTrustee(trusteeId);
  
        if (!trustee) {
          throw new NotFoundException('trustee not found');
        }
  
        return await this.mainBackendService.assignSchool(
          data.school_id,
          data.trustee_id,
          data.school_name,
        );
      } catch (error) {
        if (error.response.statusCode === 403) {
          throw new ForbiddenException(error.message);
        }
  
        throw new BadRequestException(error.message);
      }
    }
}
