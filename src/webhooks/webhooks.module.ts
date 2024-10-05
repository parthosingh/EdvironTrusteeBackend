import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookLogs, WebhookLogsSchema } from 'src/schema/webhook.schema';
import { WebhooksController } from './webhooks.controller';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WebhookLogs.name, schema: WebhookLogsSchema }]),
    MongooseModule.forFeature([
        { name: RefundRequest.name, schema: RefundRequestSchema },
      ]),
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule {}

