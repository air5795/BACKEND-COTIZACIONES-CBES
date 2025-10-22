-- ========================================
-- MIGRACIÓN: Agregar campos de cálculo detallado
-- Tabla: transversales.detalles_reembolso
-- Fecha: 2025-01-XX
-- ========================================

-- PASO 1: Agregar las nuevas columnas
ALTER TABLE transversales.detalles_reembolso 
ADD COLUMN dias_baja_total INT,
ADD COLUMN dias_mes_reembolso INT,
ADD COLUMN fecha_inicio_mes_reembolso DATE,
ADD COLUMN fecha_fin_mes_reembolso DATE,
ADD COLUMN monto_subtotal DECIMAL(10, 2);

COMMENT ON COLUMN transversales.detalles_reembolso.dias_baja_total IS 'Total de días de la baja completa (desde fecha_inicio_baja hasta fecha_fin_baja)';
COMMENT ON COLUMN transversales.detalles_reembolso.dias_mes_reembolso IS 'Días de la baja que corresponden al mes de reembolso (antes de aplicar carencia)';
COMMENT ON COLUMN transversales.detalles_reembolso.fecha_inicio_mes_reembolso IS 'Fecha de inicio de la baja ajustada al mes de reembolso';
COMMENT ON COLUMN transversales.detalles_reembolso.fecha_fin_mes_reembolso IS 'Fecha de fin de la baja ajustada al mes de reembolso';
COMMENT ON COLUMN transversales.detalles_reembolso.monto_subtotal IS 'Subtotal antes de aplicar porcentaje (monto_dia × dias_mes_reembolso)';

-- PASO 2: Actualizar registros existentes con valores calculados
-- Nota: Este script asume que los registros existentes tienen datos consistentes
UPDATE transversales.detalles_reembolso 
SET 
  -- Calcular días totales de la baja
  dias_baja_total = (fecha_fin_baja - fecha_inicio_baja) + 1,
  
  -- Para registros existentes, asumir que dias_incapacidad ya representa los días en el mes
  dias_mes_reembolso = CASE 
    WHEN tipo_incapacidad = 'ENFERMEDAD' THEN dias_reembolso + 3
    ELSE dias_reembolso
  END,
  
  -- Asumir que las fechas originales son correctas para el mes
  fecha_inicio_mes_reembolso = fecha_inicio_baja,
  fecha_fin_mes_reembolso = fecha_fin_baja,
  
  -- Calcular el subtotal (monto_dia × dias_mes_reembolso)
  monto_subtotal = monto_dia * CASE 
    WHEN tipo_incapacidad = 'ENFERMEDAD' THEN dias_reembolso + 3
    ELSE dias_reembolso
  END
WHERE dias_baja_total IS NULL;

-- PASO 3: Hacer las columnas NOT NULL después de poblarlas
ALTER TABLE transversales.detalles_reembolso 
ALTER COLUMN dias_baja_total SET NOT NULL,
ALTER COLUMN dias_mes_reembolso SET NOT NULL,
ALTER COLUMN fecha_inicio_mes_reembolso SET NOT NULL,
ALTER COLUMN fecha_fin_mes_reembolso SET NOT NULL,
ALTER COLUMN monto_subtotal SET NOT NULL;

-- PASO 4: Verificar los datos actualizados
SELECT 
  id_detalle_reembolso,
  tipo_incapacidad,
  fecha_inicio_baja,
  fecha_fin_baja,
  dias_baja_total,
  fecha_inicio_mes_reembolso,
  fecha_fin_mes_reembolso,
  dias_mes_reembolso,
  dias_reembolso,
  monto_dia,
  monto_subtotal,
  monto_reembolso
FROM transversales.detalles_reembolso
ORDER BY id_detalle_reembolso DESC
LIMIT 10;

-- ========================================
-- FIN DE LA MIGRACIÓN
-- ========================================
