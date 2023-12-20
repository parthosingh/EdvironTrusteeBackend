import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TrusteeService } from './trustee.service';

@Injectable()
export class TrusteeGuard implements CanActivate {
  constructor(private readonly trusteeService: TrusteeService) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      return false;
    }

    const user = await this.validateToken(token);

    if (!user) {
      return false;
    }

    // Set the user in the request for future use in controllers
    request.trustee = user;

    return true;
  }

  private extractTokenFromRequest(request: any): string | null {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return null;
    }

    return authorizationHeader.split(' ')[1];
  }

  private async validateToken(token: string): Promise<any | null> {
    try {
      return await this.trusteeService.validateTrustee(token);
    } catch (error) {
      return null;
    }
  }
}
