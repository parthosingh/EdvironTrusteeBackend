import { Test, TestingModule } from '@nestjs/testing';
import { SubTrusteeResolver } from './sub-trustee.resolver';

describe('SubTrusteeResolver', () => {
  let resolver: SubTrusteeResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubTrusteeResolver],
    }).compile();

    resolver = module.get<SubTrusteeResolver>(SubTrusteeResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
