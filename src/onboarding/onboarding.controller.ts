import { Body, Controller, Get, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('create')
  async createOnboarder(
    @Body()
    body: {
      email: string;
      password: string;
      name: string;
      phone: string;
      trustee_id: string;
      brand_name: string;
    },
  ): Promise<any> {
    const { email, password, name, phone, trustee_id, brand_name } = body;
    return await this.onboardingService.CreateOnboarder(
      email,
      password,
      name,
      phone,
      trustee_id,
      brand_name,
    );
  }

  @Get('login')
  async loginOnboarder(@Body() body: { email: string; password: string }) {
    const { email, password } = body;
    return await this.onboardingService.loginOnboarder(email, password);
  }
}