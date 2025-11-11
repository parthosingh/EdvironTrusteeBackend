import { Module } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { CommissionController } from './commission.controller';
import { DatabaseService } from 'src/database/database.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [CommissionService,DatabaseService],
  imports: [DatabaseModule],
  controllers: [CommissionController]
})
export class CommissionModule {}
