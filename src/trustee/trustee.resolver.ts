import { Resolver, Query, Args } from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
import { TrusteeSchool } from './schema/school.schema';
import { ConflictException, BadRequestException } from '@nestjs/common';

@Resolver('Trustee')
export class TrusteeResolver {
  constructor(private readonly trusteeService: TrusteeService) {}

  @Query(() => String)
  async hello(): Promise<string> {
    return 'Hello, World!!!';
  }
  @Query(() => [TrusteeSchool])
  async getSchoolQuery(@Args('trustee_id') id: string): Promise<any[]> {
    try {
      const schools = await this.trusteeService.getSchools(id);

      return schools;
    } catch (error) {
      const customError = {
        message: error.message,
        statusCode: error.status,
      };
      if (error instanceof ConflictException) {
        throw new ConflictException(customError);
      } else {
        throw new BadRequestException(customError);
      }
    }
  }
}
