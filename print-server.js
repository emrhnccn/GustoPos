/**
 * GustoPOS – Yerel Yazdırma Sunucusu (Print Server)
 * 
 * Bu sunucu bilgisayarınızdaki kablolu yazıcılara erişim sağlar.
 * POS sistemi (tarayıcı) bu sunucuya HTTP istekleri göndererek yazdırma yapar.
 * 
 * Kullanım: node print-server.js
 * Port: 9100 (varsayılan)
 */

const http = require('http');
const { execFile, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PRINT_SERVER_PORT || 9100;

// ===================== YARDIMCI FONKSİYONLAR =====================

/**
 * Windows'ta tanımlı yazıcıları PowerShell ile listele
 */
function getWindowsPrinters() {
  return new Promise((resolve, reject) => {
    const cmd = 'powershell';
    const args = [
      '-NoProfile',
      '-Command',
      'Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Shared | ConvertTo-Json'
    ];

    execFile(cmd, args, { encoding: 'utf-8', timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        // Fallback: WMIC ile dene
        exec('wmic printer get Name,PortName,DriverName /format:csv', { encoding: 'utf-8', timeout: 10000 }, (err2, stdout2) => {
          if (err2) {
            reject(new Error('Yazıcı listesi alınamadı: ' + (err2.message || '')));
            return;
          }
          try {
            const lines = stdout2.trim().split('\n').filter(l => l.trim());
            if (lines.length <= 1) {
              resolve([]);
              return;
            }
            const headers = lines[0].split(',').map(h => h.trim());
            const printers = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map(c => c.trim());
              if (cols.length >= headers.length) {
                const printer = {};
                headers.forEach((h, idx) => { printer[h] = cols[idx]; });
                if (printer.Name) {
                  printers.push({
                    name: printer.Name,
                    driverName: printer.DriverName || '',
                    portName: printer.PortName || '',
                    status: 'Unknown',
                    shared: false
                  });
                }
              }
            }
            resolve(printers);
          } catch (parseErr) {
            reject(new Error('Yazıcı listesi parse edilemedi.'));
          }
        });
        return;
      }

      try {
        let data = JSON.parse(stdout);
        // Tekil obje ise array'e çevir
        if (!Array.isArray(data)) data = [data];
        const printers = data.map(p => ({
          name: p.Name || '',
          driverName: p.DriverName || '',
          portName: p.PortName || '',
          status: p.PrinterStatus === 0 ? 'Normal' : `Status: ${p.PrinterStatus}`,
          shared: p.Shared || false
        }));
        resolve(printers);
      } catch (parseErr) {
        resolve([]);
      }
    });
  });
}

/**
 * Belirtilen yazıcıya metin gönder (Windows lpr/print komutu)
 */
function printText(printerName, text) {
  return new Promise((resolve, reject) => {
    // Geçici dosya oluştur
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `gustopos_print_${Date.now()}.txt`);

    // BOM + UTF-8 ile yaz (Türkçe karakter desteği)
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const content = Buffer.from(text, 'utf-8');
    const fullContent = Buffer.concat([bom, content]);

    fs.writeFile(tmpFile, fullContent, (writeErr) => {
      if (writeErr) {
        reject(new Error('Geçici yazdırma dosyası oluşturulamadı: ' + writeErr.message));
        return;
      }

      // PowerShell ile yazdır
      const psCommand = `
        try {
          $content = Get-Content -Path '${tmpFile.replace(/\\/g, '\\\\')}' -Raw -Encoding UTF8
          $printJob = [System.Drawing.Printing.PrintDocument]::new()
          $printJob.PrinterSettings.PrinterName = '${printerName.replace(/'/g, "''")}'
          
          if (-not $printJob.PrinterSettings.IsValid) {
            Write-Error "Yazıcı bulunamadı: ${printerName}"
            exit 1
          }
          
          $printJob.add_PrintPage({
            param($sender, $e)
            $font = [System.Drawing.Font]::new('Consolas', 9)
            $brush = [System.Drawing.Brushes]::Black
            $rect = $e.MarginBounds
            $format = [System.Drawing.StringFormat]::new()
            $e.Graphics.DrawString($content, $font, $brush, $rect, $format)
          })
          
          $printJob.Print()
          $printJob.Dispose()
          Write-Output "OK"
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      `;

      // Daha basit yaklaşım: notepad /pt ile sessiz yazdırma
      // Ama önce doğrudan print komutunu deneyelim
      const simpleCmd = `powershell -NoProfile -Command "Get-Content '${tmpFile.replace(/'/g, "''")}' | Out-Printer '${printerName.replace(/'/g, "''")}'"`; 

      exec(simpleCmd, { encoding: 'utf-8', timeout: 30000 }, (printErr, stdout, stderr) => {
        // Geçici dosyayı temizle (asenkron)
        fs.unlink(tmpFile, () => {});

        if (printErr) {
          reject(new Error('Yazdırma hatası: ' + (stderr || printErr.message)));
          return;
        }
        resolve({ success: true, message: `Yazıcıya gönderildi: ${printerName}` });
      });
    });
  });
}

// ===================== HTTP SUNUCUSU =====================

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ========== GET /health ==========
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'GustoPOS Print Server', version: '1.0.0' }));
    return;
  }

  // ========== GET /printers ==========
  if (req.method === 'GET' && url.pathname === '/printers') {
    try {
      const printers = await getWindowsPrinters();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, printers }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // ========== POST /print ==========
  if (req.method === 'POST' && url.pathname === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { printerName, text } = JSON.parse(body);

        if (!printerName || !text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'printerName ve text zorunludur.' }));
          return;
        }

        const result = await printText(printerName, text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // ========== 404 ==========
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint bulunamadı.' }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   🖨️  GustoPOS Yazdırma Sunucusu Çalışıyor     ║');
  console.log(`║   📡 Port: ${PORT}                                 ║`);
  console.log('║   🔗 http://localhost:' + PORT + '                     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('Yazıcı listesi: GET http://localhost:' + PORT + '/printers');
  console.log('Yazdırma:       POST http://localhost:' + PORT + '/print');
  console.log('Sağlık:         GET http://localhost:' + PORT + '/health');
  console.log('');
});
