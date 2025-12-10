import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { PlanillasAporte } from '../planillas_aportes/entities/planillas_aporte.entity';
import { SolicitudesReembolso } from '../reembolsos-incapacidades/solicitudes_reembolso/entities/solicitudes_reembolso.entity';

export interface AdminDashboardSummary {
  planillasDeclaradas: number;
  planillasPendientesRevision: number;
  reembolsosSolicitados: number;
  reembolsosPendientesRevision: number;
}

export interface UltimaPlanillaDeclarada {
  id: number;
  codPatronal: string;
  tipoPlanilla: string;
  empresa: string;
  fechaCreacion: Date;
  totalImporte: number;
}

export interface UltimaSolicitudReembolso {
  id: number;
  codPatronal: string;
  empresa: string;
  fechaCreacion: Date;
  totalReembolso: number;
  estado: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(PlanillasAporte)
    private readonly planillasRepository: Repository<PlanillasAporte>,
    @InjectRepository(SolicitudesReembolso)
    private readonly reembolsosRepository: Repository<SolicitudesReembolso>,
  ) {}

  async getAdminSummary(): Promise<AdminDashboardSummary> {
    const [
      planillasDeclaradas,
      planillasPendientesRevision,
      reembolsosSolicitados,
      reembolsosPendientesRevision,
    ] = await Promise.all([
      this.planillasRepository.count(),
      this.planillasRepository.count({ where: { estado: Not(2) } }),
      this.reembolsosRepository.count({ where: { estado: 1 } }),
      this.reembolsosRepository.count({ where: { estado: Not(In([0, 2])) } }),
    ]);

    return {
      planillasDeclaradas,
      planillasPendientesRevision,
      reembolsosSolicitados,
      reembolsosPendientesRevision,
    };
  }

  async getUltimasPlanillas(limit = 6): Promise<UltimaPlanillaDeclarada[]> {
    const rows = await this.planillasRepository
      .createQueryBuilder('p')
      .leftJoin('p.empresa', 'e')
      .select([
        'p.id_planilla_aportes AS id',
        'p.cod_patronal AS cod_patronal',
        'p.tipo_planilla AS tipo_planilla',
        'p.fecha_creacion AS fecha_creacion',
        'p.total_importe AS total_importe',
        'e.emp_nom AS empresa',
      ])
      .orderBy('p.fecha_creacion', 'DESC')
      .addOrderBy('p.id_planilla_aportes', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((row) => ({
      id: Number(row.id),
      codPatronal: row.cod_patronal,
      tipoPlanilla: row.tipo_planilla,
      empresa: row.empresa || 'Empresa sin nombre',
      fechaCreacion: row.fecha_creacion,
      totalImporte: Number(row.total_importe) || 0,
    }));
  }

  async getUltimasReembolsos(limit = 6): Promise<UltimaSolicitudReembolso[]> {
    const rows = await this.reembolsosRepository
      .createQueryBuilder('r')
      .leftJoin('r.empresa', 'e')
      .select([
        'r.id_solicitud_reembolso AS id',
        'r.cod_patronal AS cod_patronal',
        'r.fecha_creacion AS fecha_creacion',
        'r.total_reembolso AS total_reembolso',
        'r.estado AS estado',
        'e.emp_nom AS empresa',
      ])
      .orderBy('r.fecha_creacion', 'DESC')
      .addOrderBy('r.id_solicitud_reembolso', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((row) => ({
      id: Number(row.id),
      codPatronal: row.cod_patronal,
      empresa: row.empresa || 'Empresa sin nombre',
      fechaCreacion: row.fecha_creacion,
      totalReembolso: Number(row.total_reembolso) || 0,
      estado: Number(row.estado) || 0,
    }));
  }
}

