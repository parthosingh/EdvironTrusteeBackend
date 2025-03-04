import { Module } from '@nestjs/common';
import { PdfService } from './pdf-service.service';

@Module({
  providers: [PdfService],
})
export class PdfServiceModule {}
