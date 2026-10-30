#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7c8d07660e22460959a0e2511bc6911622b2196e975433a43acfa713884f4a86/contract';
import startContract from '../../snapshots/7c8d07660e22460959a0e2511bc6911622b2196e975433a43acfa713884f4a86/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c0eb48b5774a8a9249d29e135eba5c6cbb90843bc8040f29d7c5e3587b36f4a4/contract';
import endContract from '../../snapshots/c0eb48b5774a8a9249d29e135eba5c6cbb90843bc8040f29d7c5e3587b36f4a4/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Fingerprint',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slot', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'FingerprintJob',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fingerprintId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('slot', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('step', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'FingerprintJob_status_check_5852f12a',
            "\"status\" IN ('PENDING', 'SENT', 'SUCCEEDED', 'FAILED', 'EXPIRED')",
          ),
          checkExpression('FingerprintJob_type_check_6410af27', "\"type\" IN ('ENROLL', 'DELETE')"),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'AccessEvent',
        column: col('fingerprintName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'Fingerprint',
        constraint: 'Fingerprint_deviceId_slot_key',
        columns: ['deviceId', 'slot'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FingerprintJob',
        index: 'FingerprintJob_deviceId_status_idx_bb11af39',
        columns: ['deviceId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FingerprintJob',
        index: 'fingerprint_job_one_active_ea702928',
        columns: ['deviceId'],
        extras: { where: "(\"status\" IN ('PENDING', 'SENT'))", unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
