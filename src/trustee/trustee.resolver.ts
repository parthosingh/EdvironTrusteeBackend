import { Resolver, Query, Args, Int } from '@nestjs/graphql';
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
  async getSchoolQuery(
    @Args('trustee_id') id: string,
    @Args('limit', { type: () => Int, defaultValue: 5 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
  ): Promise<any[]> {
    try {
      const schools = await this.trusteeService.getSchools(id, limit, offset);

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
