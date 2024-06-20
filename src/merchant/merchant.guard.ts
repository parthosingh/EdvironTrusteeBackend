import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
// import { Observable } from 'rxjs';
import { MerchantService } from './merchant.service';

@Injectable()
export class MerchantGuard implements CanActivate {
  constructor(private readonly merchantService: MerchantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest() ||
      GqlExecutionContext.create(context).getContext().req;
    const extractTokenFromRequest = (req: any): string | null => {
      const authorizationHeader = req.headers?.authorization;
      return authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.split(' ')[1]
        : null;
    };
    const validateToken = async (token: string): Promise<any | null> => {
      try {
        return await this.merchantService.validateMerchant(token);
      } catch {
        return null;
      }
    };
    const token = extractTokenFromRequest(request);
    if (!token || !(await validateToken(token))) {
      return false;
    }
    request.merchant =
      request.merchant || (await validateToken(token)).merchant;
    request.role = request.role || (await validateToken(token)).role;
    return !!request.merchant;
  }
}
