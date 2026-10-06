#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7c8d07660e22460959a0e2511bc6911622b2196e975433a43acfa713884f4a86/contract';
import endContract from '../../snapshots/7c8d07660e22460959a0e2511bc6911622b2196e975433a43acfa713884f4a86/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a9226732d1e1d567fd297a6ae1ed464e533d04b7e57ca7d8dc57e8f23e642f5c/contract';
import startContract from '../../snapshots/a9226732d1e1d567fd297a6ae1ed464e533d04b7e57ca7d8dc57e8f23e642f5c/contract.json' with { type: 'json' };
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
        table: 'AccessEvent',
        columns: [
          col('deviceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fingerprintSlot', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('outcome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timestamp', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'AccessEvent_outcome_check_87d356c0',
            "\"outcome\" IN ('GRANTED', 'DENIED', 'ADMIN_UNLOCK')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'DeviceCommand',
        columns: [
          col('deviceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pendingUnlockAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['deviceId'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_username_key',
        columns: ['username'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AccessEvent',
        index: 'AccessEvent_timestamp_idx_a2429bb8',
        columns: ['timestamp'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
