import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { TrusteeService } from './trustee.service';

@Controller('trustee')
export class TrusteeController {
  constructor(private trusteeService: TrusteeService) {}
  @Post('createStudent')
  async createStudent(
    @Body()
    body,
  ) {
    try {
      const student = await this.trusteeService.createStudent(
        body,
        body.schoolId,
        body.userId,
      );
      return student;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
