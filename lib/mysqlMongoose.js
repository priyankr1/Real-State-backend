import crypto from 'crypto';
import connectdb, { getPool, isDatabaseReady, closeDatabase } from '../config/mysql.js';

const registry = new Map();
const collectionRegistry = new Map();
const ensuredTables = new Set();

const clone = (value) => value === undefined ? undefined : structuredClone(value);
const idString = (value) => value && typeof value === 'object' && value._id ? String(value._id) : value == null ? value : String(value);
const getPath = (obj, path) => String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], obj);
const setPath = (obj, path, value) => {
  const parts = String(path).split('.');
  let cursor = obj;
  parts.slice(0, -1).forEach((part) => { cursor[part] ??= {}; cursor = cursor[part]; });
  cursor[parts.at(-1)] = value;
};
const deletePath = (obj, path) => {
  const parts = String(path).split('.');
  const parent = parts.slice(0, -1).reduce((value, key) => value?.[key], obj);
  if (parent) delete parent[parts.at(-1)];
};
const comparable = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return Date.parse(value);
  return value;
};
const equal = (left, right) => idString(left) === idString(right) || comparable(left) === comparable(right);

function matchesCondition(value, condition) {
  if (condition instanceof RegExp) return Array.isArray(value)
    ? value.some((item) => condition.test(String(item ?? '')))
    : condition.test(String(value ?? ''));
  if (!condition || typeof condition !== 'object' || condition instanceof Date || Array.isArray(condition)) {
    if (Array.isArray(value)) return value.some((item) => equal(item, condition));
    return equal(value, condition);
  }
  return Object.entries(condition).every(([operator, expected]) => {
    const actual = comparable(value);
    const target = comparable(expected);
    if (operator === '$in') return expected.some((item) => Array.isArray(value) ? value.some((v) => equal(v, item)) : equal(value, item));
    if (operator === '$ne') return !equal(value, expected);
    if (operator === '$gt') return actual > target;
    if (operator === '$gte') return actual >= target;
    if (operator === '$lt') return actual < target;
    if (operator === '$lte') return actual <= target;
    if (operator === '$exists') return expected ? value !== undefined : value === undefined;
    if (operator === '$type') return expected === 'string' ? typeof value === 'string' : true;
    if (operator === '$regex') return new RegExp(expected, condition.$options || '').test(String(value ?? ''));
    if (operator === '$options') return true;
    return matchesCondition(getPath(value, operator), expected);
  });
}

function matches(document, filter = {}) {
  return Object.entries(filter || {}).every(([path, condition]) => {
    if (path === '$or') return condition.some((part) => matches(document, part));
    if (path === '$and') return condition.every((part) => matches(document, part));
    return matchesCondition(getPath(document, path), condition);
  });
}

function applyProjection(document, projection) {
  if (!projection) return document;
  const fields = typeof projection === 'string'
    ? projection.split(/\s+/).filter(Boolean).reduce((out, field) => ({ ...out, [field.replace(/^-/, '')]: field.startsWith('-') ? 0 : 1 }), {})
    : projection;
  const include = Object.entries(fields).filter(([key, value]) => value && key !== '_id').map(([key]) => key);
  if (include.length) {
    const result = fields._id === 0 ? {} : { _id: document._id };
    include.forEach((path) => { const value = getPath(document, path); if (value !== undefined) setPath(result, path, clone(value)); });
    return result;
  }
  const result = clone(document);
  Object.entries(fields).forEach(([path, value]) => { if (!value) deletePath(result, path); });
  return result;
}

function normalizeDefinition(definition) {
  if (Array.isArray(definition)) return { kind: 'array', item: definition[0] };
  if (typeof definition === 'function') return { type: definition };
  if (definition && typeof definition === 'object' && Object.hasOwn(definition, 'type')) return definition;
  return null;
}

function materialize(definition, input = {}, validate = false, prefix = '') {
  const output = { ...clone(input || {}) };
  for (const [key, raw] of Object.entries(definition || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    const descriptor = normalizeDefinition(raw);
    if (!descriptor) {
      output[key] = materialize(raw, input?.[key] || {}, validate, path);
      continue;
    }
    let value = input?.[key];
    const defaultValue = descriptor.default;
    if (value === undefined && defaultValue !== undefined) value = typeof defaultValue === 'function' ? defaultValue() : clone(defaultValue);
    if (validate && descriptor.required && (value === undefined || value === null || value === '')) throw new Error(`${path} is required`);
    if (value === undefined) continue;
    if (descriptor.lowercase && typeof value === 'string') value = value.toLowerCase();
    if (descriptor.trim && typeof value === 'string') value = value.trim();
    if (validate && descriptor.enum && !descriptor.enum.includes(value)) throw new Error(`${path} has an invalid value`);
    output[key] = value;
  }
  return output;
}

function collectionName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('s')) return lower;
  if (lower.endsWith('y')) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}

const safeTable = (name) => {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Unsafe MySQL table name: ${name}`);
  return `mongo_${name}`;
};

async function ensureTable(name) {
  if (ensuredTables.has(name)) return;
  const table = safeTable(name);
  await getPool().query(`CREATE TABLE IF NOT EXISTS \`${table}\` (
    id CHAR(24) NOT NULL PRIMARY KEY,
    document LONGTEXT NOT NULL,
    created_at DATETIME(3) NULL,
    updated_at DATETIME(3) NULL,
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  ensuredTables.add(name);
}

async function loadCollection(name) {
  await ensureTable(name);
  const [rows] = await getPool().query(`SELECT document FROM \`${safeTable(name)}\``);
  return rows.map((row) => typeof row.document === 'string' ? JSON.parse(row.document) : row.document);
}

async function upsert(name, document) {
  await ensureTable(name);
  await getPool().execute(
    `INSERT INTO \`${safeTable(name)}\` (id, document, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE document=VALUES(document), created_at=VALUES(created_at), updated_at=VALUES(updated_at)`,
    [document._id, JSON.stringify(document), document.createdAt ? new Date(document.createdAt) : null, document.updatedAt ? new Date(document.updatedAt) : null]
  );
}

function evalExpression(expression, document) {
  if (typeof expression === 'string' && expression.startsWith('$')) return getPath(document, expression.slice(1));
  if (!expression || typeof expression !== 'object' || expression instanceof Date) return expression;
  if (Array.isArray(expression)) return expression.map((item) => evalExpression(item, document));
  if (expression.$dateToString) {
    const value = evalExpression(expression.$dateToString.date, document);
    return value ? new Date(value).toISOString().slice(0, 10) : null;
  }
  if (expression.$ifNull) {
    const [value, fallback] = expression.$ifNull.map((item) => evalExpression(item, document));
    return value ?? fallback;
  }
  if (expression.$eq) {
    const [left, right] = expression.$eq.map((item) => evalExpression(item, document));
    return equal(left, right);
  }
  if (expression.$cond) return evalExpression(expression.$cond[evalExpression(expression.$cond[0], document) ? 1 : 2], document);
  return Object.fromEntries(Object.entries(expression).map(([key, value]) => [key, evalExpression(value, document)]));
}

async function runAggregate(source, pipeline) {
  let rows = clone(source);
  for (const stage of pipeline) {
    if (stage.$match) rows = rows.filter((row) => matches(row, stage.$match));
    else if (stage.$sort) rows.sort((a, b) => compareSort(a, b, stage.$sort));
    else if (stage.$limit) rows = rows.slice(0, stage.$limit);
    else if (stage.$group) {
      const groups = new Map();
      for (const row of rows) {
        const key = evalExpression(stage.$group._id, row);
        const encoded = JSON.stringify(key);
        if (!groups.has(encoded)) groups.set(encoded, { _id: key, __rows: [] });
        groups.get(encoded).__rows.push(row);
      }
      rows = [...groups.values()].map((group) => {
        const out = { _id: group._id };
        for (const [field, accumulator] of Object.entries(stage.$group)) {
          if (field === '_id') continue;
          if (accumulator.$sum !== undefined) out[field] = group.__rows.reduce((sum, row) => sum + Number(evalExpression(accumulator.$sum, row) || 0), 0);
          if (accumulator.$avg !== undefined) out[field] = group.__rows.reduce((sum, row) => sum + Number(evalExpression(accumulator.$avg, row) || 0), 0) / group.__rows.length;
          if (accumulator.$max !== undefined) out[field] = group.__rows.reduce((max, row) => { const value = evalExpression(accumulator.$max, row); return max == null || comparable(value) > comparable(max) ? value : max; }, null);
        }
        return out;
      });
    } else if (stage.$lookup) {
      const foreign = await loadCollection(stage.$lookup.from);
      rows = rows.map((row) => ({ ...row, [stage.$lookup.as]: foreign.filter((item) => equal(getPath(row, stage.$lookup.localField), getPath(item, stage.$lookup.foreignField))) }));
    } else if (stage.$unwind) {
      const path = String(stage.$unwind).replace(/^\$/, '');
      rows = rows.flatMap((row) => (getPath(row, path) || []).map((item) => { const out = clone(row); setPath(out, path, item); return out; }));
    } else if (stage.$project) rows = rows.map((row) => {
      const out = {};
      for (const [field, expression] of Object.entries(stage.$project)) {
        if (field === '_id' && expression === 0) continue;
        if (expression === 1) out[field] = row[field];
        else if (expression !== 0) out[field] = evalExpression(expression, row);
      }
      return out;
    });
  }
  return rows;
}

function compareSort(a, b, sort) {
  for (const [path, direction] of Object.entries(sort || {})) {
    const left = comparable(getPath(a, path));
    const right = comparable(getPath(b, path));
    if (left == null && right != null) return direction;
    if (left != null && right == null) return -direction;
    if (left < right) return -direction;
    if (left > right) return direction;
  }
  return 0;
}

class Query {
  constructor(model, resolver, single = false) { this.model = model; this.resolver = resolver; this.single = single; this.options = { populate: [] }; }
  select(value) { this.options.select = value; return this; }
  sort(value) { this.options.sort = value; return this; }
  skip(value) { this.options.skip = Number(value); return this; }
  limit(value) { this.options.limit = Number(value); return this; }
  lean() { this.options.lean = true; return this; }
  populate(path, select) {
    const entries = Array.isArray(path) ? path : [path];
    entries.forEach((entry) => {
      if (entry && typeof entry === 'object') this.options.populate.push({ path: entry.path, select: entry.select });
      else String(entry).split(/\s+/).filter(Boolean).forEach((item) => this.options.populate.push({ path: item, select }));
    });
    return this;
  }
  async execute() {
    let result = await this.resolver();
    let rows = this.single ? (result ? [result] : []) : result;
    if (this.options.sort) rows.sort((a, b) => compareSort(a, b, this.options.sort));
    if (this.options.skip) rows = rows.slice(this.options.skip);
    if (this.options.limit != null) rows = rows.slice(0, this.options.limit);
    for (const config of this.options.populate) rows = await Promise.all(rows.map((row) => populateObject(row, config.path, config.select)));
    rows = rows.map((row) => applyProjection(row, this.options.select));
    if (!this.options.lean) rows = rows.map((row) => new this.model(row, true));
    return this.single ? rows[0] || null : rows;
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  catch(reject) { return this.execute().catch(reject); }
}

async function populateObject(row, path, select) {
  const refs = { propertyId: 'Property', userId: 'User', postedBy: 'User' };
  const Model = registry.get(refs[path]);
  if (!Model) return row;
  const id = getPath(row, path);
  if (!id) return row;
  const related = await Model.findById(id).select(select || '');
  const output = row instanceof Document ? row : clone(row);
  output[path] = related;
  return output;
}

class Document {
  constructor(model, data, persisted = false) {
    Object.defineProperty(this, '__model', { value: model, enumerable: false });
    Object.defineProperty(this, '__persisted', { value: persisted, writable: true, enumerable: false });
    Object.assign(this, materialize(model.schema.definition, data || {}));
    this._id ||= crypto.randomBytes(12).toString('hex');
    Object.defineProperty(this, '__original', { value: clone(this.toObject()), writable: true, enumerable: false });
  }
  isModified(path) { return !this.__persisted || (path ? JSON.stringify(getPath(this, path)) !== JSON.stringify(getPath(this.__original, path)) : JSON.stringify(this.toObject()) !== JSON.stringify(this.__original)); }
  async save() {
    const model = this.__model;
    const clean = materialize(model.schema.definition, this.toObject(), true);
    const uniqueFields = Object.entries(model.schema.definition).filter(([, raw]) => normalizeDefinition(raw)?.unique);
    const existing = uniqueFields.length ? await loadCollection(model.collectionName) : [];
    for (const [field, raw] of uniqueFields) {
      const descriptor = normalizeDefinition(raw);
      if (descriptor?.unique && existing.some((row) => row._id !== this._id && equal(getPath(row, field), getPath(clean, field)))) {
        const error = new Error(`Duplicate value for ${field}`); error.code = 11000; throw error;
      }
    }
    for (const hook of model.schema.hooks.save || []) await new Promise((resolve, reject) => {
      const next = (error) => error ? reject(error) : resolve();
      Promise.resolve(hook.call(this, next)).catch(reject);
    });
    if (model.schema.options.timestamps) {
      this.createdAt ||= new Date();
      this.updatedAt = new Date();
    }
    await upsert(model.collectionName, this.toObject());
    this.__persisted = true;
    this.__original = clone(this.toObject());
    return this;
  }
  async populate(path, select) {
    const entries = Array.isArray(path) ? path : [path];
    for (const entry of entries) {
      if (entry && typeof entry === 'object') await populateObject(this, entry.path, entry.select);
      else await populateObject(this, entry, select);
    }
    return this;
  }
  markModified() { return this; }
  toObject() { return Object.fromEntries(Object.entries(this).map(([key, value]) => [key, value instanceof Document ? value.toObject() : clone(value)])); }
  toJSON() { return this.toObject(); }
}

class Schema {
  static Types = { ObjectId: String, Mixed: Object };
  constructor(definition = {}, options = {}) { this.definition = definition; this.options = options; this.hooks = {}; }
  index() { return this; }
  pre(event, handler) { (this.hooks[event] ||= []).push(handler); return this; }
}

function model(name, schema, explicitCollection) {
  const collection = explicitCollection || collectionName(name);
  class Model extends Document {
    constructor(data, persisted = false) { super(Model, data, persisted); }
    static schema = schema;
    static collectionName = collection;
    static async init() { await ensureTable(collection); return Model; }
    static find(filter = {}) { return new Query(Model, async () => (await loadCollection(collection)).filter((row) => matches(row, filter))); }
    static findOne(filter = {}) { return new Query(Model, async () => (await loadCollection(collection)).find((row) => matches(row, filter)) || null, true); }
    static findById(id) { return Model.findOne({ _id: id }); }
    static async create(data) { const document = new Model(data); return document.save(); }
    static async countDocuments(filter = {}) { return (await loadCollection(collection)).filter((row) => matches(row, filter)).length; }
    static async exists(filter = {}) { const row = (await loadCollection(collection)).find((item) => matches(item, filter)); return row ? { _id: row._id } : null; }
    static async updateMany(filter, update) {
      const rows = (await loadCollection(collection)).filter((row) => matches(row, filter));
      for (const row of rows) { applyUpdate(row, update); if (schema.options.timestamps) row.updatedAt = new Date(); await upsert(collection, row); }
      return { acknowledged: true, matchedCount: rows.length, modifiedCount: rows.length };
    }
    static async deleteMany(filter = {}) {
      const rows = (await loadCollection(collection)).filter((row) => matches(row, filter));
      if (rows.length) await getPool().query(`DELETE FROM \`${safeTable(collection)}\` WHERE id IN (?)`, [rows.map((row) => row._id)]);
      return { acknowledged: true, deletedCount: rows.length };
    }
    static findByIdAndUpdate(id, update, options = {}) { return new Query(Model, async () => { const doc = await Model.findById(id); if (!doc) return null; applyUpdate(doc, update); await doc.save(); return options.new === false ? null : doc.toObject(); }, true); }
    static findByIdAndDelete(id) { return new Query(Model, async () => { const doc = await Model.findById(id); if (!doc) return null; await getPool().execute(`DELETE FROM \`${safeTable(collection)}\` WHERE id = ?`, [String(id)]); return doc.toObject(); }, true); }
    static async aggregate(pipeline = []) { return runAggregate(await loadCollection(collection), pipeline); }
  }
  registry.set(name, Model);
  collectionRegistry.set(collection, Model);
  return Model;
}

function applyUpdate(document, update) {
  const operators = Object.keys(update || {}).some((key) => key.startsWith('$'));
  if (!operators) Object.entries(update || {}).forEach(([path, value]) => setPath(document, path, clone(value)));
  Object.entries(update?.$set || {}).forEach(([path, value]) => setPath(document, path, clone(value)));
  Object.keys(update?.$unset || {}).forEach((path) => deletePath(document, path));
  Object.entries(update?.$inc || {}).forEach(([path, value]) => setPath(document, path, Number(getPath(document, path) || 0) + Number(value)));
  return document;
}

const mongoose = {
  Schema,
  model,
  Types: { ObjectId: { isValid: (value) => /^[a-f\d]{24}$/i.test(String(value || '')) } },
  connection: {
    get readyState() { return isDatabaseReady() ? 1 : 0; },
    db: { admin: () => ({ ping: async () => { await getPool().query('SELECT 1'); return { ok: 1 }; } }) },
    close: closeDatabase,
    on: () => {},
  },
  disconnect: closeDatabase,
  connect: connectdb,
};

export default mongoose;
export { Schema, model };

