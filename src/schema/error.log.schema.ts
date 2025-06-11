import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class ErrorLogs {
  @Prop({})
  source: string;

  @Prop({})
  collect_id: string;

  @Prop({})
  error: string;
}

export type ErrorLogsDocument = ErrorLogs & Document;
export const ErrorLogsSchema = SchemaFactory.createForClass(ErrorLogs);
