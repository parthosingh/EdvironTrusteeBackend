import { Test, TestingModule } from '@nestjs/testing';
import { TrusteeResolver } from './trustee.resolver';

describe('TrusteeResolver', () => {
  let resolver: TrusteeResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrusteeResolver],
    }).compile();

    resolver = module.get<TrusteeResolver>(TrusteeResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
