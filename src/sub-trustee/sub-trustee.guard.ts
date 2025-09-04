import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SubTrusteeService } from './sub-trustee.service';

@Injectable()
export class SubTrusteeGuard implements CanActivate {
  constructor(private readonly subTrustee: SubTrusteeService) {}

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

    const user = await this.subTrustee.validateMerchant(token);
    if (!user || user.role !== 'subtrustee') {
      return false;
    }

    request.subtrustee = user.subTrustee; 
    request.role = user.role;
    request.trustee = user.trustee_id;

    return true;
  }
}