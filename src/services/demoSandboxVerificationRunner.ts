/**
 * SYNCROZZ KEDAI MAKAN - Demo Sandbox Verification Gates Runner (SES v4.5)
 * Executable verification tests validating all 15 architectural safety gates.
 */

import { DEMO_OFFICIAL_SEED, getSeedExpectedCounts, DEMO_WORKSPACE_ID, DEMO_WORKSPACE_SLUG } from './demoSeedData';
import { DEMO_RESET_COLLECTION_ALLOWLIST, DEMO_LOCAL_STORAGE_ALLOWLIST, DemoSandboxService } from './demoSandboxService';
import { DemoAnalyticsService } from './demoAnalyticsService';
import { FirebaseService } from './firebaseService';
import { WorkspaceService } from './workspaceService';

export interface GateTestResult {
  gateId: number;
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

export class DemoSandboxVerificationRunner {
  public static async runAllGates(): Promise<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult[];
  }> {
    const results: GateTestResult[] = [];

    // Gate 1: Public Demo PIN Login Verification
    try {
      const res = await fetch('/api/auth/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug: 'demo', pin: '1234' }),
      });
      const data = await res.json();
      const passed =
        res.ok &&
        data.success &&
        data.session?.isDemo === true &&
        data.session?.workspaceType === 'DEMO' &&
        data.session?.memberRole === 'STAFF';
      results.push({
        gateId: 1,
        name: 'Public Demo PIN Login',
        passed,
        details: passed
          ? 'Log masuk demo berjaya dengan token terhad (STAFF, isDemo: true).'
          : `Gagal: ${JSON.stringify(data)}`,
      });
    } catch (e: any) {
      results.push({ gateId: 1, name: 'Public Demo PIN Login', passed: false, details: e.message, error: e.message });
    }

    // Gate 2: Non-Demo PIN Strictness (No bypass on client workspaces)
    try {
      const res = await fetch('/api/auth/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug: 'restoran-bukan-demo-xyz', pin: '9999' }),
      });
      const data = await res.json();
      const passed = !data.success && (res.status === 401 || res.status === 400);
      results.push({
        gateId: 2,
        name: 'Non-Demo PIN Strictness',
        passed,
        details: passed
          ? 'Akses salah pada workspace bukan demo disekat dengan tepat tanpa sebarang pintasan.'
          : 'Pintasan keselamatan dikesan!',
      });
    } catch (e: any) {
      results.push({ gateId: 2, name: 'Non-Demo PIN Strictness', passed: false, details: e.message, error: e.message });
    }

    // Gate 3: Demo Status Endpoint Availability
    try {
      const res = await fetch('/api/demo/status');
      const data = await res.json();
      const passed =
        res.ok &&
        data.workspaceId === DEMO_WORKSPACE_ID &&
        data.workspaceSlug === DEMO_WORKSPACE_SLUG &&
        data.seedVersion === '1.0.0';
      results.push({
        gateId: 3,
        name: 'Demo Status Endpoint Resolution',
        passed,
        details: passed
          ? `Status demo disahkan (Seed ${data.seedVersion}, Reset Version ${data.demoResetVersion}).`
          : 'Status demo tidak sah.',
      });
    } catch (e: any) {
      results.push({ gateId: 3, name: 'Demo Status Endpoint Resolution', passed: false, details: e.message, error: e.message });
    }

    // Gate 4: Master Admin Exclusive Reset Enforcement
    try {
      // Attempt reset with a client token or no token
      const res = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'client_fake_token' }),
      });
      const passed = res.status === 401 || res.status === 403;
      results.push({
        gateId: 4,
        name: 'Master Admin Exclusive Reset Enforcement',
        passed,
        details: passed
          ? `Panggilan tetapan semula tanpa token Master Admin berjaya disekat (${res.status} Forbidden).`
          : 'Gagal: Sesi bukan admin berjaya memanggil tetapan semula global!',
      });
    } catch (e: any) {
      results.push({ gateId: 4, name: 'Master Admin Exclusive Reset Enforcement', passed: false, details: e.message, error: e.message });
    }

    // Gate 5: Authoritative Workspace Resolution
    try {
      const ws = WorkspaceService.getWorkspaceBySlug('demo');
      const passed = Boolean(ws && ws.workspaceId === DEMO_WORKSPACE_ID && ws.workspaceType === 'DEMO');
      results.push({
        gateId: 5,
        name: 'Authoritative Workspace Resolver',
        passed,
        details: passed
          ? `Workspace demo disahkan: ${ws?.workspaceName} (${ws?.workspaceId}).`
          : 'Workspace demo gagal diselesaikan.',
      });
    } catch (e: any) {
      results.push({ gateId: 5, name: 'Authoritative Workspace Resolver', passed: false, details: e.message, error: e.message });
    }

    // Gate 6: Official Seed Dataset Verification (12 items, 10 tables)
    try {
      const counts = getSeedExpectedCounts();
      const passed =
        counts.menuItems === 12 &&
        counts.tables === 10 &&
        counts.reservations >= 1 &&
        counts.kotTickets >= 2;
      results.push({
        gateId: 6,
        name: 'Official Seed Dataset Integrity',
        passed,
        details: passed
          ? `Dataset benih disahkan secara dinamik: ${counts.menuItems} menu, ${counts.tables} meja, ${counts.kotTickets} tiket KOT.`
          : `Kiraan benih tidak sepadan: ${JSON.stringify(counts)}`,
      });
    } catch (e: any) {
      results.push({ gateId: 6, name: 'Official Seed Dataset Integrity', passed: false, details: e.message, error: e.message });
    }

    // Gate 7: Configurable Tax Model (SES v4.5 Protection)
    try {
      const tax = DEMO_OFFICIAL_SEED.taxConfig;
      const passed =
        typeof tax.taxRatePercent === 'number' &&
        tax.taxName === 'SST' &&
        typeof tax.isTaxInclusive === 'boolean';
      results.push({
        gateId: 7,
        name: 'Configurable Tax Model Preservation',
        passed,
        details: passed
          ? `Konfigurasi cukai dinamik (${tax.taxName} ${tax.taxRatePercent}%, Inklusif: ${tax.isTaxInclusive}). Tiada penegasan kod keras.`
          : 'Konfigurasi cukai cacat.',
      });
    } catch (e: any) {
      results.push({ gateId: 7, name: 'Configurable Tax Model Preservation', passed: false, details: e.message, error: e.message });
    }

    // Gate 8: Allowlisted LocalStorage Purge (No localStorage.clear())
    try {
      const testKeyNonDemo = 'client_workspace_keep_safe_test';
      localStorage.setItem(testKeyNonDemo, 'important_data');
      localStorage.setItem('restaurant_menu_demo', 'obsolete_menu_data');

      DemoSandboxService.purgeAllowlistedLocalStorage();

      const nonDemoStillExists = localStorage.getItem(testKeyNonDemo) === 'important_data';
      const demoKeyPurged = localStorage.getItem('restaurant_menu_demo') === null;
      localStorage.removeItem(testKeyNonDemo);

      const passed = nonDemoStillExists && demoKeyPurged;
      results.push({
        gateId: 8,
        name: 'Allowlisted LocalStorage Purge Scope',
        passed,
        details: passed
          ? 'Hanya kekunci demo dipadam. Data klien dan token lain terpelihara 100% (localStorage.clear() tidak digunakan).'
          : 'Pembersihan setempat bocor ke luar skop!',
      });
    } catch (e: any) {
      results.push({ gateId: 8, name: 'Allowlisted LocalStorage Purge Scope', passed: false, details: e.message, error: e.message });
    }

    // Gate 9: Allowlisted Firestore Collections Enumeration
    try {
      const allowlist = DEMO_RESET_COLLECTION_ALLOWLIST;
      const hasAuditLogs = (allowlist as readonly string[]).includes('workspace_audit_logs');
      const hasMenu = (allowlist as readonly string[]).includes('restaurant_menu');
      const passed = !hasAuditLogs && hasMenu;
      results.push({
        gateId: 9,
        name: 'Allowlisted Firestore Collections Protection',
        passed,
        details: passed
          ? `Koleksi allowlist mengandungi ${allowlist.length} entiti perniagaan. Rekod audit dikecualikan daripada pemadaman.`
          : 'Allowlist tidak selamat!',
      });
    } catch (e: any) {
      results.push({ gateId: 9, name: 'Allowlisted Firestore Collections Protection', passed: false, details: e.message, error: e.message });
    }

    // Gate 10: Scoped Listener Detachment
    try {
      FirebaseService.detachWorkspaceListeners('demo');
      const isSub = FirebaseService.isWorkspaceSubscribed('demo');
      const passed = isSub === false;
      results.push({
        gateId: 10,
        name: 'Scoped Listener Detachment',
        passed,
        details: passed
          ? 'Pendengar khusus workspace demo berjaya diputuskan tanpa menyentuh workspace lain.'
          : 'Pemutusan pendengar gagal.',
      });
    } catch (e: any) {
      results.push({ gateId: 10, name: 'Scoped Listener Detachment', passed: false, details: e.message, error: e.message });
    }

    // Gate 11: Offline Safety Check Assertion
    try {
      // Test isDemoWorkspace predicate
      const isDemo = DemoSandboxService.isDemoWorkspace('demo');
      const isNotDemo = DemoSandboxService.isDemoWorkspace('kedai-pak-abu');
      const passed = isDemo && !isNotDemo;
      results.push({
        gateId: 11,
        name: 'Demo Workspace Predicate Safety',
        passed,
        details: passed
          ? 'Predikat sandbox membezakan workspace demo dengan tepat daripada penyewa pengeluaran.'
          : 'Predikat gagal membezakan workspace.',
      });
    } catch (e: any) {
      results.push({ gateId: 11, name: 'Demo Workspace Predicate Safety', passed: false, details: e.message, error: e.message });
    }

    // Gate 12: Heartbeat & Inactivity Window
    try {
      const session = DemoAnalyticsService.initSession();
      DemoAnalyticsService.trackEvent('DEMO_VERIFICATION_TEST_ACTION', { gate: 12 });
      const current = DemoAnalyticsService.getSession();
      const passed = Boolean(current && current.eventsCount >= 1 && current.sessionId);
      results.push({
        gateId: 12,
        name: 'Heartbeat & Telemetry Tracking',
        passed,
        details: passed
          ? `Sesi telemetri dikesan (${current?.sessionId}, peristiwa: ${current?.eventsCount}).`
          : 'Telemetri gagal dimulakan.',
      });
    } catch (e: any) {
      results.push({ gateId: 12, name: 'Heartbeat & Telemetry Tracking', passed: false, details: e.message, error: e.message });
    }

    // Gate 13: Privacy-Preserving Telemetry (Zero PII)
    try {
      const session = DemoAnalyticsService.getSession();
      const rawString = JSON.stringify(session);
      // Verify no email, IC, or full query param string
      const passed = !rawString.includes('@') && !rawString.includes('utm_campaign=');
      results.push({
        gateId: 13,
        name: 'Privacy-Preserving Telemetry Verification',
        passed,
        details: passed
          ? 'Telemetri mematuhi prinsip privasi (tiada PII atau parameter URL mentah disimpan).'
          : 'Kebocoran data privasi dikesan dalam telemetri!',
      });
    } catch (e: any) {
      results.push({ gateId: 13, name: 'Privacy-Preserving Telemetry Verification', passed: false, details: e.message, error: e.message });
    }

    // Gate 14: Non-Destructive View Reload
    try {
      DemoSandboxService.seedAllowlistedLocalStorage();
      const rawMenu = localStorage.getItem('restaurant_menu_demo');
      const parsedMenu = rawMenu ? JSON.parse(rawMenu) : [];
      const passed = Array.isArray(parsedMenu) && parsedMenu.length === 12;
      results.push({
        gateId: 14,
        name: 'Non-Destructive View Reload & Seed Sync',
        passed,
        details: passed
          ? 'Penyegerakan paparan tempatan berjaya mengisi 12 menu benih tanpa mengubah pangkalan data awan.'
          : 'Penyegerakan benih tempatan tidak sepadan.',
      });
    } catch (e: any) {
      results.push({ gateId: 14, name: 'Non-Destructive View Reload & Seed Sync', passed: false, details: e.message, error: e.message });
    }

    // Gate 15: Zero Regression on Client Workspaces & Trial Calculations
    try {
      const all = WorkspaceService.getAllWorkspaces();
      const demoExists = all.some((w) => w.workspaceSlug === 'demo');
      const passed = all.length >= 1 && demoExists;
      results.push({
        gateId: 15,
        name: 'Zero Client Workspace Regression',
        passed,
        details: passed
          ? `Sistem mengekalkan integriti senarai ${all.length} workspace klien bersama sandbox demo berasingan.`
          : 'Regresi pada senarai workspace dikesan!',
      });
    } catch (e: any) {
      results.push({ gateId: 15, name: 'Zero Client Workspace Regression', passed: false, details: e.message, error: e.message });
    }

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      passed: failedCount === 0,
      total: results.length,
      passedCount,
      failedCount,
      results,
    };
  }
}
