import {
  Post,
  Get,
  Body,
  Req,
  Param,
  Controller,
} from '@nestjs/common';
import { TrusteeService } from './trustee.service';

@Controller('trustee')
export class TrusteeController {
  constructor(
    private trusteeService: TrusteeService,
  ) {}


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
      throw error;
    }
  }
 
}
