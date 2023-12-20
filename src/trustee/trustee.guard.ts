import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { GqlExecutionContext } from '@nestjs/graphql'; // Import GqlExecutionContext
import { TrusteeService } from './trustee.service';

@Injectable()
export class TrusteeGuard implements CanActivate {
  constructor(private readonly trusteeService: TrusteeService) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check if the context is an HTTP request or a GraphQL request
    if (request) {
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
    } else {
      // If it's a GraphQL request, use GqlExecutionContext to access the context
      const gqlContext = GqlExecutionContext.create(context);
      const token = this.extractTokenFromRequest(gqlContext.getContext().req);

      if (!token) {
        return false;
      }

      const user = await this.validateToken(token);

      if (!user) {
        return false;
      }

      // Set the user in the request for future use in resolvers
      gqlContext.getContext().req.trustee = user.id;

      return true;
    }
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
