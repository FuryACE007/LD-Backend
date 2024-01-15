import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PrintService } from './print.service';
import { CreatePrintDto } from './dto/create-print.dto';
import { UpdatePrintDto } from './dto/update-print.dto';

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post()
  create(@Body() createPrintDto: CreatePrintDto) {
    return this.printService.create(createPrintDto);
  }

  @Get()
  findAll() {
    return this.printService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.printService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePrintDto: UpdatePrintDto) {
    return this.printService.update(+id, updatePrintDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.printService.remove(+id);
  }
}
