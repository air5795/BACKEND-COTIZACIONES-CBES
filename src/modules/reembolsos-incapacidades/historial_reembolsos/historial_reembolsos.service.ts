import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { SolicitudesReembolso } from '../solicitudes_reembolso/entities/solicitudes_reembolso.entity';
import { DetallesReembolso } from '../solicitudes_reembolso/entities/detalles_reembolso.entity';

@Injectable()
export class HistorialReembolsosService {
  constructor(
    @InjectRepository(SolicitudesReembolso)
    public readonly reembolsoRepo: Repository<SolicitudesReembolso>,
    @InjectRepository(DetallesReembolso)
    private readonly detalleRepo: Repository<DetallesReembolso>,
  ) {}

  //1.- OBTENER TODAS LAS SOLICITUDES PRESENTADAS CON PAGINACIÓN Y FILTROS -------------------------------------------------------------------------
  async obtenerSolicitudesPresentadas(
    pagina: number = 1,
    limite: number = 10,
    busqueda: string = '',
    mes?: string,
    anio?: string,
    codPatronal?: string
  ) {
    try {
      console.log('🔄 Iniciando consulta de historial:', { pagina, limite, busqueda, mes, anio, codPatronal });

      // Validar parámetros
      if (pagina < 1 || limite < 1) {
        throw new BadRequestException('La página y el límite deben ser mayores que 0');
      }
      if (mes && (isNaN(Number(mes)) || Number(mes) < 1 || Number(mes) > 12)) {
        throw new BadRequestException('El mes debe ser un número entre 1 y 12');
      }
      if (anio && (isNaN(Number(anio)) || Number(anio) < 2000 || Number(anio) > 2100)) {
        throw new BadRequestException('El año debe ser un número válido');
      }

      // Calcular offset
      const offset = (pagina - 1) * limite;

      // Construir query builder más simple
      const queryBuilder = this.reembolsoRepo
      .createQueryBuilder('solicitud')
      .leftJoin('solicitud.empresa', 'empresa')
      .addSelect(['empresa.id_empresa', 'empresa.emp_nom', 'empresa.cod_patronal'])
      .where('solicitud.estado != :estado', { estado: 0 })
      .orderBy('solicitud.fecha_modificacion', 'DESC');

      // Aplicar filtros
      if (busqueda) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('LOWER(empresa.emp_nom) LIKE LOWER(:busqueda)', { busqueda: `%${busqueda}%` })
              .orWhere('LOWER(empresa.cod_patronal) LIKE LOWER(:busqueda)', { busqueda: `%${busqueda}%` })
              .orWhere('LOWER(solicitud.cod_patronal) LIKE LOWER(:busqueda)', { busqueda: `%${busqueda}%` });
          })
        );
      }

      if (mes) {
        queryBuilder.andWhere('solicitud.mes = :mes', { mes });
      }

      if (anio) {
        queryBuilder.andWhere('solicitud.gestion = :anio', { anio });
      }

      if (codPatronal) {
        queryBuilder.andWhere('solicitud.cod_patronal = :codPatronal', { codPatronal });
      }

      console.log('📋 Query SQL generado:', queryBuilder.getSql());

      // Obtener total de registros
      const totalRegistros = await queryBuilder.getCount();
      console.log('📊 Total registros encontrados:', totalRegistros);

      // Aplicar paginación
      queryBuilder.skip(offset).take(limite);

      // Ejecutar consulta
      const solicitudes = await queryBuilder.getMany();
      console.log('✅ Solicitudes obtenidas:', solicitudes.length);

      // Calcular total de páginas
      const totalPaginas = Math.ceil(totalRegistros / limite);

      console.log(`📊 Historial de reembolsos obtenido:
      - Total registros: ${totalRegistros}
      - Página: ${pagina}/${totalPaginas}
      - Límite: ${limite}
      - Búsqueda: "${busqueda}"
      - Filtros: mes=${mes}, año=${anio}, codPatronal=${codPatronal}`);

      return {
        solicitudes,
        paginacion: {
          pagina,
          limite,
          totalRegistros,
          totalPaginas,
          tieneSiguiente: pagina < totalPaginas,
          tieneAnterior: pagina > 1
        }
      };

    } catch (error) {
      console.error('❌ Error al obtener historial de reembolsos:', error);
      throw new BadRequestException(`Error al obtener el historial de reembolsos: ${error.message}`);
    }
  }

  //2.- OBTENER ESTADÍSTICAS GENERALES -------------------------------------------------------------------------
  async obtenerEstadisticasGenerales() {
    try {
      // Total de solicitudes presentadas
      const totalSolicitudes = await this.reembolsoRepo.count({
        where: { estado: 1 }
      });

      // Total de trabajadores en todas las solicitudes presentadas
      const totalTrabajadores = await this.reembolsoRepo
        .createQueryBuilder('solicitud')
        .select('SUM(solicitud.total_trabajadores)', 'total')
        .where('solicitud.estado = :estado', { estado: 1 })
        .getRawOne();

      // Total de monto de reembolso en todas las solicitudes presentadas
      const totalMonto = await this.reembolsoRepo
        .createQueryBuilder('solicitud')
        .select('SUM(solicitud.total_reembolso)', 'total')
        .where('solicitud.estado = :estado', { estado: 1 })
        .getRawOne();

      // Solicitudes por mes (últimos 12 meses)
      const solicitudesPorMes = await this.reembolsoRepo
        .createQueryBuilder('solicitud')
        .select('solicitud.mes, solicitud.gestion, COUNT(*) as cantidad')
        .where('solicitud.estado = :estado', { estado: 1 })
        .groupBy('solicitud.mes, solicitud.gestion')
        .orderBy('solicitud.gestion', 'DESC')
        .addOrderBy('solicitud.mes', 'DESC')
        .limit(12)
        .getRawMany();

      // Empresas con más solicitudes
      const empresasTop = await this.reembolsoRepo
        .createQueryBuilder('solicitud')
        .leftJoin('solicitud.empresa', 'empresa')
        .select('empresa.razon_social, empresa.cod_patronal, COUNT(*) as cantidad')
        .where('solicitud.estado = :estado', { estado: 1 })
        .groupBy('empresa.id_empresa, empresa.razon_social, empresa.cod_patronal')
        .orderBy('cantidad', 'DESC')
        .limit(10)
        .getRawMany();

      return {
        totalSolicitudes,
        totalTrabajadores: parseInt(totalTrabajadores.total) || 0,
        totalMonto: parseFloat(totalMonto.total) || 0,
        solicitudesPorMes,
        empresasTop
      };

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw new BadRequestException('Error al obtener estadísticas');
    }
  }

  //3.- OBTENER DETALLES DE UNA SOLICITUD ESPECÍFICA -------------------------------------------------------------------------
  async obtenerDetallesSolicitud(idSolicitud: number) {
    try {
      const solicitud = await this.reembolsoRepo.findOne({
        where: { id_solicitud_reembolso: idSolicitud },
        relations: ['empresa']
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud no encontrada');
      }


      // Obtener detalles
      const detalles = await this.detalleRepo.find({
        where: { id_solicitud_reembolso: idSolicitud },
        order: { nro: 'ASC' }
      });

      // Calcular totales por tipo SOLO contabilizando los detalles NO observados
      const totalesPorTipo = {
        ENFERMEDAD: { trabajadores: 0, monto: 0 },
        MATERNIDAD: { trabajadores: 0, monto: 0 },
        PROFESIONAL: { trabajadores: 0, monto: 0 }
      };

      // Filtrar detalles contabilizables (NO observados)
      const detallesContabilizables = detalles.filter(d => d.estado_revision !== 'observado');

      // Calcular totales solo con detalles contabilizables
      detallesContabilizables.forEach(detalle => {
        const tipo = detalle.tipo_incapacidad as keyof typeof totalesPorTipo;
        if (totalesPorTipo[tipo]) {
          totalesPorTipo[tipo].trabajadores++;
          totalesPorTipo[tipo].monto += parseFloat(detalle.monto_reembolso?.toString() || '0');
        }
      });

      const totalTrabajadores = detallesContabilizables.length;
      const totalMonto = detallesContabilizables.reduce(
        (sum, detalle) => sum + parseFloat(detalle.monto_reembolso?.toString() || '0'), 
        0
      );

      console.log('📊 Totales calculados:', {
        totalTrabajadores,
        totalMonto,
        detallesObservados: detalles.length - detallesContabilizables.length,
        detallesContabilizados: detallesContabilizables.length
      });

      return {
        solicitud,
        detalles, // Se devuelven TODOS los detalles para mostrar en la tabla
        totalesPorTipo, // Pero los totales solo incluyen los NO observados
        totalTrabajadores, // Total de trabajadores contabilizados (sin observados)
        totalMonto // Monto total contabilizado (sin observados)
      };

    } catch (error) {
      console.error('Error al obtener detalles de solicitud:', error);
      throw error;
    }
  }

  //4.- OBTENER ESTADÍSTICAS POR EMPRESA -------------------------------------------------------------------------
  async obtenerEstadisticasPorEmpresa(codPatronal: string) {
    try {
      const solicitudes = await this.reembolsoRepo.find({
        where: { 
          cod_patronal: codPatronal,
          estado: 1 
        },
        relations: ['empresa'],
        order: { fecha_modificacion: 'DESC' }
      });

      if (solicitudes.length === 0) {
        return {
          empresa: null,
          totalSolicitudes: 0,
          totalTrabajadores: 0,
          totalMonto: 0,
          solicitudes: []
        };
      }

      const totalTrabajadores = solicitudes.reduce((sum, sol) => sum + sol.total_trabajadores, 0);
      const totalMonto = solicitudes.reduce((sum, sol) => sum + parseFloat(sol.total_reembolso?.toString() || '0'), 0);

      return {
        empresa: solicitudes[0].empresa,
        totalSolicitudes: solicitudes.length,
        totalTrabajadores,
        totalMonto,
        solicitudes
      };

    } catch (error) {
      console.error('Error al obtener estadísticas por empresa:', error);
      throw new BadRequestException('Error al obtener estadísticas de la empresa');
    }
  }

  //5.- APROBAR PLANILLA COMPLETA -------------------------------------------------------------------------
  async aprobarPlanilla(idSolicitud: number, usuarioAprobacion?: string) {
    try {
      console.log('✅ Aprobando planilla:', { idSolicitud, usuarioAprobacion });

      // Buscar la solicitud
      const solicitud = await this.reembolsoRepo.findOne({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de reembolso no encontrada');
      }

      // Verificar que esté presentada (estado 1)
      if (solicitud.estado !== 1) {
        throw new BadRequestException('Solo se pueden aprobar solicitudes en estado PRESENTADO');
      }

      // Obtener todos los detalles de la solicitud
      const detalles = await this.detalleRepo.find({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      // Contar detalles observados
      const detallesObservados = detalles.filter(d => d.estado_revision === 'observado');

      // Actualizar estado de la solicitud a APROBADO (2)
      await this.reembolsoRepo.update(idSolicitud, {
        estado: 2,
        fecha_modificacion: new Date()
      });

      console.log('✅ Planilla aprobada:', {
        idSolicitud,
        totalDetalles: detalles.length,
        detallesObservados: detallesObservados.length,
        detallesAprobados: detalles.length - detallesObservados.length
      });

      return {
        mensaje: 'Planilla aprobada exitosamente',
        solicitud: {
          id: idSolicitud,
          estadoAnterior: 1,
          estadoNuevo: 2
        },
        resumen: {
          totalDetalles: detalles.length,
          detallesObservados: detallesObservados.length,
          detallesAprobados: detalles.length - detallesObservados.length
        }
      };

    } catch (error) {
      console.error('❌ Error al aprobar planilla:', error);
      throw new BadRequestException(`Error al aprobar planilla: ${error.message}`);
    }
  }

  //6.- OBSERVAR PLANILLA COMPLETA -------------------------------------------------------------------------
  async observarPlanilla(idSolicitud: number, observaciones: string, usuarioObservacion?: string) {
    try {
      console.log('⚠️ Observando planilla:', { idSolicitud, observaciones, usuarioObservacion });

      // Validar que se proporcionen observaciones
      if (!observaciones || observaciones.trim() === '') {
        throw new BadRequestException('Las observaciones son requeridas para observar una planilla');
      }

      // Buscar la solicitud
      const solicitud = await this.reembolsoRepo.findOne({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de reembolso no encontrada');
      }

      // Verificar que esté presentada (estado 1)
      if (solicitud.estado !== 1) {
        throw new BadRequestException('Solo se pueden observar solicitudes en estado PRESENTADO');
      }

      // Actualizar estado de la solicitud a OBSERVADO (3) y guardar observaciones
      await this.reembolsoRepo.update(idSolicitud, {
        estado: 3,
        observaciones: observaciones.trim(),
        fecha_modificacion: new Date()
      });

      console.log('✅ Planilla observada exitosamente');

      return {
        mensaje: 'Planilla observada exitosamente',
        solicitud: {
          id: idSolicitud,
          estadoAnterior: 1,
          estadoNuevo: 3,
          observaciones: observaciones.trim()
        }
      };

    } catch (error) {
      console.error('❌ Error al observar planilla:', error);
      throw new BadRequestException(`Error al observar planilla: ${error.message}`);
    }
  }

  //7.- ACTUALIZAR ESTADO DE REVISIÓN DE UN DETALLE -------------------------------------------------------------------------
  async actualizarEstadoRevision(idDetalle: number, estadoRevision: 'neutro' | 'aprobado' | 'observado', observaciones?: string) {
    try {
      console.log('🔄 Actualizando estado de revisión:', { idDetalle, estadoRevision, observaciones });

      // Buscar el detalle
      const detalle = await this.detalleRepo.findOne({
        where: { id_detalle_reembolso: idDetalle }
      });

      if (!detalle) {
        throw new NotFoundException('Detalle de reembolso no encontrado');
      }

      // Guardar el ID de la solicitud antes de actualizar
      const idSolicitud = detalle.id_solicitud_reembolso;

      // Actualizar el detalle
      const updateData: any = {
        usuario_modificacion: 'ADMIN',
        fecha_modificacion: new Date()
      };

      // Manejar el estado de revisión
      if (estadoRevision === 'neutro') {
        // Si es neutro, limpiar estado y observaciones (como si no hubiera pasado nada)
        updateData.estado_revision = null;
        updateData.observaciones = '';
      } else {
        // Para aprobado u observado, guardar el estado
        updateData.estado_revision = estadoRevision;
        
        // Si es observado, actualizar observaciones
        if (estadoRevision === 'observado' && observaciones) {
          updateData.observaciones = observaciones;
        }
      }

      await this.detalleRepo.update(idDetalle, updateData);

      console.log('✅ Estado de revisión actualizado en detalle');

      // ===== RECALCULAR TOTALES DE LA CABECERA =====
      console.log('🔄 Recalculando totales de la solicitud...');

      // Obtener todos los detalles de la solicitud
      const todosLosDetalles = await this.detalleRepo.find({
        where: { id_solicitud_reembolso: idSolicitud }
      });

      // Filtrar solo los detalles que NO están observados (estado_revision !== 'observado')
      // Los detalles aprobados o neutros (null) SÍ se contabilizan
      const detallesContabilizables = todosLosDetalles.filter(d => 
        d.estado_revision !== 'observado'
      );

      // Calcular totales basados solo en detalles no observados
      const totalTrabajadores = detallesContabilizables.length;
      const totalReembolso = detallesContabilizables.reduce((sum, d) => 
        sum + parseFloat(d.monto_reembolso?.toString() || '0'), 
        0
      );

      // Actualizar la cabecera de la solicitud
      await this.reembolsoRepo.update(idSolicitud, {
        total_trabajadores: totalTrabajadores,
        total_reembolso: totalReembolso,
        fecha_modificacion: new Date()
      });

      console.log('✅ Totales de cabecera actualizados:', {
        totalTrabajadores,
        totalReembolso: totalReembolso.toFixed(2),
        detallesObservados: todosLosDetalles.length - detallesContabilizables.length
      });

      return {
        mensaje: 'Estado de revisión actualizado exitosamente y totales recalculados',
        detalle: {
          id: idDetalle,
          estadoRevision,
          observaciones: estadoRevision === 'observado' ? observaciones : (estadoRevision === 'neutro' ? '' : detalle.observaciones)
        },
        totalesActualizados: {
          total_trabajadores: totalTrabajadores,
          total_reembolso: totalReembolso,
          detalles_totales: todosLosDetalles.length,
          detalles_contabilizados: detallesContabilizables.length,
          detalles_observados: todosLosDetalles.length - detallesContabilizables.length
        }
      };

    } catch (error) {
      console.error('❌ Error al actualizar estado de revisión:', error);
      throw new BadRequestException(`Error al actualizar estado de revisión: ${error.message}`);
    }
  }
}
