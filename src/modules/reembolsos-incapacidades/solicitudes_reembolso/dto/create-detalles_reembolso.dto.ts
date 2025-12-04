// src/modules/reembolsos-incapacidades/solicitudes_reembolso/dto/create-detalles_reembolso.dto.ts
import { IsString, IsInt, IsOptional, Min, IsNumber, IsDateString, MaxLength, IsEnum, Matches } from 'class-validator';

export enum TipoIncapacidad {
  ENFERMEDAD_COMUN = 'ENFERMEDAD_COMUN',
  MATERNIDAD = 'MATERNIDAD',
  RIESGO_PROFESIONAL = 'RIESGO_PROFESIONAL',
  ENFERMEDAD_PROFESIONAL = 'ENFERMEDAD_PROFESIONAL',
}

export class CreateDetalleReembolsoDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  id_solicitud_reembolso?: number;

  @IsInt()
  @IsOptional()
  nro?: number;

  @IsString()
  @MaxLength(20)
  ci: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  apellido_paterno?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  apellido_materno?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  nombres?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  matricula?: string;

  @IsEnum(TipoIncapacidad)
  tipo_incapacidad: TipoIncapacidad;

  @IsDateString()
  fecha_inicio_baja: string;

  @IsDateString()
  fecha_fin_baja: string;

  @IsDateString()
  @IsOptional()
  fecha_atencion?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, { message: 'hora_atencion debe tener formato HH:mm o HH:mm:ss' })
  hora_atencion?: string; // Formato HH:mm o HH:mm:ss

  @IsDateString()
  @IsOptional()
  fecha_emision_certificado?: string;

  @IsDateString()
  @IsOptional()
  fecha_sello_vigencia?: string;

  @IsInt()
  @Min(0)
  dias_incapacidad: number;

  @IsInt()
  @Min(0)
  dias_reembolso: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  salario: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  monto_dia: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  porcentaje_reembolso: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  monto_reembolso: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  cotizaciones_previas_verificadas?: number;

  @IsString()
  @IsOptional()
  observaciones_afiliacion?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsString()
  @IsOptional()
  usuario_creacion?: string;

  @IsDateString()
  @IsOptional()
  fecha_creacion?: string;

  @IsString()
  @IsOptional()
  usuario_modificacion?: string;

  @IsDateString()
  @IsOptional()
  fecha_modificacion?: string;
}