import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorialReembolsosService } from './historial_reembolsos.service';
import { HistorialReembolsosController } from './historial_reembolsos.controller';
import { SolicitudesReembolso } from '../solicitudes_reembolso/entities/solicitudes_reembolso.entity';
import { DetallesReembolso } from '../solicitudes_reembolso/entities/detalles_reembolso.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SolicitudesReembolso, DetallesReembolso])
  ],
  controllers: [HistorialReembolsosController],
  providers: [HistorialReembolsosService],
  exports: [HistorialReembolsosService]
})
export class HistorialReembolsosModule {}
