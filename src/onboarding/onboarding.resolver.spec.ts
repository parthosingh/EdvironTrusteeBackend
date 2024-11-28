import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingResolver } from './onboarding.resolver';

describe('OnboardingResolver', () => {
  let resolver: OnboardingResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingResolver],
    }).compile();

    resolver = module.get<OnboardingResolver>(OnboardingResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
