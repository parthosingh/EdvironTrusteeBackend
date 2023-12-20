import {
  Post,
  Get,
  Body,
  Req,
  UnauthorizedException,
  NotFoundException,
  Param,
  Controller,
  UseGuards,
} from '@nestjs/common';
import { TrusteeGuard } from './trustee.guard';
import { TrusteeService } from './trustee.service';

@Controller('trustee')
export class TrusteeController {
  constructor(
    private trusteeService: TrusteeService,
  ) {}

  @Get('')
  @UseGuards(TrusteeGuard)
  hello(){
    return "HELLO WORLD"
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
