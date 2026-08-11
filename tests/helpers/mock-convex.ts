/**
 * Harness de test : simule le contexte Convex (db, storage, auth) en mémoire
 * pour appeler directement les handlers des mutations/queries sans déployer
 * de backend. Aucune dépendance externe, aucune clé tierce.
 *
 * `getAuthUserId` (convex auth) est mocké au niveau module : on contrôle qui
 * est "connecté" (ou personne) via `setCurrentUser()`.
 */
import { beforeEach, vi } from "bun:test";

// ---------------------------------------------------------------------------
// Mock de @convex-dev/auth/server → getAuthUserId
// ---------------------------------------------------------------------------
let currentUserId: string | null = null;

export function setCurrentUser(id: string | null) {
  currentUserId = id;
}

vi.mock("@convex-dev/auth/server", async () => {
  return {
    getAuthUserId: vi.fn(async () => currentUserId),
    getAuthSessionId: vi.fn(async () =>
      currentUserId ? `session-${currentUserId}` : null,
    ),
  };
});

// ---------------------------------------------------------------------------
// Base de données en mémoire (subset de l'API Convex utilisée par les handlers)
// ---------------------------------------------------------------------------
type Doc = Record<string, unknown> & { _id: string };

export class MemoryDb {
  tables: Record<string, Map<string, Doc>> = {};

  constructor() {
    this.tables = {};
  }

  reset() {
    this.tables = {};
  }

  seed(table: string, docs: Doc[]) {
    const map = (this.tables[table] ??= new Map());
    for (const d of docs) {
      map.set(d._id, { ...d });
    }
  }

  get(table: string, id: string): Doc | null {
    return this.tables[table]?.get(id) ?? null;
  }

  insert(table: string, value: Doc): string {
    const map = (this.tables[table] ??= new Map());
    const id = value._id ?? `${table}-${map.size + 1}`;
    map.set(id, { ...value, _id: id });
    return id;
  }

  patch(table: string, id: string, patch: Record<string, unknown>) {
    const doc = this.tables[table]?.get(id);
    if (doc) this.tables[table]!.set(id, { ...doc, ...patch });
  }

  delete(table: string, id: string) {
    this.tables[table]?.delete(id);
  }

  query(table: string): QueryBuilder {
    return new QueryBuilder(table, this);
  }

  raw(table: string): Doc[] {
    return [...(this.tables[table]?.values() ?? [])];
  }
}

class QueryBuilder {
  private filters: ((d: Doc) => boolean)[] = [];
  private table: string;
  private db: MemoryDb;

  constructor(table: string, db: MemoryDb) {
    this.table = table;
    this.db = db;
  }

  withIndex(_name: string, predicate?: (q: QueryBuilder) => void): this {
    // L'API Convex réelle : withIndex(nom, (q) => q.eq(...)) applique le
    // prédicat d'index. On l'exécute pour que le filtre soit bien appliqué.
    if (predicate) predicate(this);
    return this;
  }

  filter(fn: (d: Doc) => boolean): this {
    this.filters.push(fn);
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((d) => d[field] === value);
    return this;
  }

  order(): this {
    return this;
  }

  unique(): Doc | null {
    const all = this.collect();
    return all[0] ?? null;
  }

  first(): Doc | null {
    return this.collect()[0] ?? null;
  }

  collect(): Doc[] {
    return this.db.raw(this.table).filter((d) => this.filters.every((f) => f(d)));
  }
}

// ---------------------------------------------------------------------------
// Stockage (files) — mock simple avec suivi des suppressions
// ---------------------------------------------------------------------------
export const mockStorage = {
  deleted: [] as string[],
  reset() {
    this.deleted = [];
  },
  generateUploadUrl: async () => "https://mock.example/upload?token=signed",
  getUrl: async () => "https://mock.example/file/abc?exp=1",
  delete: async (id: string) => {
    mockStorage.deleted.push(id);
  },
};

// ---------------------------------------------------------------------------
// Contexte (mutation & query) simulé pour les handlers
// ---------------------------------------------------------------------------
export function makeDb() {
  return new MemoryDb();
}

export function makeMutationCtx(db: MemoryDb) {
  return {
    auth: { getSubject: async () => currentUserId },
    db: {
      get: (id: string) => db.get(tableOf(id), id),
      insert: (table: string, value: unknown) =>
        db.insert(table, value as Doc),
      patch: (id: string, patch: unknown) =>
        db.patch(tableOf(id), id, patch as Record<string, unknown>),
      delete: (id: string) => db.delete(tableOf(id), id),
      query: (table: string) => db.query(table),
    },
    storage: {
      generateUploadUrl: mockStorage.generateUploadUrl,
      getUrl: mockStorage.getUrl,
      delete: mockStorage.delete,
    },
  };
}

export function makeQueryCtx(db: MemoryDb) {
  return makeMutationCtx(db);
}

/**
 * Appelle une référence de fonction Convex (mutation/query) avec le contexte
 * simulé. Le typage Convex n'expose pas de signature d'appel sur la référence,
 * mais elle est bien invocable à l'exécution — ce helper rend le typage propre.
 */
export function call<T>(fn: unknown, ctx: unknown, args: unknown): Promise<T> {
  return (fn as (c: unknown, a: unknown) => Promise<T>)(ctx, args);
}

function tableOf(id: string): string {
  // Convention du mock : les ids sont préfixés par leur table ("scans-1").
  const idx = id.indexOf("-");
  if (idx > 0) return id.slice(0, idx);
  return id;
}

// ---------------------------------------------------------------------------
// Fixtures courantes
// ---------------------------------------------------------------------------
export const uid = (n: number) => `users-${n}`;

export function seedUser(db: MemoryDb, id: string, extra: Record<string, unknown> = {}) {
  db.seed("users", [{ _id: id, name: "Test", email: `${id}@test.fr`, ...extra }]);
}

export function seedScan(
  db: MemoryDb,
  opts: { id: string; owner: string; createdAt?: number; storageIds?: string[] },
) {
  db.seed("scans", [
    {
      _id: opts.id,
      userId: opts.owner,
      storageIds: opts.storageIds ?? [],
      subject: "Mathématiques",
      topic: "Fonctions",
      level: "seconde",
      title: "Exercice",
      status: "done",
      mode: "quick",
      createdAt: opts.createdAt ?? Date.now(),
    },
  ]);
}

export function currentMonthForTest(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function seedUsage(
  db: MemoryDb,
  opts: { id: string; owner: string; scans?: number; sheets?: number; quizzes?: number; lastScanAt?: number },
) {
  db.seed("usage", [
    {
      _id: opts.id,
      userId: opts.owner,
      month: currentMonthForTest(),
      scansCount: opts.scans ?? 0,
      sheetsCount: opts.sheets ?? 0,
      quizzesCount: opts.quizzes ?? 0,
      lastScanAt: opts.lastScanAt,
      updatedAt: Date.now(),
    },
  ]);
}

// Nettoie les mocks entre chaque test.
beforeEach(() => {
  currentUserId = null;
  mockStorage.reset();
});
