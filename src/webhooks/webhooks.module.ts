import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookLogs, WebhookLogsSchema } from 'src/schema/webhook.schema';
import { WebhooksController } from './webhooks.controller';
import { RefundRequest, RefundRequestSchema } from 'src/schema/refund.schema';
import { VendorsSettlement, VendorsSettlementSchema } from 'src/schema/vendor.settlements.schema';
import { Vendors, VendorsSchema } from 'src/schema/vendors.schema';
import { SchoolSchema, TrusteeSchool } from 'src/schema/school.schema';
import { Trustee, TrusteeSchema } from 'src/schema/trustee.schema';
import { Disputes, DisputesSchema } from 'src/schema/disputes.schema';
import { TempSettlementReport, TempSettlementReportSchema } from 'src/schema/tempSettlements.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WebhookLogs.name, schema: WebhookLogsSchema }]),
    MongooseModule.forFeature([
        { name: RefundRequest.name, schema: RefundRequestSchema },
      ]),
      MongooseModule.forFeature([
        { name: Vendors.name, schema: VendorsSchema },
      ]),
      MongooseModule.forFeature([
        { name: TrusteeSchool.name, schema: SchoolSchema },
      ]),

      MongooseModule.forFeature([
        { name: VendorsSettlement.name, schema: VendorsSettlementSchema },
      ]),
      
      MongooseModule.forFeature([
        { name: Trustee.name, schema: TrusteeSchema },
      ]),
      MongooseModule.forFeature([
        { name: Disputes.name, schema: DisputesSchema },
      ]),

      MongooseModule.forFeature([
        { name: TempSettlementReport.name, schema: TempSettlementReportSchema },
      ]),
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule {}

