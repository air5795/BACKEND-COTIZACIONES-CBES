import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamableFile } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as carbone from 'carbone';
import * as moment from 'moment-timezone';
import { SolicitudesReembolso } from '../solicitudes_reembolso/entities/solicitudes_reembolso.entity';
import { DetallesReembolso } from '../solicitudes_reembolso/entities/detalles_reembolso.entity';
import { EmpresasService } from '../../empresas/empresas.service';

@Injectable()
export class ReportesReembolsosService {
  constructor(
    @InjectRepository(SolicitudesReembolso)
    private solicitudesRepo: Repository<SolicitudesReembolso>,
    @InjectRepository(DetallesReembolso)
    private detallesRepo: Repository<DetallesReembolso>,
    private empresasService: EmpresasService,
  ) {}

  /**
   * Genera reporte de reembolsos por grupos (enfermedad, maternidad, profesional)
   * @param idSolicitud - ID de la solicitud de reembolso
   * @returns StreamableFile con el reporte PDF
   */
  async generarReporteReembolsosPorGrupos(
    idSolicitud: number,
  ): Promise<StreamableFile> {
    try {
      console.log('=== INICIO generarReporteReembolsosPorGrupos ===');
      console.log('Parámetros:', { idSolicitud });

      // Validar parámetros
      if (!idSolicitud || idSolicitud < 1) {
        throw new BadRequestException('El ID de la solicitud es obligatorio y debe ser un número válido');
      }

      // Obtener la solicitud de reembolso específica
      console.log('🔍 Buscando solicitud de reembolso...');
      const solicitud = await this.obtenerSolicitudReembolso(idSolicitud);

      if (!solicitud) {
        throw new BadRequestException(`No se encontró la solicitud de reembolso con ID: ${idSolicitud}`);
      }

      console.log('📋 Solicitud encontrada:', {
        id: solicitud.id_solicitud_reembolso,
        estado: solicitud.estado,
        fecha_solicitud: solicitud.fecha_solicitud,
        total_reembolso: solicitud.total_reembolso,
        empresa: solicitud.empresa ? solicitud.empresa.emp_nom : 'No encontrada'
      });

      // Procesar datos por grupos
      const datosProcesados = await this.procesarDatosPorGrupos([solicitud]);

      // Preparar datos para el reporte
      const data = {
        datos_empresa: {
          cod_patronal: this.aMayusculas(solicitud.empresa.cod_patronal),
          nombre_empresa: this.aMayusculas(solicitud.empresa.emp_nom),
        },
        solicitud: {
          id_solicitud: solicitud.id_solicitud_reembolso,
          mes: this.obtenerNombreMes(solicitud.mes),
          gestion: solicitud.gestion,
          fecha_solicitud: moment(solicitud.fecha_solicitud).format('DD/MM/YYYY'),
          total_reembolso: this.redondearMonto(solicitud.total_reembolso),
          total_trabajadores: solicitud.total_trabajadores,
          estado: this.obtenerNombreEstado(solicitud.estado),
        },
        grupos: datosProcesados.grupos,
        total_global: datosProcesados.totalGlobal,
         metadatos: {
           fecha_reporte: moment().tz('America/La_Paz').format('DD/MM/YYYY'),
           hora_reporte: moment().tz('America/La_Paz').format('HH:mm:ss'),
           total_detalles: solicitud.detalles ? solicitud.detalles.length : 0,
           nota: 'Reporte generado automáticamente por el sistema - CBES',
         },
         presentacion: {
           nombre_usuario: solicitud.nombre_usuario || 'No especificado',
           fecha_presentacion: solicitud.fecha_presentacion ? moment(solicitud.fecha_presentacion).tz('America/La_Paz').format('DD/MM/YYYY HH:mm:ss') : null,
           estado: this.obtenerNombreEstado(solicitud.estado),
         },
      };

      console.log('Datos para el reporte:', JSON.stringify(data, null, 2));

      // Verificar existencia de plantilla
      const templatePath = path.resolve('reports/reporte_reembolsos_grupos.docx');
      if (!fs.existsSync(templatePath)) {
        throw new BadRequestException(`La plantilla en ${templatePath} no existe`);
      }

      // Generar el reporte con Carbone
      return new Promise<StreamableFile>((resolve, reject) => {
        carbone.render(
          templatePath,
          data,
          { convertTo: 'pdf' },
          (err, result) => {
            if (err) {
              console.error('Error en Carbone:', err);
              return reject(new BadRequestException(`Error al generar el reporte con Carbone: ${err.message}`));
            }

            console.log('Reporte generado correctamente');

            if (typeof result === 'string') {
              result = Buffer.from(result, 'utf-8');
            }

            resolve(
              new StreamableFile(result, {
                type: 'application/pdf',
                disposition: `attachment; filename=reporte_reembolsos_${idSolicitud}.pdf`,
              }),
            );
          },
        );
      });
    } catch (error) {
      console.error('Error en generarReporteReembolsosPorGrupos:', error);
      throw new BadRequestException(`Error al generar el reporte: ${error.message}`);
    }
  }

  /**
   * Obtiene una solicitud de reembolso específica por ID
   */
  private async obtenerSolicitudReembolso(idSolicitud: number): Promise<any> {
    console.log('🔍 Buscando solicitud con ID:', idSolicitud);
    
    const solicitud = await this.solicitudesRepo
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.detalles', 'detalles')
      .leftJoinAndSelect('solicitud.empresa', 'empresa')
      .where('solicitud.id_solicitud_reembolso = :idSolicitud', { idSolicitud })
      .getOne();

    console.log(`📊 Solicitud encontrada: ${solicitud ? 'Sí' : 'No'}`);
    if (solicitud) {
      console.log('📋 Detalles de la solicitud:', {
        id: solicitud.id_solicitud_reembolso,
        estado: solicitud.estado,
        fecha_solicitud: solicitud.fecha_solicitud,
        total_reembolso: solicitud.total_reembolso,
        total_trabajadores: solicitud.total_trabajadores,
        empresa: solicitud.empresa ? solicitud.empresa.emp_nom : 'No encontrada',
        detalles_count: solicitud.detalles ? solicitud.detalles.length : 0
      });
    }

    return solicitud;
  }

  /**
   * Obtiene el nombre del estado basado en el número
   */
  private obtenerNombreEstado(estado: number): string {
    const estados = {
      0: 'BORRADOR',
      1: 'PRESENTADO',
      2: 'APROBADO',
      3: 'OBSERVADO'
    };
    return estados[estado] || 'DESCONOCIDO';
  }

  /**
   * Obtiene el nombre del mes basado en el número
   */
  private obtenerNombreMes(mes: string): string {
    const meses = {
      '01': 'ENERO',
      '02': 'FEBRERO',
      '03': 'MARZO',
      '04': 'ABRIL',
      '05': 'MAYO',
      '06': 'JUNIO',
      '07': 'JULIO',
      '08': 'AGOSTO',
      '09': 'SEPTIEMBRE',
      '10': 'OCTUBRE',
      '11': 'NOVIEMBRE',
      '12': 'DICIEMBRE'
    };
    return meses[mes] || mes.toUpperCase();
  }

  /**
   * Redondea un monto a 2 decimales
   */
  private redondearMonto(monto: number | null | undefined): number {
    if (monto === null || monto === undefined || isNaN(monto)) {
      return 0.00;
    }
    return Math.round((Number(monto) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Convierte texto a mayúsculas
   */
  private aMayusculas(texto: string | null | undefined): string {
    if (!texto || texto === null || texto === undefined) {
      return '';
    }
    return String(texto).toUpperCase();
  }

  /**
   * Obtiene las solicitudes de reembolso para un período específico
   */
  private async obtenerSolicitudesReembolso(
    codPatronal: string,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<any[]> {
    console.log('🔍 Parámetros de búsqueda:', { codPatronal, fechaInicio, fechaFin, estados: [1, 2] });
    
    const query = this.solicitudesRepo
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.detalles', 'detalles')
      .leftJoinAndSelect('solicitud.empresa', 'empresa')
      .where('empresa.cod_patronal = :codPatronal', { codPatronal })
      .andWhere('solicitud.fecha_solicitud >= :fechaInicio', { fechaInicio })
      .andWhere('solicitud.fecha_solicitud <= :fechaFin', { fechaFin })
      .andWhere('solicitud.estado IN (:...estados)', { estados: [1, 2] }); // Solicitudes presentadas (1) y aprobadas (2)

    console.log('📝 Query SQL generada:', query.getSql());
    console.log('📝 Parámetros de la query:', query.getParameters());

    // Debugging: Verificar si existen solicitudes para esta empresa sin filtros de fecha
    console.log('🔍 Verificando solicitudes sin filtros de fecha...');
    const solicitudesSinFiltroFecha = await this.solicitudesRepo
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.empresa', 'empresa')
      .where('empresa.cod_patronal = :codPatronal', { codPatronal })
      .getMany();
    
    console.log(`📊 Solicitudes para empresa ${codPatronal} (sin filtro fecha): ${solicitudesSinFiltroFecha.length}`);
    if (solicitudesSinFiltroFecha.length > 0) {
      console.log('📋 Estados de las solicitudes encontradas:', 
        solicitudesSinFiltroFecha.map(s => ({ 
          id: s.id_solicitud_reembolso, 
          estado: s.estado, 
          fecha_solicitud: s.fecha_solicitud 
        }))
      );
    }

    const solicitudes = await query.getMany();
    console.log(`📊 Resultado de la consulta: ${solicitudes.length} solicitudes encontradas`);
    
    if (solicitudes.length > 0) {
      console.log('📋 Detalles de las primeras solicitudes:');
      solicitudes.slice(0, 3).forEach((solicitud, index) => {
        console.log(`  Solicitud ${index + 1}:`, {
          id: solicitud.id_solicitud_reembolso,
          estado: solicitud.estado,
          fecha_solicitud: solicitud.fecha_solicitud,
          total_reembolso: solicitud.total_reembolso,
          total_trabajadores: solicitud.total_trabajadores,
          empresa: solicitud.empresa ? solicitud.empresa.emp_nom : 'No encontrada',
          detalles_count: solicitud.detalles ? solicitud.detalles.length : 0
        });
      });
    }

    return solicitudes;
  }

  /**
   * Procesa los datos agrupándolos por tipo de incapacidad
   */
  private async procesarDatosPorGrupos(solicitudes: any[]): Promise<any> {
    const grupos = {
      enfermedad: {
        nombre: 'ENFERMEDAD COMÚN',
        detalles: [],
        total: 0,
      },
      maternidad: {
        nombre: 'MATERNIDAD',
        detalles: [],
        total: 0,
      },
      profesional: {
        nombre: 'RIESGO PROFESIONAL',
        detalles: [],
        total: 0,
      },
    };

    let totalGlobal = 0;

    for (const solicitud of solicitudes) {
      for (const detalle of solicitud.detalles) {
        console.log('🔍 Detalle encontrado:', {
          id_detalle: detalle.id_detalle_reembolso,
          monto_reembolso: detalle.monto_reembolso,
          salario: detalle.salario,
          monto_dia: detalle.monto_dia,
          monto_subtotal: detalle.monto_subtotal,
          porcentaje_reembolso: detalle.porcentaje_reembolso
        });
        
        const tipoIncapacidad = this.determinarTipoIncapacidad(detalle.tipo_incapacidad);
        
        const detalleProcesado = {
          // Información de la solicitud
          id_solicitud: solicitud.id_solicitud_reembolso,
          fecha_solicitud: moment(solicitud.fecha_solicitud).format('DD/MM/YYYY'),
          
          // Información del trabajador (nombres completos en una sola variable)
          trabajador: {
            ci: detalle.ci,
            nombre_completo: `${this.aMayusculas(detalle.apellido_paterno || '')} ${this.aMayusculas(detalle.apellido_materno || '')} ${this.aMayusculas(detalle.nombres || '')}`.trim(),
            apellido_paterno: this.aMayusculas(detalle.apellido_paterno),
            apellido_materno: this.aMayusculas(detalle.apellido_materno),
            nombres: this.aMayusculas(detalle.nombres),
            matricula: this.aMayusculas(detalle.matricula),
          },
          
          // Información de la incapacidad
          tipo_incapacidad: this.aMayusculas(detalle.tipo_incapacidad),
          dias_incapacidad: detalle.dias_incapacidad,
          dias_reembolso: detalle.dias_reembolso,
          dias_baja_total: detalle.dias_baja_total,
          dias_mes_reembolso: detalle.dias_mes_reembolso,
          
          // Fechas
          fecha_inicio_baja: moment(detalle.fecha_inicio_baja).format('DD/MM/YYYY'),
          fecha_fin_baja: moment(detalle.fecha_fin_baja).format('DD/MM/YYYY'),
          fecha_inicio_mes_reembolso: moment(detalle.fecha_inicio_mes_reembolso).format('DD/MM/YYYY'),
          fecha_fin_mes_reembolso: moment(detalle.fecha_fin_mes_reembolso).format('DD/MM/YYYY'),
          fecha_accidente: detalle.fecha_accidente ? moment(detalle.fecha_accidente).format('DD/MM/YYYY') : null,
          fecha_vigencia: detalle.fecha_vigencia ? moment(detalle.fecha_vigencia).format('DD/MM/YYYY') : null,
          
          // Información económica (redondeada a 2 decimales)
          salario: this.redondearMonto(detalle.salario),
          monto_dia: this.redondearMonto(detalle.monto_dia),
          monto_subtotal: this.redondearMonto(detalle.monto_subtotal),
          porcentaje_reembolso: this.redondearMonto(detalle.porcentaje_reembolso),
          monto_reembolso: this.redondearMonto(detalle.monto_reembolso),
          
          // Información adicional
          lugar_accidente: this.aMayusculas(detalle.lugar_accidente),
          cotizaciones_previas_verificadas: detalle.cotizaciones_previas_verificadas,
          observaciones_afiliacion: this.aMayusculas(detalle.observaciones_afiliacion),
          observaciones: this.aMayusculas(detalle.observaciones),
          ruta_file_denuncia: detalle.ruta_file_denuncia,
          estado_revision: this.aMayusculas(detalle.estado_revision),
        };

        grupos[tipoIncapacidad].detalles.push(detalleProcesado);
        
        // Sumar el monto redondeado al total del grupo
        const montoRedondeado = this.redondearMonto(detalle.monto_reembolso);
        grupos[tipoIncapacidad].total = this.redondearMonto(grupos[tipoIncapacidad].total + montoRedondeado);
        totalGlobal = this.redondearMonto(totalGlobal + montoRedondeado);
        
        console.log('💰 Montos procesados:', {
          monto_original: detalle.monto_reembolso,
          monto_redondeado: montoRedondeado,
          tipo_incapacidad: tipoIncapacidad,
          total_grupo_antes: grupos[tipoIncapacidad].total - montoRedondeado,
          total_grupo_despues: grupos[tipoIncapacidad].total,
          total_global: totalGlobal
        });
      }
    }

    console.log('📊 Totales finales:', {
      grupos: Object.values(grupos).map(g => ({ nombre: g.nombre, total: g.total, detalles: g.detalles.length })),
      totalGlobal
    });

    return {
      grupos: Object.values(grupos),
      totalGlobal,
    };
  }

  /**
   * Determina el tipo de incapacidad basado en el valor del campo
   */
  private determinarTipoIncapacidad(tipoIncapacidad: string): string {
    const tipo = tipoIncapacidad?.toLowerCase() || '';
    
    if (tipo.includes('enfermedad') || tipo.includes('común')) {
      return 'enfermedad';
    } else if (tipo.includes('maternidad') || tipo.includes('materno')) {
      return 'maternidad';
    } else if (tipo.includes('profesional') || tipo.includes('laboral')) {
      return 'profesional';
    }
    
    // Por defecto, clasificar como enfermedad
    return 'enfermedad';
  }

  /**
   * Genera reporte de reembolsos en formato JSON (para API)
   */
  async obtenerDatosReporteReembolsos(
    idSolicitud: number,
  ): Promise<any> {
    try {
      console.log('=== INICIO obtenerDatosReporteReembolsos ===');

      // Validar parámetros
      if (!idSolicitud || idSolicitud < 1) {
        throw new BadRequestException('El ID de la solicitud es obligatorio y debe ser un número válido');
      }

      // Obtener la solicitud de reembolso específica
      const solicitud = await this.obtenerSolicitudReembolso(idSolicitud);

      if (!solicitud) {
        return {
          datos_empresa: {
            cod_patronal: null,
            nombre_empresa: null,
          },
          solicitud: null,
          grupos: [],
          total_global: 0,
          mensaje: `No se encontró la solicitud de reembolso con ID: ${idSolicitud}`,
        };
      }

      // Procesar datos
      const datosProcesados = await this.procesarDatosPorGrupos([solicitud]);

      return {
        datos_empresa: {
          cod_patronal: this.aMayusculas(solicitud.empresa.cod_patronal),
          nombre_empresa: this.aMayusculas(solicitud.empresa.emp_nom),
        },
        solicitud: {
          id_solicitud: solicitud.id_solicitud_reembolso,
          mes: this.obtenerNombreMes(solicitud.mes),
          gestion: solicitud.gestion,
          fecha_solicitud: moment(solicitud.fecha_solicitud).format('DD/MM/YYYY'),
          total_reembolso: this.redondearMonto(solicitud.total_reembolso),
          total_trabajadores: solicitud.total_trabajadores,
          estado: this.obtenerNombreEstado(solicitud.estado),
        },
        grupos: datosProcesados.grupos,
        total_global: datosProcesados.totalGlobal,
      };
    } catch (error) {
      console.error('Error en obtenerDatosReporteReembolsos:', error);
      throw new BadRequestException(`Error al obtener los datos del reporte: ${error.message}`);
    }
  }
}
