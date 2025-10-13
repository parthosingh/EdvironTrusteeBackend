import { Module } from '@nestjs/common';
import { CanteenService } from './canteen.service';
import { CanteenController } from './canteen.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [CanteenService],
  imports: [DatabaseModule],
  controllers: [CanteenController]
})
export class CanteenModule {}
