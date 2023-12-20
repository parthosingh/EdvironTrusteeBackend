import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UnauthorizedException } from '@nestjs/common';
import { ErpService } from './erp.service';

@Injectable()
export class ErpGuard implements CanActivate {
  constructor(private readonly erpService: ErpService) {} // Inject your authentication service

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorizationHeader = request.headers['authorization'];

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is missing');
    }

    const token = authorizationHeader.substring(7); // Remove 'Bearer ' to get the token

    try {
      const userTrustee = await this.erpService.validateApiKey(token);
      request.userTrustee = userTrustee;
      return true;
    } catch (error) {
      // Handle invalid API key or other errors
      throw new UnauthorizedException('Invalid Bearer token');
    }
  }
}
