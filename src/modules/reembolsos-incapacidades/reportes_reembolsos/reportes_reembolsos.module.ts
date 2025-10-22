import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesReembolsosController } from './reportes_reembolsos.controller';
import { ReportesReembolsosService } from './reportes_reembolsos.service';
import { SolicitudesReembolso } from '../solicitudes_reembolso/entities/solicitudes_reembolso.entity';
import { DetallesReembolso } from '../solicitudes_reembolso/entities/detalles_reembolso.entity';
import { EmpresasModule } from '../../empresas/empresas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SolicitudesReembolso, DetallesReembolso]),
    EmpresasModule,
  ],
  controllers: [ReportesReembolsosController],
  providers: [ReportesReembolsosService],
  exports: [ReportesReembolsosService],
})
export class ReportesReembolsosModule {}
