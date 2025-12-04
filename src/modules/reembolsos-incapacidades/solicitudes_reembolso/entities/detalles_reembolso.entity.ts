import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SolicitudesReembolso } from './solicitudes_reembolso.entity';

@Entity({ schema: 'transversales', name: 'detalles_reembolso' })
export class DetallesReembolso {
  @PrimaryGeneratedColumn()
  id_detalle_reembolso: number;

  @Column()
  id_solicitud_reembolso: number;

  @Column({ type: 'integer', nullable: true })
  nro: number;

  @Column({ length: 20 })
  ci: string;

  @Column({ length: 255, nullable: true })
  apellido_paterno: string;

  @Column({ length: 255, nullable: true })
  apellido_materno: string;

  @Column({ length: 255, nullable: true })
  nombres: string;

  @Column({ length: 20, nullable: true })
  matricula: string;

  @Column({ length: 50 })
  tipo_incapacidad: string; // 'ENFERMEDAD_COMUN' | 'MATERNIDAD' | 'RIESGO_PROFESIONAL' | 'ENFERMEDAD_PROFESIONAL'

  @Column({ type: 'date' })
  fecha_inicio_baja: Date;

  @Column({ type: 'date' })
  fecha_fin_baja: Date;

  @Column({ type: 'date', nullable: true })
  fecha_atencion: Date;

  @Column({ type: 'time', nullable: true })
  hora_atencion: string; // Formato HH:mm:ss (ej: '20:00:00')

  @Column({ type: 'date', nullable: true })
  fecha_emision_certificado: Date;

  @Column({ type: 'date', nullable: true })
  fecha_sello_vigencia: Date;

  @Column({ type: 'integer' })
  dias_incapacidad: number;

  @Column({ type: 'integer' })
  dias_reembolso: number;

  // Nuevos campos para el cálculo detallado
  @Column({ type: 'integer' })
  dias_baja_total: number; // Total de días de la baja completa

  @Column({ type: 'integer' })
  dias_mes_reembolso: number; // Días que caen en el mes de reembolso

  @Column({ type: 'date' })
  fecha_inicio_mes_reembolso: Date; // Fecha inicio ajustada al mes

  @Column({ type: 'date' })
  fecha_fin_mes_reembolso: Date; // Fecha fin ajustada al mes

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  salario: number;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  monto_dia: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto_subtotal: number; // Subtotal antes de aplicar porcentaje (monto_dia × dias_mes_reembolso)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  porcentaje_reembolso: number; // e.g., 75.00, 90.00

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  monto_reembolso: number;

  @Column({ type: 'integer', default: 0 })
  cotizaciones_previas_verificadas: number;

  @Column({ type: 'text', nullable: true })
  observaciones_afiliacion: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ruta_file_denuncia: string;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'neutro' })
  estado_revision: string; // 'neutro', 'aprobado', 'observado'

  // Campos adicionales para riesgo profesional
  @Column({ type: 'date', nullable: true })
  fecha_accidente: Date;

  @Column({ type: 'date', nullable: true })
  fecha_vigencia: Date;

  @Column({ length: 20, nullable: true })
  lugar_accidente: string; // 'RURAL' | 'URBANO'

  @Column({ default: () => 'SESSION_USER' })
  usuario_creacion: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @Column({ nullable: true })
  usuario_modificacion: string;

  @Column({ type: 'timestamp', nullable: true })
  fecha_modificacion: Date;

  @ManyToOne(() => SolicitudesReembolso, (solicitud) => solicitud.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_solicitud_reembolso' })
  solicitud_reembolso: SolicitudesReembolso;
}