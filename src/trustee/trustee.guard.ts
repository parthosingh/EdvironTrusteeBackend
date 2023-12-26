import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { TrusteeService } from './trustee.service';
@Injectable()
export class TrusteeGuard implements CanActivate {
  constructor(private readonly trusteeService: TrusteeService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() || GqlExecutionContext.create(context).getContext().req;
    const extractTokenFromRequest = (req: any): string | null => {
      const authorizationHeader = req.headers?.authorization;
      return authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.split(' ')[1] : null;
    };
    const validateToken = async (token: string): Promise<any | null> => {
      try {
        return await this.trusteeService.validateTrustee(token);
      } catch {
        return null;
      }
    };
    const token = extractTokenFromRequest(request);
    if (!token || !(await validateToken(token))) {
      return false;
    }
    request.trustee = request.trustee || (await validateToken(token)).id;
    return !!request.trustee;
  }
}