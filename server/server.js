/* ============================================
   SERVIDOR PARA GUARDAR UBICACIONES EN CSV LOCAL
   CON CORS HABILITADO - VERSIÓN CORREGIDA
   ============================================ */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// ✅ CORS CORREGIDO PARA GITHUB PAGES
// ============================================
const corsOptions = {
    origin: function (origin, callback) {
        // Lista de orígenes permitidos
        const allowedOrigins = [
            'https://encuestaact1955r.github.io',
            'https://encuestaact1955.github.io',
            'http://localhost:3000',
            'http://localhost:5500',
            'http://127.0.0.1:5500'
        ];
        
        // Permitir peticiones sin origen (como Postman o curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`⚠️ Origen no permitido: ${origin}`);
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ============================================
// ✅ MIDDLEWARE ADICIONAL PARA LOGS
// ============================================
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url} - Origen: ${req.headers.origin || 'desconocido'}`);
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// RUTA AL ARCHIVO CSV
// ============================================
const CSV_PATH = path.join(__dirname, 'datos', 'encuestas.csv');

// ============================================
// FUNCIONES DE ARCHIVO CSV
// ============================================

function ensureDataDirectory() {
    const dir = path.dirname(CSV_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Directorio creado: ${dir}`);
    }
}

function initCSV() {
    ensureDataDirectory();
    
    if (!fs.existsSync(CSV_PATH)) {
        const headers = [
            'NumeroEncuesta',
            'Timestamp_Captura',
            'Timestamp_Envio',
            'Timestamp_Display',
            'Latitud',
            'Longitud',
            'Direccion',
            'Precision',
            'UserAgent',
            'IP'
        ].join(',');
        
        fs.writeFileSync(CSV_PATH, headers + '\n', 'utf8');
        console.log(`📄 Archivo CSV creado: ${CSV_PATH}`);
        console.log(`📋 Encabezados: ${headers}`);
    } else {
        console.log(`📄 Archivo CSV existente: ${CSV_PATH}`);
    }
}

function readEncuestas() {
    try {
        if (!fs.existsSync(CSV_PATH)) {
            return [];
        }
        
        const content = fs.readFileSync(CSV_PATH, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length <= 1) {
            return [];
        }
        
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
        
        return data;
    } catch (error) {
        console.error('❌ Error al leer CSV:', error);
        return [];
    }
}

function addEncuestaToCSV(encuestaData) {
    try {
        ensureDataDirectory();
        
        const encuestas = readEncuestas();
        const numeroEncuesta = encuestas.length + 1;
        
        const fields = [
            'NumeroEncuesta',
            'Timestamp_Captura',
            'Timestamp_Envio',
            'Timestamp_Display',
            'Latitud',
            'Longitud',
            'Direccion',
            'Precision',
            'UserAgent',
            'IP'
        ];
        
        const values = [
            numeroEncuesta,
            encuestaData.timestamp_captura || new Date().toISOString(),
            encuestaData.timestamp_envio || new Date().toISOString(),
            encuestaData.timestamp_display || new Date().toLocaleString('es-ES'),
            encuestaData.latitud || '',
            encuestaData.longitud || '',
            encuestaData.direccion || '',
            encuestaData.precision || '',
            encuestaData.userAgent || '',
            encuestaData.ip || 'desconocida'
        ];
        
        const row = values.map(value => {
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        
        const csvLine = row.join(',') + '\n';
        
        const fileExists = fs.existsSync(CSV_PATH);
        
        if (!fileExists) {
            const headers = fields.join(',') + '\n';
            fs.writeFileSync(CSV_PATH, headers + csvLine, 'utf8');
        } else {
            fs.appendFileSync(CSV_PATH, csvLine, 'utf8');
        }
        
        console.log(`✅ Encuesta #${numeroEncuesta} guardada en CSV`);
        return numeroEncuesta;
        
    } catch (error) {
        console.error('❌ Error al guardar en CSV:', error);
        throw error;
    }
}

// ============================================
// RUTAS DE LA API
// ============================================

app.get('/api/estado', (req, res) => {
    try {
        const encuestas = readEncuestas();
        res.json({
            result: 'estado',
            total: encuestas.length,
            servidor: 'online',
            cors_origin: req.headers.origin || 'ninguno'
        });
    } catch (error) {
        res.status(500).json({
            result: 'error',
            error: error.message
        });
    }
});

app.post('/api/encuesta', (req, res) => {
    try {
        const data = req.body;
        
        console.log('📥 Recibiendo datos:', {
            lat: data.latitud,
            lng: data.longitud,
            timestamp: data.timestamp_display,
            origen: req.headers.origin || 'desconocido'
        });
        
        if (!data.latitud || !data.longitud) {
            return res.status(400).json({
                result: 'error',
                mensaje: 'Se requieren latitud y longitud'
            });
        }
        
        data.ip = req.ip || req.connection.remoteAddress || 'desconocida';
        const numeroEncuesta = addEncuestaToCSV(data);
        const encuestas = readEncuestas();
        
        res.json({
            result: 'success',
            mensaje: 'Ubicación registrada correctamente',
            numeroEncuesta: numeroEncuesta,
            totalRespuestas: encuestas.length
        });
        
    } catch (error) {
        console.error('❌ Error al procesar encuesta:', error);
        res.status(500).json({
            result: 'error',
            error: error.message
        });
    }
});

app.get('/api/descargar', (req, res) => {
    try {
        if (!fs.existsSync(CSV_PATH)) {
            return res.status(404).json({
                result: 'error',
                mensaje: 'No hay datos disponibles'
            });
        }
        res.download(CSV_PATH, `encuestas_${Date.now()}.csv`);
    } catch (error) {
        res.status(500).json({
            result: 'error',
            error: error.message
        });
    }
});

app.get('/api/todas', (req, res) => {
    try {
        const encuestas = readEncuestas();
        res.json({
            result: 'success',
            total: encuestas.length,
            data: encuestas
        });
    } catch (error) {
        res.status(500).json({
            result: 'error',
            error: error.message
        });
    }
});

app.get('/api/estructura', (req, res) => {
    res.json({
        result: 'success',
        campos: [
            'NumeroEncuesta',
            'Timestamp_Captura',
            'Timestamp_Envio',
            'Timestamp_Display',
            'Latitud',
            'Longitud',
            'Direccion',
            'Precision',
            'UserAgent',
            'IP'
        ]
    });
});

// ============================================
// ✅ RUTA DE PRUEBA CORS
// ============================================
app.options('/api/*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.json({
        nombre: 'API Encuestas Geolocalización',
        version: '2.1.0',
        estado: 'online',
        cors: {
            configurado: true,
            origen_actual: req.headers.origin || 'ninguno'
        },
        endpoints: {
            estado: '/api/estado',
            encuesta: '/api/encuesta (POST)',
            todas: '/api/todas',
            descargar: '/api/descargar',
            estructura: '/api/estructura'
        }
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

initCSV();

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`📊 CSV: ${CSV_PATH}`);
    console.log(`🌐 CORS: Permitido para GitHub Pages`);
    console.log('========================================');
});

process.on('SIGTERM', () => {
    console.log('🛑 Cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Cerrando servidor...');
    process.exit(0);
});
