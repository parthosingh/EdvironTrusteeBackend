import { Trustee } from '../schema/trustee.schema';
import { JwtPayload } from 'jsonwebtoken';
import {
  Post,
  Get,
  Body,
  BadRequestException,
  ConflictException,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  NotFoundException,
  Param,
  ForbiddenException,
  Controller,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TrusteeGuard } from './trustee.guard';
import { Types } from 'mongoose';
import { TrusteeService } from './trustee.service';

@Controller('trustee')
export class TrusteeController {
  constructor(
    private trusteeService: TrusteeService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  async createTrustee(
    @Body()
    token,
  ): Promise<Trustee> {
    try {
      const info: JwtPayload = this.jwtService.verify(
        token.data,
        {secret:process.env.PRIVATE_TRUSTEE_KEY}
      );
      const credential = await this.trusteeService.createTrustee(info);
      return credential;
    } catch (e) {
      if (e.response.statusCode === 409) {
        throw new ConflictException(e.message);
      }
      throw new BadRequestException(e.message);
    }
  }


  @Get('get-user')
  async validateUser(@Req() req): Promise<{ payload: any }> {
    try {
      // If the request reaches here, the token is valid
      const authorizationHeader = req.headers.authorization;
      const token = authorizationHeader.split(' ')[1];

      const trustee = await this.trusteeService.validateTrustee(token);

      return trustee;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else {
        throw new UnauthorizedException(error.message);
      }
    }
  }

  @Get()
  async findTrustee(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number,
  ) {
    return this.trusteeService.findTrustee(page, pageSize);
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
        {secret:process.env.PRIVATE_TRUSTEE_KEY},
      ) as JwtPayload;
      const trusteeId = new Types.ObjectId(data.trustee_id);
      const trustee = await this.trusteeService.findOneTrustee(trusteeId);

      if (!trustee) {
        throw new NotFoundException('trustee not found');
      }

      return await this.trusteeService.assignSchool(
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

  @Post(':school_id/gen-school-token')
  async generateSchoolToken(
    @Body()
    body: { password: string },
    @Param()
    param: { school_id: string },
    @Req() req,
  ) {
    try {
      const schoolToken = await this.trusteeService.generateSchoolToken(
        param.school_id,
        body.password,
        req.user,
      );
      return schoolToken;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
 
}
