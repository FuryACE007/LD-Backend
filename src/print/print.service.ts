import { Injectable } from '@nestjs/common';
import { CreatePrintDto } from './dto/create-print.dto';
import { UpdatePrintDto } from './dto/update-print.dto';

@Injectable()
export class PrintService {
  create(createPrintDto: CreatePrintDto) {
    return 'This action adds a new print';
  }

  findAll() {
    return `This action returns all print`;
  }

  findOne(id: number) {
    return `This action returns a #${id} print`;
  }

  update(id: number, updatePrintDto: UpdatePrintDto) {
    return `This action updates a #${id} print`;
  }

  remove(id: number) {
    return `This action removes a #${id} print`;
  }
}
