import { Module } from '@nestjs/common';
import { ReconcilationService } from './reconcilation.service';
import { DatabaseModule } from 'src/database/database.module';
import { ErpService } from 'src/erp/erp.service';
import { JwtService } from '@nestjs/jwt';
import { CashfreeService } from 'src/cashfree/cashfree.service';
import { ReconcilationController } from './reconcilation.controller';

@Module({
  providers: [ReconcilationService,ErpService,JwtService,CashfreeService],
  imports:[DatabaseModule],
  controllers: [ReconcilationController]
})
export class ReconcilationModule {}
