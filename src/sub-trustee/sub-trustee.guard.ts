import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SubTrusteeService } from './sub-trustee.service';

@Injectable()
export class SubTrusteeGuard implements CanActivate {
  constructor(private readonly subTrustee: SubTrusteeService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req;

    const authorizationHeader = request.headers?.authorization;
    const token = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.split(' ')[1]
      : null;
    console.log(token, "token")
    if (!token) {
      return false;
    }
    try {


      const user = await this.subTrustee.validateMerchant(token);
      console.log();
      

      if (!user) {
        return false;
      }

      request.subtrustee = user.subTrustee;
      request.role = user.role;
      request.trustee = user.trustee_id;
      console.log({request});
      
      return true;
    } catch (e) {
      throw new BadRequestException(e.message)
    }

  }
}