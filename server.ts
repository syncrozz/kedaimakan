import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  authenticateClient,
  authenticateKitchen,
  changeKitchenPin,
  getKitchenPublicAuthState,
  authenticateMasterAdmin,
  changeClientPin,
  adminResetClientPin,
  initWorkspaceAuth,
  getPublicAuthState,
  getAuditLogs,
  generateToken,
  verifyToken,
  verifyTokenWithDiagnostic,
  checkLockout,
  resolveWorkspaceAuthoritatively,
  recordAuditLog,
} from './server/auth.ts';

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();

  app.use(express.json());

  // Request logger for auth endpoints
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/auth')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // ----------------------------------------------------
  // HEALTH & DEPLOYMENT VERSION (SES v4.5)
  // ----------------------------------------------------
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'niagapos-v2-server',
      version: '4.5.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/version', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '4.5.0',
      platform: 'NiagaPOS V2 (SES v4.5)',
      releaseDate: '2026-09-19',
      schemaVersion: 1,
      minCompatibleVersion: '4.0.0',
      buildTimestamp: 1726735500000,
      features: [
        'KOT_KDS',
        'MULTI_TENANT',
        'SESSION_CONTINUITY',
        'DIAGNOSTIC_INVALIDATION',
        'ASSET_RECOVERY',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  // ----------------------------------------------------
  // DYNAMIC PWA MANIFEST (Workspace-Specific)
  // ----------------------------------------------------
  const handleDynamicManifest = (req: Request, res: Response) => {
    let slug = req.params.slug || (req.query.slug as string) || (req.query.workspace as string);
    let name = (req.query.name as string) || '';

    if (!slug && req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        const segs = refUrl.pathname.split('/').map((s) => s.trim()).filter(Boolean);
        const RESERVED = ['admin', 'api', 'assets', 'login', 'pos', 'settings', 'inventory', 'reports', 'customers', 'suppliers', 'purchases', 'dashboard', 'setup', 'sw.js', 'konsol', 'klien'];
        if (segs.length > 0 && !segs[0].includes('.') && !RESERVED.includes(segs[0].toLowerCase())) {
          slug = segs[0];
        }
      } catch {}
    }

    const cleanSlug = slug?.trim()?.toLowerCase();
    const isWorkspace = Boolean(cleanSlug && !['admin', 'api', 'assets', 'login', 'pos', 'settings', 'inventory', 'reports', 'dashboard', 'setup', 'sw.js'].includes(cleanSlug));

    const displayName = isWorkspace
      ? (name || cleanSlug!.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
      : 'NiagaPOS';

    const manifest = {
      id: isWorkspace ? `/${cleanSlug}` : '/',
      name: isWorkspace ? `${displayName} — NiagaPOS` : 'NiagaPOS',
      short_name: displayName,
      description: isWorkspace
        ? `NiagaPOS - Sistem POS & Pengurusan Inventori untuk ${displayName}`
        : 'NiagaPOS - Sistem POS & Pengurusan Inventori Runcit',
      start_url: isWorkspace ? `/${cleanSlug}` : '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#082f63',
      theme_color: '#082f63',
      icons: [
        {
          src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/web-app-manifest-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: 'https://raw.githubusercontent.com/syncrozz/syncrozz-assets/main/logo/NiagaPOS/web-app-manifest-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/web-app-manifest-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/web-app-manifest-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(manifest);
  };

  app.get('/site.webmanifest', handleDynamicManifest);
  app.get('/manifest.json', handleDynamicManifest);
  app.get('/api/manifest/:slug?', handleDynamicManifest);

  // ----------------------------------------------------
  // CLIENT WORKSPACE AUTHENTICATION
  // ----------------------------------------------------

  // Check lockout & public auth state for a workspace
  app.get('/api/auth/client/status/:slug', (req: Request, res: Response) => {
    const { slug } = req.params;
    const lockout = checkLockout(slug);
    const publicState = getPublicAuthState(slug);

    res.json({
      success: true,
      workspaceSlug: slug,
      isLocked: lockout.locked,
      remainingSeconds: lockout.remainingSeconds,
      authConfig: publicState,
    });
  });

  // Client login with workspace PIN
  app.post('/api/auth/client/login', (req: Request, res: Response) => {
    const { workspaceSlug, pin, workspaceName } = req.body || {};

    if (!workspaceSlug || !pin) {
      res.status(400).json({
        success: false,
        error: 'Slug workspace dan nombor PIN diperlukan.',
      });
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const result = authenticateClient(workspaceSlug, pin, workspaceName, clientIp);
    if (!result.success) {
      res.status(result.remainingSeconds ? 429 : 401).json(result);
      return;
    }

    res.json(result);
  });

  // Verify client session token (SES v4.5 Diagnostic Invalidation)
  app.post('/api/auth/client/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body?.token;
    const targetSlug = req.body?.workspaceSlug;

    if (!token) {
      res.status(401).json({
        success: false,
        valid: false,
        reason: 'DATA_CORRUPTION',
        error: 'Token sesi tidak dibekalkan.',
      });
      return;
    }

    const diag = verifyTokenWithDiagnostic<{ workspaceId: string; workspaceSlug: string; role: string; exp: number }>(
      token,
      { expectedRole: 'CLIENT', expectedWorkspaceSlug: targetSlug }
    );

    if (!diag.valid || !diag.payload) {
      res.status(diag.reason === 'WORKSPACE_ACCESS_REVOKED' ? 403 : 401).json({
        success: false,
        valid: false,
        reason: diag.reason || 'DATA_CORRUPTION',
        error: diag.error || 'Sesi tidak sah atau telah tamat tempoh.',
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      workspaceId: diag.payload.workspaceId,
      workspaceSlug: diag.payload.workspaceSlug,
      role: diag.payload.role,
    });
  });

  // Change Client PIN
  app.post('/api/auth/client/change-pin', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body?.token;
    const { workspaceSlug, currentPin, newPin, confirmPin } = req.body || {};

    if (!workspaceSlug || !currentPin || !newPin || !confirmPin) {
      res.status(400).json({ success: false, error: 'Sila lengkapkan semua medan PIN dan slug workspace.' });
      return;
    }

    // If a valid server token is provided, verify tenant scope
    if (token && !token.startsWith('local_')) {
      const decoded = verifyToken<{ workspaceSlug: string; role: string }>(token);
      if (decoded && decoded.workspaceSlug !== (workspaceSlug || '').toLowerCase() && decoded.role !== 'MASTER_ADMIN') {
        res.status(403).json({ success: false, error: 'Sesi tidak sah untuk mengemas kini PIN workspace ini.' });
        return;
      }
    }

    const result = changeClientPin(workspaceSlug, currentPin, newPin, confirmPin);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    // Generate fresh session token for the client
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const freshToken = generateToken({
      workspaceId: result.authConfig?.workspaceId || `ws_${workspaceSlug.toLowerCase()}`,
      workspaceSlug: workspaceSlug.toLowerCase(),
      role: 'CLIENT',
      pinVersion: result.authConfig?.pinVersion || 2,
      exp: expiresAt,
    });

    res.json({
      ...result,
      session: {
        token: freshToken,
        workspaceId: result.authConfig?.workspaceId || `ws_${workspaceSlug.toLowerCase()}`,
        workspaceSlug: workspaceSlug.toLowerCase(),
        workspaceName: workspaceSlug,
        role: 'CLIENT',
        isPinEnabled: true,
        mustChangeDefaultPin: false,
        pinVersion: result.authConfig?.pinVersion || 2,
        expiresAt,
      },
    });
  });

  // Initialize workspace PIN (called on workspace creation)
  app.post('/api/auth/client/init', (req: Request, res: Response) => {
    const { workspaceId, workspaceSlug, customPin } = req.body || {};
    if (!workspaceId || !workspaceSlug) {
      res.status(400).json({ success: false, error: 'workspaceId and workspaceSlug are required' });
      return;
    }

    initWorkspaceAuth(workspaceId, workspaceSlug, customPin);
    res.json({
      success: true,
      message: 'Workspace auth successfully initialized with default PIN (1234).',
      workspaceId,
      workspaceSlug,
    });
  });

  // ----------------------------------------------------
  // KITCHEN AUTHENTICATION & KDS ACCESS (FASA 3 SES v4.5)
  // ----------------------------------------------------

  // Check kitchen lockout & public status for a workspace
  app.get('/api/auth/kitchen/status/:slug', (req: Request, res: Response) => {
    const { slug } = req.params;
    const lockoutKey = `${(slug || '').trim().toLowerCase()}_kitchen`;
    const lockout = checkLockout(lockoutKey);
    const publicState = getKitchenPublicAuthState(slug);

    res.json({
      success: true,
      workspaceSlug: slug,
      isLocked: lockout.locked,
      remainingSeconds: lockout.remainingSeconds,
      authConfig: publicState,
    });
  });

  // Kitchen login with workspace Kitchen PIN
  app.post('/api/auth/kitchen/login', (req: Request, res: Response) => {
    const { workspaceSlug, pin, workspaceName } = req.body || {};

    if (!workspaceSlug || !pin) {
      res.status(400).json({
        success: false,
        error: 'Slug workspace dan nombor PIN Dapur diperlukan.',
      });
      return;
    }

    const result = authenticateKitchen(workspaceSlug, pin, workspaceName);
    if (!result.success) {
      res.status(result.remainingSeconds ? 429 : 401).json(result);
      return;
    }

    res.json(result);
  });

  // Verify kitchen session token (SES v4.5 Diagnostic Invalidation)
  app.post('/api/auth/kitchen/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body?.token;
    const targetSlug = req.body?.workspaceSlug;

    if (!token) {
      res.status(401).json({
        success: false,
        valid: false,
        reason: 'DATA_CORRUPTION',
        error: 'Token sesi dapur tidak dibekalkan.',
      });
      return;
    }

    const diag = verifyTokenWithDiagnostic<{ workspaceId: string; workspaceSlug: string; role: string; exp: number }>(
      token
    );

    if (!diag.valid || !diag.payload) {
      res.status(401).json({
        success: false,
        valid: false,
        reason: diag.reason || 'DATA_CORRUPTION',
        error: diag.error || 'Sesi dapur tidak sah atau telah tamat tempoh.',
      });
      return;
    }

    if (diag.payload.role !== 'KITCHEN' && diag.payload.role !== 'CLIENT' && diag.payload.role !== 'MASTER_ADMIN') {
      res.status(401).json({
        success: false,
        valid: false,
        reason: 'AUTHORIZATION_CHANGED',
        error: 'Peranan sesi tidak sah untuk paparan dapur.',
      });
      return;
    }

    if (targetSlug && diag.payload.workspaceSlug !== targetSlug.toLowerCase() && diag.payload.role !== 'MASTER_ADMIN') {
      res.status(403).json({
        success: false,
        valid: false,
        reason: 'WORKSPACE_ACCESS_REVOKED',
        error: 'Sesi dapur tidak dibenarkan mengakses ruang kerja ini.',
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      workspaceId: diag.payload.workspaceId,
      workspaceSlug: diag.payload.workspaceSlug,
      role: diag.payload.role,
    });
  });

  // Change Kitchen PIN
  app.post('/api/auth/kitchen/change-pin', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body?.token;
    const { workspaceSlug, currentPin, newPin, confirmPin } = req.body || {};

    if (!workspaceSlug || !currentPin || !newPin || !confirmPin) {
      res.status(400).json({ success: false, error: 'Sila lengkapkan semua medan PIN dan slug workspace.' });
      return;
    }

    if (token && !token.startsWith('local_')) {
      const decoded = verifyToken<{ workspaceSlug: string; role: string }>(token);
      if (decoded && decoded.workspaceSlug !== (workspaceSlug || '').toLowerCase() && decoded.role !== 'MASTER_ADMIN') {
        res.status(403).json({ success: false, error: 'Sesi tidak sah untuk mengemas kini PIN Dapur workspace ini.' });
        return;
      }
    }

    const result = changeKitchenPin(workspaceSlug, currentPin, newPin, confirmPin);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  });

  // ----------------------------------------------------
  // MASTER ADMIN AUTHENTICATION & MANAGEMENT
  // ----------------------------------------------------

  // Master Admin login (PIN 5313 exclusively)
  app.post('/api/auth/admin/login', (req: Request, res: Response) => {
    const { pin } = req.body || {};
    if (!pin) {
      res.status(400).json({ success: false, error: 'PIN Master Admin diperlukan.' });
      return;
    }

    const result = authenticateMasterAdmin(pin);
    if (!result.success) {
      res.status(result.remainingSeconds ? 429 : 401).json(result);
      return;
    }

    res.json(result);
  });

  // Master Admin: Reset Client PIN to default 1234
  app.post('/api/auth/admin/reset-client-pin', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body?.token;
    const { workspaceIdOrSlug } = req.body || {};

    if (!token) {
      res.status(401).json({ success: false, error: 'Akses ditolak: Token Master Admin diperlukan.' });
      return;
    }

    const decoded = verifyToken<{ role: string }>(token);
    if (!decoded || decoded.role !== 'MASTER_ADMIN') {
      res.status(403).json({ success: false, error: 'Akses ditolak: Hanya Master Admin dibenarkan.' });
      return;
    }

    if (!workspaceIdOrSlug) {
      res.status(400).json({ success: false, error: 'ID atau slug workspace diperlukan.' });
      return;
    }

    const result = adminResetClientPin(workspaceIdOrSlug);
    res.json(result);
  });

  // Master Admin: Get Audit Logs
  app.get('/api/auth/admin/audit-logs', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

    if (!token) {
      res.status(401).json({ success: false, error: 'Token Master Admin diperlukan.' });
      return;
    }

    const decoded = verifyToken<{ role: string }>(token);
    if (!decoded || decoded.role !== 'MASTER_ADMIN') {
      res.status(403).json({ success: false, error: 'Akses ditolak.' });
      return;
    }

    const logs = getAuditLogs();
    res.json({ success: true, logs });
  });

  // ----------------------------------------------------
  // DEMO SANDBOX MANAGEMENT & HEARTBEAT (SES v4.5)
  // ----------------------------------------------------
  let demoResetVersion = 1;
  let demoLastResetAt = new Date().toISOString();
  let demoLastResetBy = 'SYSTEM_INIT';

  // Demo Sandbox Status
  app.get('/api/demo/status', (req: Request, res: Response) => {
    res.json({
      success: true,
      workspaceId: 'ws_demo_sandbox_001',
      workspaceSlug: 'demo',
      workspaceType: 'DEMO',
      seedVersion: '1.0.0',
      demoResetVersion,
      demoLastResetAt,
      demoLastResetBy,
      isPublicDemo: true,
      publicPin: '1234',
    });
  });

  // Master Admin Authoritative Global Reset
  // Rule: Prospective clients cannot trigger global sandbox resets to protect concurrent users.
  // Concurrency guard: Concurrent reset attempts are safely rejected with HTTP 409 Conflict.
  let isResetExecuting = false;

  app.post('/api/demo/reset', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body?.token;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Sesi Master Admin diperlukan untuk melaksanakan tetapan semula global.',
      });
      return;
    }

    const decoded = verifyToken<{ role: string; workspaceSlug?: string }>(token);
    if (!decoded || decoded.role !== 'MASTER_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Akses ditolak: Tetapan semula sandbox global hanya boleh dilaksanakan oleh Master Admin.',
      });
      return;
    }

    if (isResetExecuting) {
      res.status(409).json({
        success: false,
        error: 'Operasi tetapan semula sandbox sedang diproses serentak. Sila tunggu seketika.',
      });
      return;
    }

    isResetExecuting = true;
    try {
      const resetOperationId = `op_reset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      demoResetVersion += 1;
      demoLastResetAt = new Date().toISOString();
      demoLastResetBy = 'MASTER_ADMIN';

      recordAuditLog({
        action: 'RESET_CLIENT_PIN', // Auditable action
        workspaceId: 'ws_demo_sandbox_001',
        workspaceSlug: 'demo',
        performedBy: 'MASTER_ADMIN',
        details: {
          type: 'DEMO_SANDBOX_RESET_COMPLETED',
          resetOperationId,
          resetVersion: demoResetVersion,
          seedVersion: '1.0.0',
          timestamp: demoLastResetAt,
        },
      });

      res.json({
        success: true,
        verified: true,
        message: 'Tetapan semula sandbox berjaya disahkan oleh Master Admin.',
        resetOperationId,
        resetVersion: demoResetVersion,
        seedVersion: '1.0.0',
        timestamp: demoLastResetAt,
      });
    } finally {
      isResetExecuting = false;
    }
  });

  // Heartbeat endpoint for active session tracking
  app.post('/api/demo/heartbeat', (req: Request, res: Response) => {
    const { sessionId, lastSeenAt, activeSeconds } = req.body || {};
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'sessionId diperlukan.' });
      return;
    }

    res.json({
      success: true,
      acknowledgedAt: new Date().toISOString(),
      sessionId,
    });
  });

  // ----------------------------------------------------
  // FRONTEND SERVING (VITE DEV / STATIC PRODUCTION)
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[NiagaPOS] Server running securely at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[NiagaPOS] Fatal error starting server:', err);
  process.exit(1);
});
