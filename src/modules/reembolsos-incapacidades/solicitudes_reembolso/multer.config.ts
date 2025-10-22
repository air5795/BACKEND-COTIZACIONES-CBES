// src/modules/reembolsos-incapacidades/solicitudes_reembolso/multer.config.ts
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

// Crear carpeta de denuncias si no existe
const uploadPath = './denuncias';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

export const multerConfig = {
  storage: diskStorage({
    destination: uploadPath, // Carpeta de destino
    filename: (req, file, callback) => {
      // Obtener id_detalle_reembolso de los parámetros de la URL
      const id_detalle_reembolso = req.params?.idDetalle || req.body?.id_detalle_reembolso;
      
      if (!id_detalle_reembolso) {
        console.error('❌ ID de detalle no encontrado en req.params:', req.params);
        console.error('❌ ID de detalle no encontrado en req.body:', req.body);
        return callback(new Error('ID de detalle de reembolso es requerido'), null);
      }
      
      // Crear timestamp en formato YYYYMMDD-HHMMSS
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;
      
      const ext = extname(file.originalname); // Obtener la extensión del archivo original
      const filename = `denuncia-${id_detalle_reembolso}-${timestamp}${ext}`;
      
      console.log(`✅ Archivo generado: ${filename}`);
      callback(null, filename);
    },
  }),
  fileFilter: (req, file, callback) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Solo se permiten archivos JPEG, PNG y PDF'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};