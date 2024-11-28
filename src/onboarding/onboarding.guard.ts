import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { OnboardingService } from './onboarding.service';

@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(private readonly onboardingService: OnboardingService) {}
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
        return await this.onboardingService.validateOnboarder(token);
      } catch {
        return null;
      }
    };

    const token = extractTokenFromRequest(request);
    if (!token || !(await validateToken(token))) {
      return false;
    }

    request.user = request.user || (await validateToken(token)).id;
    request.trustee =
      request.trustee || (await validateToken(token)).head_trustee;
  
    return !!request.trustee;
  }
}