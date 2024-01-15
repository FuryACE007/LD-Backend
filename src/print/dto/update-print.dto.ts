import { PartialType } from '@nestjs/mapped-types';
import { CreatePrintDto } from './create-print.dto';

export class UpdatePrintDto extends PartialType(CreatePrintDto) {}
